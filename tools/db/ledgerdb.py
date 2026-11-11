"""Build the ledger database from data/db row files, write rows back, and export JSON."""
import argparse
from contextlib import closing
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import re
import sqlite3
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = Path(__file__).with_name('schema.sql')
ROWS = 'data/db'
DEFAULT_DB = 'data/work/ledger.sqlite3'

PENDING_REASON = 'Facility identity changed since location review'
GROUP_PENDING_REASON = 'A reviewed building group member changed identity'
ADOPTION_KEYS = ('facilityId', 'coordinate', 'evidence', 'scope')
# The reason a reviewed adoption takes: by scope for a facility point or a user-designated point
# (adoption_extra approvalMode manual-user-approval), else the building reason.
ADOPTION_REASONS = {'facility': 'Adopted facility representative point',
                    'user-designated-center': '利用者指定採用（位置・利用条件は未検証）',
                    'user-designated-historical-site': '利用者指定の旧敷地代表点（単体棟・位置精度・利用条件は未検証）'}
BUILDING_REASON = 'Adopted building representative point'

# Cross-row rules that CHECK constraints cannot express. Each query yields table, key and message.
CROSS_ROW_CHECKS = [
    ("""SELECT 'location_decision', facility_id, seq, 'has no previous decision' FROM location_decision d
        WHERE seq > 1 AND NOT EXISTS (SELECT 1 FROM location_decision p
                                      WHERE p.facility_id = d.facility_id AND p.seq = d.seq - 1)"""),
    ("""SELECT 'location_decision', d.facility_id, d.seq, 'must follow a reviewed previous decision in date order'
        FROM location_decision d JOIN location_decision p ON p.facility_id = d.facility_id AND p.seq = d.seq - 1
        WHERE p.reviewed_at IS NULL OR d.reviewed_at < p.reviewed_at"""),
    ("""SELECT 'location_decision', d.facility_id, d.seq, 'reaffirm must keep and correct must change the coordinate'
        FROM location_decision d JOIN location_decision p ON p.facility_id = d.facility_id AND p.seq = d.seq - 1
        WHERE (d.action = 'reaffirm' AND (d.lat IS NOT p.lat OR d.lng IS NOT p.lng))
           OR (d.action = 'correct' AND d.lat IS p.lat AND d.lng IS p.lng)"""),
    ("""SELECT 'facility_legacy_id', facility_id, NULL, 'positions must be 0..n-1' FROM facility_legacy_id
        GROUP BY facility_id HAVING max(position) <> count(*) - 1"""),
    ("""SELECT 'card_alias', old_id, NULL, 'alias target is an alias, or the alias is excluded' FROM card_alias
        WHERE target_id IN (SELECT old_id FROM card_alias) OR old_id IN (SELECT card_id FROM card_excluded)"""),
    # The input ledger carried these coordinates under the facility's own evidence.
    ("""SELECT 'location_decision', d.facility_id, d.seq, 'an input-ledger adoption uses the facility evidence'
        FROM location_decision d JOIN facility f ON f.id = d.facility_id
        WHERE d.adoption_source = 'input-ledger' AND d.evidence_id <> f.identity_evidence_id"""),
    ("""SELECT 'building_group', id, NULL, 'needs at least two members' FROM building_group g
        WHERE (SELECT count(*) FROM building_group_member WHERE group_id = g.id) < 2"""),
    ("""SELECT 'building_group_member', group_id, NULL, 'positions must be 0..n-1' FROM building_group_member
        GROUP BY group_id HAVING max(position) <> count(*) - 1"""),
    ("""SELECT 'building_group_member', facility_id, NULL, 'member needs a reviewed location adoption'
        FROM building_group_member m WHERE NOT EXISTS (
          SELECT 1 FROM location_decision WHERE facility_id = m.facility_id AND seq = 1 AND reason IS NOT NULL)"""),
    # Research rows are kept only while a facility has no location; adoption retires them.
    ("""SELECT 'location_research', facility_id, source_ref, 'facility has a current location; drop its research rows'
        FROM location_research r WHERE coalesce((SELECT action FROM location_decision WHERE facility_id = r.facility_id
                                                 ORDER BY seq DESC LIMIT 1), 'withdraw') <> 'withdraw'"""),
    ("""SELECT 'location_candidate', facility_id, source_ref, 'facility has a current location; drop its candidate rows'
        FROM location_candidate c WHERE coalesce((SELECT action FROM location_decision WHERE facility_id = c.facility_id
                                                  ORDER BY seq DESC LIMIT 1), 'withdraw') <> 'withdraw'"""),
    ("""SELECT 'location_recheck', facility_id, source_ref, 'facility has no current location'
        FROM location_recheck r WHERE coalesce((SELECT action FROM location_decision WHERE facility_id = r.facility_id
                                                ORDER BY seq DESC LIMIT 1), 'withdraw') = 'withdraw'"""),
    ("""SELECT 'location_research_attempt', facility_id, source_ref, 'positions must be 0..n-1'
        FROM location_research_attempt GROUP BY facility_id, source_ref HAVING max(position) <> count(*) - 1"""),
    ("""SELECT 'user_answer', source_ref, NULL, 'needs a facility' FROM user_answer a
        WHERE NOT EXISTS (SELECT 1 FROM user_answer_facility WHERE source_ref = a.source_ref)"""),
    ("""SELECT 'user_answer_facility', source_ref, NULL, 'positions must be 0..n-1' FROM user_answer_facility
        GROUP BY source_ref HAVING max(position) <> count(*) - 1"""),
    ("""SELECT 'source_review', id, NULL, 'needs evidence' FROM source_review r
        WHERE NOT EXISTS (SELECT 1 FROM source_review_evidence WHERE review_id = r.id)"""),
    ("""SELECT 'source_review_evidence', review_id, NULL, 'positions must be 0..n-1' FROM source_review_evidence
        GROUP BY review_id HAVING max(position) <> count(*) - 1"""),
    ("""SELECT 'source_review_evidence', e.review_id, e.position, 'evidence is checked after its review'
        FROM source_review_evidence e JOIN source_review r ON r.id = e.review_id WHERE e.checked_at > r.checked_at"""),
]

# Temporary views the summary reads. A held facility has a current location awaiting review
# after an identity change, as export_ledger decides.
SUMMARY_VIEWS = '''
CREATE TEMP VIEW current_decision AS
  SELECT d.* FROM location_decision d
  WHERE d.seq = (SELECT max(seq) FROM location_decision WHERE facility_id = d.facility_id);
CREATE TEMP VIEW identity_changed AS
  SELECT c.facility_id FROM current_decision c JOIN facility f ON f.id = c.facility_id
  WHERE c.reason IS NOT NULL AND (c.identity_name <> f.name OR c.identity_address <> f.address);
CREATE TEMP VIEW held_facility AS
  SELECT facility_id FROM identity_changed
  UNION SELECT facility_id FROM building_group_member WHERE group_id IN (
    SELECT group_id FROM building_group_member WHERE facility_id IN (SELECT facility_id FROM identity_changed));
CREATE TEMP VIEW facility_location AS
  SELECT f.id AS facility_id,
         CASE WHEN c.facility_id IS NULL THEN 'none'
              WHEN c.action = 'withdraw' THEN 'withdrawn'
              WHEN f.id IN (SELECT facility_id FROM held_facility) THEN 'held'
              ELSE 'located' END AS state
  FROM facility f LEFT JOIN current_decision c ON c.facility_id = f.id;
'''
# Each query reads the tables and views only; :as_of is the reference date.
SUMMARY_QUERIES = dict(
    facilitiesByLocation='SELECT state, count(*) FROM facility_location GROUP BY state',
    decisionsByAction='SELECT action, count(*) FROM location_decision GROUP BY action',
    currentDecisionsByAction='SELECT action, count(*) FROM current_decision GROUP BY action',
    adoptionsBySource='SELECT adoption_source, count(*) FROM location_decision WHERE seq = 1 GROUP BY adoption_source',
    relationsByStatus='SELECT status, count(*) FROM relation GROUP BY status',
    relationsPastReviewUntil='''SELECT id, card_id, facility_id, review_until FROM relation
        WHERE review_until < :as_of ORDER BY review_until, id''',
    reviewQueue='''SELECT facility_id, review_due, source_version, review_due < :as_of FROM current_decision
        WHERE review_due IS NOT NULL ORDER BY review_due, facility_id''',
    groupMembers='''SELECT m.group_id, m.facility_id,
        m.facility_id IN (SELECT facility_id FROM identity_changed)
        OR EXISTS (SELECT 1 FROM location_decision WHERE facility_id = m.facility_id AND seq > 1)
        FROM building_group_member m ORDER BY m.group_id, m.position''',
    researchByStatus='''SELECT work_unit, status, count(*) FROM location_research
        GROUP BY work_unit, status ORDER BY work_unit, status''',
    unlocatedWithoutResearch='''SELECT facility_id FROM facility_location l
        WHERE state IN ('none', 'withdrawn')
          AND NOT EXISTS (SELECT 1 FROM location_research WHERE facility_id = l.facility_id) ORDER BY facility_id''',
    unlocatedWithResearch='''SELECT count(*) FROM facility_location l WHERE state IN ('none', 'withdrawn')
        AND EXISTS (SELECT 1 FROM location_research WHERE facility_id = l.facility_id)''',
    researchAttempts='SELECT count(*) FROM location_research_attempt',
    researchWithNextSource='''SELECT count(*) FROM location_research
        WHERE coalesce(next_source, next_source_url, next_source_urls) IS NOT NULL''',
    candidates='SELECT count(*), count(DISTINCT facility_id), count(review_ref) FROM location_candidate',
    rechecksByKind='SELECT kind, count(*) FROM location_recheck GROUP BY kind',
    recheckFacilities='SELECT count(DISTINCT facility_id) FROM location_recheck',
    userAnswers='''SELECT count(DISTINCT a.source_ref), count(DISTINCT f.facility_id),
        count(DISTINCT CASE WHEN l.state IN ('none', 'withdrawn') THEN f.facility_id END)
        FROM user_answer a JOIN user_answer_facility f ON f.source_ref = a.source_ref
        JOIN facility_location l ON l.facility_id = f.facility_id''',
    sourceReviewsByStatus='SELECT status, count(*) FROM source_review GROUP BY status',
    reviewedDecisionsByStatus='''SELECT r.status, count(*) FROM source_review_target t
        JOIN source_review r ON r.id = t.review_id GROUP BY r.status''',
    # A located facility whose current decision no source review has read.
    locatedWithoutSourceReview='''SELECT count(*) FROM current_decision c
        JOIN facility_location l ON l.facility_id = c.facility_id
        WHERE l.state = 'located' AND NOT EXISTS (
          SELECT 1 FROM source_review_target WHERE facility_id = c.facility_id AND seq = c.seq)''',
)


class LedgerError(ValueError):
    pass


def evidence_id(row):
    """Content-derived ID. legacy_snapshot_path is excluded so dropping it keeps IDs."""
    content = [row[k] for k in ('source_url', 'snapshot_sha256', 'source_locator', 'checked_at',
                                'actor_type', 'verification_method')]
    return 'evidence:' + hashlib.sha256(
        json.dumps(content, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()[:24]


def digest(value):
    """sha256 of JSON with sorted keys and non-ASCII kept: adoption, state and place digests."""
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def tables(db):
    return [name for (name,) in db.execute(
        "SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY rowid")]


def columns(db, table):
    return [row[1] for row in db.execute(f'PRAGMA table_info({table})')]


def primary_key(db, table):
    info = [row for row in db.execute(f'PRAGMA table_info({table})') if row[5]]
    return [row[1] for row in sorted(info, key=lambda row: row[5])]


def json_columns(db, table):
    """Map JSON columns to 'array' (of strings) or 'object'."""
    (sql,) = db.execute("SELECT sql FROM sqlite_schema WHERE name = ?", (table,)).fetchone()
    return dict(re.findall(r"json_type\((\w+)\) = '(array|object)'", sql))


def empty_database():
    db = sqlite3.connect(':memory:')
    db.executescript(SCHEMA.read_text(encoding='utf-8'))
    return db


def unique_keys(pairs):
    """A JSON object whose keys appear once; json.loads would keep the last of repeated keys."""
    value = {}
    for key, item in pairs:
        if key in value:
            raise LedgerError(f'repeated key {key}')
        value[key] = item
    return value


def read_rows(root):
    directory = Path(root) / ROWS
    with closing(empty_database()) as schema:
        names = tables(schema)
    extra = sorted(p.name for p in directory.glob('*.jsonl') if p.stem not in names)
    if extra:
        raise LedgerError(f'row files without a table: {", ".join(extra)}')
    rows = {}
    for table in names:
        path = directory / f'{table}.jsonl'
        if not path.exists():
            raise LedgerError(f'missing row file: {path}')
        rows[table] = []
        for number, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
            try:
                rows[table].append(json.loads(line, object_pairs_hook=unique_keys))
            except (json.JSONDecodeError, LedgerError) as error:
                raise LedgerError(f'{table} line {number}: {error}') from None
    return rows


def declared_types(db, table):
    return {row[1]: row[2] for row in db.execute(f'PRAGMA table_info({table})')}


def type_error(value, declared, as_json):
    """Why SQLite would store a row-file value as another value, or None.

    STRICT tables still convert True to 1, '1' and 1.0 to an integer, numbers to text, and NaN to NULL.
    """
    if value is None:
        return None
    if as_json:
        try:
            json.dumps(value, allow_nan=False)
        except ValueError:
            return 'JSON without NaN or Infinity'
        return None
    if declared == 'TEXT':
        return None if isinstance(value, str) else 'a string'
    if declared == 'INTEGER':
        return None if isinstance(value, int) and not isinstance(value, bool) else 'an integer'
    if declared == 'REAL':
        number = isinstance(value, (int, float)) and not isinstance(value, bool)
        return None if number and math.isfinite(value) else 'a finite number'
    return None


def load(rows):
    """Insert rows into a new in-memory database and report every violation."""
    db = empty_database()
    db.execute('PRAGMA foreign_keys = OFF')
    errors = [f'{table}: not in tools/db/schema.sql' for table in sorted(set(rows) - set(tables(db)))]
    for table in tables(db):
        cols, key, as_json = columns(db, table), primary_key(db, table), json_columns(db, table)
        types = declared_types(db, table)
        statement = f'INSERT INTO {table} ({", ".join(cols)}) VALUES ({", ".join("?" * len(cols))})'
        for number, row in enumerate(rows.get(table, []), 1):
            if not isinstance(row, dict) or set(row) != set(cols):
                errors.append(f'{table} line {number}: columns must be exactly {", ".join(cols)}')
                continue
            label = f'{table} {tuple(row[k] for k in key)}'
            wrong = {c: why for c in cols if (why := type_error(row[c], types[c], c in as_json))}
            if wrong:
                errors.extend(f'{label}: {c} must be {why}' for c, why in wrong.items())
                continue
            bad = [c for c, kind in as_json.items() if row[c] is not None and not (
                isinstance(row[c], dict) if kind == 'object'
                else isinstance(row[c], list) and all(isinstance(v, str) for v in row[c]))]
            if bad:
                errors.extend(f'{label}: {c} must be null or a JSON '
                              + ('object' if as_json[c] == 'object' else 'array of strings') for c in sorted(bad))
                continue
            if table == 'evidence' and row['id'] != evidence_id(row):
                errors.append(f'{label}: id does not match its content (expected {evidence_id(row)})')
            if table == 'evidence' and isinstance(row['source_url'], str):
                url = urlsplit(row['source_url'])
                if not url.hostname or url.username:
                    errors.append(f'{label}: source_url needs a host and no user name')
            values = [json.dumps(row[c], ensure_ascii=False, separators=(',', ':'))
                      if c in as_json and row[c] is not None else row[c] for c in cols]
            try:
                db.execute(statement, values)
            except sqlite3.DatabaseError as error:
                errors.append(f'{label}: {error}')
    for table, rowid, parent, index in db.execute('PRAGMA foreign_key_check').fetchall():
        key = primary_key(db, table)
        values = db.execute(f'SELECT {", ".join(key)} FROM {table} WHERE rowid = ?', (rowid,)).fetchone()
        column = [fk[3] for fk in db.execute(f'PRAGMA foreign_key_list({table})') if fk[0] == index]
        errors.append(f'{table} {tuple(values)}: FOREIGN KEY constraint failed: {column[0]} -> {parent}')
    for query in CROSS_ROW_CHECKS:
        for table, *key, message in db.execute(query):
            errors.append(f'{table} {tuple(v for v in key if v is not None)}: {message}')
    errors += history_errors(db)
    # The current place digest needs a consistent ledger to export.
    errors += review_target_errors(db, export=not errors)
    if errors:
        db.close()
        raise LedgerError('\n'.join(errors))
    db.commit()
    db.execute('PRAGMA foreign_keys = ON')
    return db


def build(root, out=None):
    db = load(read_rows(root))
    if out is not None:
        out = Path(out)
        out.parent.mkdir(parents=True, exist_ok=True)
        temporary = out.with_name(out.name + '.tmp')
        temporary.unlink(missing_ok=True)
        with closing(sqlite3.connect(temporary)) as target:
            db.backup(target)
        temporary.replace(out)
    return db


def read_database(path):
    """Re-check a SQLite file (possibly edited with SQL) by loading its rows afresh."""
    return load(raw_rows(path))


def raw_rows(path):
    """Rows of a SQLite file as they are, without the checks that read_database runs."""
    path = Path(path)
    if not path.is_file():
        raise LedgerError(f'missing database: {path}')
    with closing(sqlite3.connect(f'{path.resolve().as_uri()}?mode=ro', uri=True)) as source:
        return {table: list(table_rows(source, table)) for table in tables(source)}


def table_rows(db, table):
    """Rows in primary key order with JSON columns decoded, as written to row files."""
    cols, as_json = columns(db, table), json_columns(db, table)
    order = ', '.join(primary_key(db, table))
    for values in db.execute(f'SELECT {", ".join(cols)} FROM {table} ORDER BY {order}'):
        yield {c: json.loads(v) if c in as_json and v is not None else v for c, v in zip(cols, values)}


def row_line(row):
    return json.dumps(row, ensure_ascii=False, allow_nan=False) + '\n'


def write_rows(rows, directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    for table, table_rows_ in rows.items():
        (directory / f'{table}.jsonl').write_text(''.join(row_line(r) for r in table_rows_), encoding='utf-8')


def dump(db, directory):
    write_rows({table: list(table_rows(db, table)) for table in tables(db)}, directory)


def evidence_object(r, day=False):
    return dict(sourceUrl=r['source_url'], snapshotPath=r['legacy_snapshot_path'],
                snapshotSHA256=r['snapshot_sha256'], sourceLocator=r['source_locator'],
                checkedAt=checked_day(r['checked_at']) if day else r['checked_at'], actorType=r['actor_type'],
                verificationMethod=r['verification_method'])


def adoption_record(decision, evidence):
    """The reviewed location update row that adoption_sha256 pins."""
    record = dict(facilityId=decision['facility_id'], coordinate=dict(lat=decision['lat'], lng=decision['lng']),
                  evidence=evidence_object(evidence))
    if decision['scope'] is not None:
        record['scope'] = decision['scope']
    record.update(decision['adoption_extra'] or {})
    return record


def decision_state(decision, evidence):
    """The location state after a reviewed decision; its digest chains the next row."""
    return dict(identity=dict(name=decision['identity_name'], address=decision['identity_address']),
                coordinate=None if decision['lat'] is None else dict(lat=decision['lat'], lng=decision['lng']),
                evidence=evidence_object(evidence, day=True),
                status='withdrawn' if decision['action'] == 'withdraw' else 'confirmed',
                addressStatus=decision['address_status'], reason=decision['reason'],
                decisionId=decision['decision_id'] or '', reviewedAt=decision['reviewed_at'],
                sourceVersion=decision['source_version'] or '', reviewDue=decision['review_due'] or '')


def fingerprints(rows, facility_id):
    """Digests of a facility's location decisions and a template of its next decision row.

    Works from row dicts that need not pass the checks yet, so a new adoption can take its
    adoption_sha256 from here. placeSHA256, the record a source review of the current decision
    names, needs rows that pass apart from those reviews' digests, and is null otherwise.
    """
    facility = next((f for f in rows['facility'] if f['id'] == facility_id), None)
    if facility is None:
        raise LedgerError(f'unknown facility: {facility_id}')
    evidence = {r['id']: r for r in rows['evidence']}
    decisions = []
    for d in sorted((d for d in rows['location_decision'] if d['facility_id'] == facility_id), key=lambda d: d['seq']):
        ev = evidence.get(d['evidence_id'])
        if ev is None:
            raise LedgerError(f"location_decision {(facility_id, d['seq'])}: unknown evidence {d['evidence_id']}")
        decisions.append(dict(
            seq=d['seq'], action=d['action'],
            adoption_sha256=digest(adoption_record(d, ev)) if d['adoption_source'] == 'approved-location' else None,
            # The next row's previous_state_sha256; only a reviewed decision can be followed.
            state_sha256=digest(decision_state(d, ev)) if d['reason'] is not None else None))
    with closing(empty_database()) as schema:
        template = dict.fromkeys(columns(schema, 'location_decision'))
    template.update(facility_id=facility_id, seq=len(decisions) + 1, identity_name=facility['name'],
                    identity_address=facility['address'])
    if decisions:
        template['previous_state_sha256'] = decisions[-1]['state_sha256']
    else:
        template.update(action='adopt', adoption_source='approved-location')
    try:
        # A review target that the change has staled must not hide the digest it now needs.
        with closing(load(dict(rows, source_review_target=[]))) as database:
            place = next(p for p in json.loads(export_ledger(database))['places'] if p['id'] == facility_id)
        place_sha256 = digest(place)
    except LedgerError:
        place_sha256 = None
    return dict(facilityId=facility_id, decisions=decisions, placeSHA256=place_sha256, nextDecision=template)


def history_errors(db):
    """Digest chain and evidence dates of location decisions."""
    evidence = {r['id']: r for r in table_rows(db, 'evidence')}
    errors, previous = [], None
    for d in table_rows(db, 'location_decision'):
        label = f"location_decision {(d['facility_id'], d['seq'])}"
        ev = evidence.get(d['evidence_id'])
        if ev is None:  # reported as a foreign key violation
            previous = None
            continue
        if set(d['adoption_extra'] or ()) & set(ADOPTION_KEYS):
            errors.append(f'{label}: adoption_extra repeats {", ".join(ADOPTION_KEYS)}')
        elif d['adoption_sha256'] is not None and digest(adoption_record(d, ev)) != d['adoption_sha256']:
            errors.append(f'{label}: adoption_sha256 does not match the adoption record')
        if (d['seq'] > 1 and previous is not None and previous[0]['facility_id'] == d['facility_id']
                and digest(decision_state(*previous)) != d['previous_state_sha256']):
            errors.append(f'{label}: previous_state_sha256 does not match decision {d["seq"] - 1}')
        if d['reviewed_at'] is not None and checked_day(ev['checked_at']) > d['reviewed_at']:
            errors.append(f'{label}: decision predates its evidence')
        if d['seq'] == 1 and d['reason'] is not None:
            manual = (d['adoption_extra'] or {}).get('approvalMode') == 'manual-user-approval'
            reason = ADOPTION_REASONS.get(d['scope'], BUILDING_REASON) if manual or d['scope'] == 'facility' \
                else BUILDING_REASON
            if (d['reason'], d['reviewed_at'], d['address_status']) != (reason, checked_day(ev['checked_at']), 'valid'):
                errors.append(f'{label}: a reviewed adoption takes reason {reason!r}, '
                              'its evidence date and a valid address')
        previous = (d, ev)
    return errors


def review_target_errors(db, export=True):
    """A source review must name the record it read: the adoption it pins, or the current exported place."""
    targets = list(db.execute('''
        SELECT t.facility_id, t.seq, t.record_sha256, d.adoption_sha256,
               d.seq = (SELECT max(seq) FROM location_decision WHERE facility_id = t.facility_id)
        FROM source_review_target t JOIN location_decision d ON d.facility_id = t.facility_id AND d.seq = t.seq'''))
    places = None
    errors = []
    for fid, seq, record, adoption, current in targets:
        label = f'source_review_target {(fid, seq)}'
        if adoption is not None:
            if record != adoption:
                errors.append(f'{label}: record_sha256 must be the adoption_sha256 of decision {seq}')
        elif not current:
            errors.append(f'{label}: a decision without adoption_sha256 can be reviewed only while current')
        elif export:
            if places is None:
                places = {p['id']: p for p in json.loads(export_ledger(db))['places']}
            if digest(places[fid]) != record:
                errors.append(f'{label}: record_sha256 does not match the exported place; review it again')
    return errors


def summary(db, as_of):
    """Counts and queues from the tables alone (SUMMARY_QUERIES), evaluated at as_of."""
    db.executescript(SUMMARY_VIEWS)
    try:
        def run(name):
            return db.execute(SUMMARY_QUERIES[name], dict(as_of=as_of)).fetchall()

        def counts(name):
            return {key if key is not None else 'null': n for key, n in run(name)}

        located = counts('facilitiesByLocation')
        groups = {}
        for gid, fid, trigger in run('groupMembers'):
            group = groups.setdefault(gid, dict(groupId=gid, facilityIds=[], triggerFacilityIds=[]))
            group['facilityIds'].append(fid)
            if trigger:
                group['triggerFacilityIds'].append(fid)
        queue = [dict(facilityId=f, reviewDue=d, sourceVersion=v, overdue=bool(o)) for f, d, v, o in run('reviewQueue')]
        overdue_relations = [dict(id=i, cardId=c, facilityId=f, reviewUntil=d)
                             for i, c, f, d in run('relationsPastReviewUntil')]
        research = {}
        for unit, status, n in run('researchByStatus'):
            research.setdefault(unit, {})[status if status is not None else 'null'] = n
        without = [f for (f,) in run('unlocatedWithoutResearch')]
        candidate_rows, candidate_facilities, reviewed_candidates = run('candidates')[0]
        answers, answered, answered_unlocated = run('userAnswers')[0]
        return dict(
            schema=1, asOf=as_of,
            facilities=dict(total=sum(located.values()), byLocation=located),
            locationDecisions=dict(byAction=counts('decisionsByAction'),
                                   currentByAction=counts('currentDecisionsByAction'),
                                   adoptionsBySource=counts('adoptionsBySource')),
            relations=dict(byStatus=counts('relationsByStatus'), pastReviewUntil=len(overdue_relations),
                           pastReviewUntilRows=overdue_relations),
            locationReview=dict(reviewDue=len(queue), pastReviewDue=sum(r['overdue'] for r in queue),
                                reviewQueue=queue,
                                groupImpacts=[g for g in groups.values() if g['triggerFacilityIds']]),
            research=dict(byWorkUnitAndStatus=research, unlocatedWithResearch=run('unlocatedWithResearch')[0][0],
                          unlocatedWithoutResearch=len(without), unlocatedWithoutResearchIds=without,
                          attempts=run('researchAttempts')[0][0], withNextSource=run('researchWithNextSource')[0][0]),
            locationCandidates=dict(rows=candidate_rows, facilities=candidate_facilities, withReview=reviewed_candidates),
            locationRechecks=dict(facilities=run('recheckFacilities')[0][0], byKind=counts('rechecksByKind')),
            userAnswers=dict(answers=answers, facilities=answered, unlocatedFacilities=answered_unlocated),
            sourceReviews=dict(byStatus=counts('sourceReviewsByStatus'),
                               reviewedDecisionsByStatus=counts('reviewedDecisionsByStatus'),
                               locatedWithoutSourceReview=run('locatedWithoutSourceReview')[0][0]))
    finally:
        db.executescript('DROP VIEW temp.facility_location; DROP VIEW temp.held_facility; '
                         'DROP VIEW temp.identity_changed; DROP VIEW temp.current_decision;')


def checked_day(value):
    if len(value) == 10:
        return value
    return dt.datetime.fromisoformat(value.replace('Z', '+00:00')).date().isoformat()


def export_ledger(db):
    """PlaceLedger schema 1 JSON, the ledger that cmd/builddata reads."""
    evidence = {r['id']: r for r in table_rows(db, 'evidence')}
    legacy, decisions = {}, {}
    for r in sorted(table_rows(db, 'facility_legacy_id'), key=lambda r: r['position']):
        legacy.setdefault(r['facility_id'], []).append(r['legacy_id'])
    for r in table_rows(db, 'location_decision'):
        decisions[r['facility_id']] = r  # seq order: the last row is current

    def evidence_json(ev_id):
        return evidence_object(evidence[ev_id], day=True)

    facilities = list(table_rows(db, 'facility'))
    # An identity change since the review holds the facility and its building group.
    pending = {f['id'] for f in facilities if (c := decisions.get(f['id'])) is not None and c['reason'] is not None
               and (c['identity_name'], c['identity_address']) != (f['name'], f['address'])}
    groups = {}
    for r in table_rows(db, 'building_group_member'):
        groups.setdefault(r['group_id'], set()).add(r['facility_id'])
    group_pending = set().union(*(ids for ids in groups.values() if ids & pending))

    places = []
    for f in facilities:
        current = decisions.get(f['id'])
        place = dict(id=f['id'], legacyIds=legacy.get(f['id'], []), name=f['name'], address=f['address'],
                     phone=f['phone'])
        place['evidence'] = evidence_json(current['evidence_id'] if current else f['identity_evidence_id'])
        held = f['id'] in pending or f['id'] in group_pending
        if current is not None and current['lat'] is not None and not held:
            place['coordinate'] = dict(lat=current['lat'], lng=current['lng'])
        if current is not None and current['reason'] is not None:
            review = dict(status='withdrawn' if current['action'] == 'withdraw' else 'confirmed',
                          addressStatus=current['address_status'], reason=current['reason'],
                          decisionId=current['decision_id'], reviewedAt=current['reviewed_at'],
                          sourceVersion=current['source_version'], reviewDue=current['review_due'])
            if held:
                review.update(status='needs-review', addressStatus='needs-review',
                              reason=PENDING_REASON if f['id'] in pending else GROUP_PENDING_REASON)
            place['locationReview'] = {k: v for k, v in review.items() if v is not None}
        places.append(place)
    places.sort(key=lambda p: p['id'])

    relations = []
    for r in table_rows(db, 'relation'):
        value = dict(cardId=r['card_id'], placeId=r['facility_id'], sourceHash=r['source_hash'],
                     hours=r['hours'], status=r['status'])
        if r['condition'] is not None:
            value['condition'] = r['condition']
        value['evidence'] = evidence_json(r['evidence_id'])
        if r['change_kind'] is not None:
            value['change'] = dict(kind=r['change_kind'], reason=r['change_reason'],
                                   previousPlaceIds=r['change_previous_place_ids'], raw=r['change_raw'])
        for key, column in [('validFrom', 'valid_from'), ('validTo', 'valid_to'),
                            ('reviewUntil', 'review_until'), ('maintenanceNotes', 'maintenance_notes')]:
            if r[column] is not None:
                value[key] = r[column]
        relations.append(((r['card_id'], r['facility_id'], r['valid_from'] or '', r['valid_to'] or '', r['id']),
                          value))
    relations.sort(key=lambda item: item[0])
    ledger = dict(schema=1, places=places, relations=[value for _, value in relations])
    return json.dumps(ledger, ensure_ascii=False, indent=2, allow_nan=False) + '\n'


def export_card_ids(db):
    return dict(ids=[r['id'] for r in table_rows(db, 'card')],
                aliases={r['old_id']: r['target_id'] for r in table_rows(db, 'card_alias')},
                excluded={r['card_id']: r['reason'] for r in table_rows(db, 'card_excluded')})


def with_card_ids(rows, registry):
    """Rows whose card tables hold data/card-ids.json, which builddata -update-card-ids writes."""
    return dict(rows, card=[dict(id=v) for v in registry['ids']],
                card_alias=[dict(old_id=k, target_id=v) for k, v in registry['aliases'].items()],
                card_excluded=[dict(card_id=k, reason=v) for k, v in registry['excluded'].items()])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    commands = parser.add_subparsers(dest='command', required=True)
    build_parser = commands.add_parser('build', help='check row files and create a SQLite file')
    target = build_parser.add_mutually_exclusive_group()
    target.add_argument('--out', type=Path, help=f'default: {DEFAULT_DB}')
    target.add_argument('--check', action='store_true', help='build in memory only')
    dump_parser = commands.add_parser('dump', help='write row files from a SQLite file')
    dump_parser.add_argument('--db', type=Path, default=None, help=f'default: {DEFAULT_DB}')
    export_parser = commands.add_parser('export-ledger', help='write PlaceLedger schema 1 JSON')
    export_parser.add_argument('--db', type=Path, help='default: build from row files in memory')
    export_parser.add_argument('--out', type=Path, help='default: stdout')
    summary_parser = commands.add_parser('summary', help='write counts and queues from the tables as JSON')
    summary_parser.add_argument('--as-of', required=True, type=dt.date.fromisoformat, help='reference date')
    summary_parser.add_argument('--db', type=Path, help='default: build from row files in memory')
    summary_parser.add_argument('--out', type=Path, help='default: stdout')
    commands.add_parser('import-card-ids', help='replace the card tables with data/card-ids.json')
    fingerprint_parser = commands.add_parser(
        'fingerprint', help="print a facility's decision digests and a template of its next decision row")
    fingerprint_parser.add_argument('facility', help='facility ID')
    fingerprint_parser.add_argument('--db', type=Path, help='read an edited SQLite file without checking it '
                                    '(default: row files)')
    # Allow `build --root X` as well as `--root X build`.
    for sub in (build_parser, dump_parser, export_parser, summary_parser, fingerprint_parser,
                commands.choices['import-card-ids']):
        sub.add_argument('--root', type=Path, default=argparse.SUPPRESS)
    args = parser.parse_args()
    try:
        if args.command == 'build':
            build(args.root, None if args.check else args.out or args.root / DEFAULT_DB).close()
        elif args.command == 'dump':
            with closing(read_database(args.db or args.root / DEFAULT_DB)) as database:
                dump(database, args.root / ROWS)
        elif args.command == 'import-card-ids':
            registry = json.loads((args.root / 'data/card-ids.json').read_text(encoding='utf-8'))
            with closing(load(with_card_ids(read_rows(args.root), registry))) as database:
                dump(database, args.root / ROWS)
        elif args.command == 'fingerprint':
            rows = raw_rows(args.db) if args.db else read_rows(args.root)
            json.dump(fingerprints(rows, args.facility), sys.stdout, ensure_ascii=False, indent=2)
            sys.stdout.write('\n')
        else:
            with closing(read_database(args.db) if args.db else build(args.root)) as database:
                if args.command == 'summary':
                    text = json.dumps(summary(database, args.as_of.isoformat()), ensure_ascii=False, indent=2) + '\n'
                else:
                    text = export_ledger(database)
            if args.out:
                args.out.write_text(text, encoding='utf-8')
            else:
                sys.stdout.write(text)
    except (LedgerError, sqlite3.DatabaseError, OSError) as error:
        parser.exit(1, f'ledger database: {error}\n')


if __name__ == '__main__':
    main()
