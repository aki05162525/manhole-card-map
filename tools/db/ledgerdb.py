"""Build the ledger database from data/db row files, write rows back, and export JSON."""
import argparse
from contextlib import closing
import datetime as dt
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

# Cross-row rules that CHECK constraints cannot express. Each query yields table, key and message.
CROSS_ROW_CHECKS = [
    ("""SELECT 'location_decision', facility_id, seq, 'has no previous decision' FROM location_decision d
        WHERE seq > 1 AND NOT EXISTS (SELECT 1 FROM location_decision p
                                      WHERE p.facility_id = d.facility_id AND p.seq = d.seq - 1)"""),
    # A decision without a date dates from its evidence; the date part of a timestamp is its day.
    ("""SELECT 'location_decision', d.facility_id, d.seq, 'must follow the previous decision in date order'
        FROM location_decision d JOIN location_decision p ON p.facility_id = d.facility_id AND p.seq = d.seq - 1
        JOIN evidence e ON e.id = p.evidence_id
        WHERE d.reviewed_at < coalesce(p.reviewed_at, substr(e.checked_at, 1, 10))"""),
    ("""SELECT 'location_decision', d.facility_id, d.seq, 'decision predates its evidence'
        FROM location_decision d JOIN evidence e ON e.id = d.evidence_id
        WHERE d.reviewed_at < substr(e.checked_at, 1, 10)"""),
    ("""SELECT 'location_decision', d.facility_id, d.seq, 'reaffirm must keep and correct must change the coordinate'
        FROM location_decision d JOIN location_decision p ON p.facility_id = d.facility_id AND p.seq = d.seq - 1
        WHERE (d.action = 'reaffirm' AND (d.lat IS NOT p.lat OR d.lng IS NOT p.lng))
           OR (d.action = 'correct' AND d.lat IS p.lat AND d.lng IS p.lng)"""),
    # Periods of one card and facility must not overlap; an empty bound is open.
    ("""SELECT DISTINCT 'relation', a.id, NULL, 'overlapping periods of one card and facility'
        FROM relation a JOIN relation b ON b.card_id = a.card_id AND b.facility_id = a.facility_id AND b.id <> a.id
        WHERE ifnull(a.valid_from, '') <= ifnull(b.valid_to, '9999-12-31')
          AND ifnull(b.valid_from, '') <= ifnull(a.valid_to, '9999-12-31')"""),
    ("""SELECT 'card_alias', old_id, NULL, 'alias target is an alias, or the alias is excluded' FROM card_alias
        WHERE target_id IN (SELECT old_id FROM card_alias) OR old_id IN (SELECT card_id FROM card_excluded)"""),
    ("""SELECT 'building_group', id, NULL, 'needs at least two members' FROM building_group g
        WHERE (SELECT count(*) FROM building_group_member WHERE group_id = g.id) < 2"""),
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
    ("""SELECT 'source_review', id, NULL, 'needs evidence' FROM source_review r
        WHERE NOT EXISTS (SELECT 1 FROM source_review_evidence WHERE review_id = r.id)"""),
    ("""SELECT 'source_review_evidence', e.review_id, e.url, 'evidence is checked after its review'
        FROM source_review_evidence e JOIN source_review r ON r.id = e.review_id WHERE e.checked_at > r.checked_at"""),
]

# Temporary views the summary reads.
SUMMARY_VIEWS = '''
CREATE TEMP VIEW current_decision AS
  SELECT d.* FROM location_decision d
  WHERE d.seq = (SELECT max(seq) FROM location_decision WHERE facility_id = d.facility_id);
CREATE TEMP VIEW facility_location AS
  SELECT f.id AS facility_id,
         CASE WHEN c.facility_id IS NULL THEN 'none'
              WHEN c.action = 'withdraw' THEN 'withdrawn'
              ELSE 'located' END AS state
  FROM facility f LEFT JOIN current_decision c ON c.facility_id = f.id;
'''
# Current counts and the rows that need work, from the tables and views only; :as_of is the reference date.
SUMMARY_QUERIES = dict(
    facilitiesByLocation='SELECT state, count(*) FROM facility_location GROUP BY state',
    relationsByStatus='SELECT status, count(*) FROM relation GROUP BY status',
    relationsPastReviewUntil='''SELECT id, card_id, facility_id, review_until FROM relation
        WHERE review_until < :as_of ORDER BY review_until, id''',
    # Research and candidate rows exist only for facilities without a current location (CROSS_ROW_CHECKS).
    unlocatedWithoutResearch='''SELECT facility_id FROM facility_location l
        WHERE state IN ('none', 'withdrawn')
          AND NOT EXISTS (SELECT 1 FROM location_research WHERE facility_id = l.facility_id) ORDER BY facility_id''',
    unlocatedWithResearch='SELECT count(DISTINCT facility_id) FROM location_research',
    unlocatedWithNextSource='''SELECT count(DISTINCT facility_id) FROM location_research
        WHERE coalesce(next_source, next_source_urls) IS NOT NULL''',
    unlocatedWithCandidates='SELECT count(DISTINCT facility_id) FROM location_candidate',
    rechecksByKind='SELECT kind, count(*) FROM location_recheck GROUP BY kind',
    recheckFacilities='SELECT count(DISTINCT facility_id) FROM location_recheck',
    unlocatedWithUserAnswers='''SELECT count(DISTINCT f.facility_id) FROM user_answer_facility f
        JOIN facility_location l ON l.facility_id = f.facility_id WHERE l.state IN ('none', 'withdrawn')''',
    sourceReviewsByStatus='SELECT status, count(*) FROM source_review GROUP BY status',
    # Located facilities by the status of the source review that read their current decision.
    locatedBySourceReviewStatus='''SELECT coalesce(r.status, 'none'), count(*) FROM current_decision c
        JOIN facility_location l ON l.facility_id = c.facility_id
        LEFT JOIN source_review_target t ON t.facility_id = c.facility_id AND t.seq = c.seq
        LEFT JOIN source_review r ON r.id = t.review_id
        WHERE l.state = 'located' GROUP BY 1''',
)


class LedgerError(ValueError):
    pass


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
    path = Path(path)
    if not path.is_file():
        raise LedgerError(f'missing database: {path}')
    with closing(sqlite3.connect(f'{path.resolve().as_uri()}?mode=ro', uri=True)) as source:
        return load({table: list(table_rows(source, table)) for table in tables(source)})


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


def evidence_object(r):
    """Ledger evidence with the date of checked_at. snapshotPath is absent when the original was never in Git."""
    evidence = dict(sourceUrl=r['source_url'], snapshotPath=r['legacy_snapshot_path'],
                    snapshotSHA256=r['snapshot_sha256'], sourceLocator=r['source_locator'],
                    checkedAt=r['checked_at'][:10], actorType=r['actor_type'],
                    verificationMethod=r['verification_method'])
    if evidence['snapshotPath'] is None:
        del evidence['snapshotPath']
    return evidence


def summary(db, as_of):
    """Counts and queues from the tables alone (SUMMARY_QUERIES), evaluated at as_of."""
    db.executescript(SUMMARY_VIEWS)
    try:
        def run(name):
            return db.execute(SUMMARY_QUERIES[name], dict(as_of=as_of)).fetchall()

        def counts(name):
            return {key if key is not None else 'null': n for key, n in run(name)}

        located = counts('facilitiesByLocation')
        overdue_relations = [dict(id=i, cardId=c, facilityId=f, reviewUntil=d)
                             for i, c, f, d in run('relationsPastReviewUntil')]
        without = [f for (f,) in run('unlocatedWithoutResearch')]

        def one(name):
            return run(name)[0][0]

        return dict(
            schema=1, asOf=as_of,
            facilities=dict(total=sum(located.values()), byLocation=located),
            relations=dict(byStatus=counts('relationsByStatus'), pastReviewUntil=len(overdue_relations),
                           pastReviewUntilRows=overdue_relations),
            unlocated=dict(withResearch=one('unlocatedWithResearch'), withNextSource=one('unlocatedWithNextSource'),
                           withCandidates=one('unlocatedWithCandidates'),
                           withUserAnswers=one('unlocatedWithUserAnswers'),
                           withoutResearch=len(without), withoutResearchIds=without),
            locationRechecks=dict(facilities=one('recheckFacilities'), byKind=counts('rechecksByKind')),
            sourceReviews=dict(byStatus=counts('sourceReviewsByStatus'),
                               locatedByStatus=counts('locatedBySourceReviewStatus')))
    finally:
        db.executescript('DROP VIEW temp.facility_location; DROP VIEW temp.current_decision;')


def export_ledger(db):
    """PlaceLedger schema 1 JSON, the ledger that cmd/builddata reads."""
    evidence = {r['id']: r for r in table_rows(db, 'evidence')}
    legacy, decisions = {}, {}
    for r in table_rows(db, 'facility_legacy_id'):
        legacy.setdefault(r['facility_id'], []).append(r['legacy_id'])
    for r in table_rows(db, 'location_decision'):
        decisions[r['facility_id']] = r  # seq order: the last row is current

    def evidence_json(ev_id):
        return evidence_object(evidence[ev_id])

    facilities = list(table_rows(db, 'facility'))
    places = []
    for f in facilities:
        current = decisions.get(f['id'])
        place = dict(id=f['id'], legacyIds=legacy.get(f['id'], []), name=f['name'], address=f['address'],
                     phone=f['phone'])
        place['evidence'] = evidence_json(current['evidence_id'] if current else f['identity_evidence_id'])
        if current is not None and current['lat'] is not None:
            place['coordinate'] = dict(lat=current['lat'], lng=current['lng'])
        if current is not None and current['reason'] is not None:
            review = dict(status='withdrawn' if current['action'] == 'withdraw' else 'confirmed',
                          reason=current['reason'], reviewedAt=current['reviewed_at'],
                          sourceVersion=current['source_version'])
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
    # Allow `build --root X` as well as `--root X build`.
    for sub in (build_parser, dump_parser, export_parser, summary_parser, commands.choices['import-card-ids']):
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
