"""Build the ledger database from data/db row files, write rows back, and export JSON."""
import argparse
from contextlib import closing
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = Path(__file__).with_name('schema.sql')
ROWS = 'data/db'
DEFAULT_DB = 'data/work/ledger.sqlite3'

EVIDENCE_KEYS = ('sourceUrl', 'snapshotPath', 'snapshotSHA256', 'sourceLocator', 'checkedAt',
                 'actorType', 'verificationMethod')
FACILITY_KEYS = ('id', 'legacyIds', 'name', 'address', 'phone', 'evidence', 'coordinate', 'locationReview')
RELATION_KEYS = ('cardId', 'placeId', 'sourceHash', 'hours', 'status', 'condition', 'evidence', 'change',
                 'validFrom', 'validTo', 'reviewUntil', 'maintenanceNotes')
PENDING_REASON = 'Facility identity changed since location review'
GROUP_PENDING_REASON = 'A reviewed building group member changed identity'
ADOPTION_KEYS = ('facilityId', 'coordinate', 'evidence', 'scope')
# Reasons location_lifecycle.py derives for a bound adoption; manual ones come from
# tools/national/manual_user_approval.py, which ties each scope to its facilities.
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
    ("""SELECT 'building_group', id, NULL, 'needs at least two members' FROM building_group g
        WHERE (SELECT count(*) FROM building_group_member WHERE group_id = g.id) < 2"""),
    ("""SELECT 'building_group_member', group_id, NULL, 'positions must be 0..n-1' FROM building_group_member
        GROUP BY group_id HAVING max(position) <> count(*) - 1"""),
    ("""SELECT 'building_group_member', facility_id, NULL, 'member needs a reviewed location adoption'
        FROM building_group_member m WHERE NOT EXISTS (
          SELECT 1 FROM location_decision WHERE facility_id = m.facility_id AND seq = 1 AND reason IS NOT NULL)"""),
    ("""SELECT 'assemble_key_order', entity, id, 'refers to a missing row' FROM assemble_key_order k
        WHERE NOT EXISTS (SELECT 1 FROM facility WHERE k.entity = 'facility' AND id = k.id)
          AND NOT EXISTS (SELECT 1 FROM relation WHERE k.entity = 'relation' AND id = k.id)"""),
]


class LedgerError(ValueError):
    pass


def evidence_id(row):
    """Content-derived ID. legacy_snapshot_path is excluded so dropping it keeps IDs."""
    content = [row[k] for k in ('source_url', 'snapshot_sha256', 'source_locator', 'checked_at',
                                'actor_type', 'verification_method')]
    return 'evidence:' + hashlib.sha256(
        json.dumps(content, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()[:24]


def digest(value):
    """The digest tools/national/location_lifecycle.py and the manifest use."""
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
                rows[table].append(json.loads(line))
            except json.JSONDecodeError as error:
                raise LedgerError(f'{table} line {number}: {error}') from None
    return rows


def load(rows):
    """Insert rows into a new in-memory database and report every violation."""
    db = empty_database()
    db.execute('PRAGMA foreign_keys = OFF')
    errors = [f'{table}: not in tools/db/schema.sql' for table in sorted(set(rows) - set(tables(db)))]
    for table in tables(db):
        cols, key, as_json = columns(db, table), primary_key(db, table), json_columns(db, table)
        statement = f'INSERT INTO {table} ({", ".join(cols)}) VALUES ({", ".join("?" * len(cols))})'
        for number, row in enumerate(rows.get(table, []), 1):
            if not isinstance(row, dict) or set(row) != set(cols):
                errors.append(f'{table} line {number}: columns must be exactly {", ".join(cols)}')
                continue
            label = f'{table} {tuple(row[k] for k in key)}'
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
    source = sqlite3.connect(f'{path.resolve().as_uri()}?mode=ro', uri=True)
    try:
        return load({table: list(table_rows(source, table)) for table in tables(source)})
    finally:
        source.close()


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
    """The location lifecycle state after a reviewed decision; its digest chains the next row."""
    return dict(identity=dict(name=decision['identity_name'], address=decision['identity_address']),
                coordinate=None if decision['lat'] is None else dict(lat=decision['lat'], lng=decision['lng']),
                evidence=evidence_object(evidence, day=True),
                status='withdrawn' if decision['action'] == 'withdraw' else 'confirmed',
                addressStatus=decision['address_status'], reason=decision['reason'],
                decisionId=decision['decision_id'] or '', reviewedAt=decision['reviewed_at'],
                sourceVersion=decision['source_version'] or '', reviewDue=decision['review_due'] or '')


def history_errors(db):
    """Digest chain and evidence dates of location decisions, as location_lifecycle.py checks them."""
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


def ordered(value, default, stored):
    keys = [k for k in stored or () if k in value]
    keys += [k for k in default if k in value and k not in keys]
    return {k: value[k] for k in keys}


def checked_day(value):
    if len(value) == 10:
        return value
    return dt.datetime.fromisoformat(value.replace('Z', '+00:00')).date().isoformat()


def export_ledger(db):
    """PlaceLedger schema 1, serialized as tools/national/assemble.py does."""
    evidence = {r['id']: r for r in table_rows(db, 'evidence')}
    legacy, decisions, orders = {}, {}, {}
    for r in sorted(table_rows(db, 'facility_legacy_id'), key=lambda r: r['position']):
        legacy.setdefault(r['facility_id'], []).append(r['legacy_id'])
    for r in table_rows(db, 'location_decision'):
        decisions[r['facility_id']] = r  # seq order: the last row is current
    for r in table_rows(db, 'assemble_key_order'):
        orders[(r['entity'], r['id'])] = r

    def evidence_json(ev_id, order):
        return ordered(evidence_object(evidence[ev_id], day=True), EVIDENCE_KEYS, order.get('evidence_keys'))

    facilities = list(table_rows(db, 'facility'))
    # Same rule as location_lifecycle.py: an identity change holds the facility and its building group.
    pending = {f['id'] for f in facilities if (c := decisions.get(f['id'])) is not None and c['reason'] is not None
               and (c['identity_name'], c['identity_address']) != (f['name'], f['address'])}
    groups = {}
    for r in table_rows(db, 'building_group_member'):
        groups.setdefault(r['group_id'], set()).add(r['facility_id'])
    group_pending = set().union(*(ids for ids in groups.values() if ids & pending))

    places = []
    for f in facilities:
        order = orders.get(('facility', f['id']), {})
        current = decisions.get(f['id'])
        place = dict(id=f['id'], legacyIds=legacy.get(f['id'], []), name=f['name'], address=f['address'],
                     phone=f['phone'])
        place['evidence'] = evidence_json(current['evidence_id'] if current else f['identity_evidence_id'], order)
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
        places.append(ordered(place, FACILITY_KEYS, order.get('row_keys')))
    places.sort(key=lambda p: p['id'])

    relations = []
    for r in table_rows(db, 'relation'):
        order = orders.get(('relation', r['id']), {})
        value = dict(cardId=r['card_id'], placeId=r['facility_id'], sourceHash=r['source_hash'],
                     hours=r['hours'], status=r['status'], evidence=evidence_json(r['evidence_id'], order))
        if r['condition'] is not None:
            value['condition'] = r['condition']
        if r['change_kind'] is not None:
            value['change'] = dict(kind=r['change_kind'], reason=r['change_reason'],
                                   previousPlaceIds=r['change_previous_place_ids'], raw=r['change_raw'])
        for key, column in [('validFrom', 'valid_from'), ('validTo', 'valid_to'),
                            ('reviewUntil', 'review_until'), ('maintenanceNotes', 'maintenance_notes')]:
            if r[column] is not None:
                value[key] = r[column]
        relations.append(((r['card_id'], r['facility_id'], r['valid_from'] or '', r['valid_to'] or '', r['id']),
                          ordered(value, RELATION_KEYS, order.get('row_keys'))))
    relations.sort(key=lambda item: item[0])
    ledger = dict(schema=1, places=places, relations=[value for _, value in relations])
    return json.dumps(ledger, ensure_ascii=False, indent=2, allow_nan=False) + '\n'


def export_card_ids(db):
    return dict(ids=[r['id'] for r in table_rows(db, 'card')],
                aliases={r['old_id']: r['target_id'] for r in table_rows(db, 'card_alias')},
                excluded={r['card_id']: r['reason'] for r in table_rows(db, 'card_excluded')})


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
    # Allow `build --root X` as well as `--root X build`.
    for sub in (build_parser, dump_parser, export_parser):
        sub.add_argument('--root', type=Path, default=argparse.SUPPRESS)
    args = parser.parse_args()
    try:
        if args.command == 'build':
            build(args.root, None if args.check else args.out or args.root / DEFAULT_DB).close()
        elif args.command == 'dump':
            with closing(read_database(args.db or args.root / DEFAULT_DB)) as database:
                dump(database, args.root / ROWS)
        else:
            with closing(read_database(args.db) if args.db else build(args.root)) as database:
                text = export_ledger(database)
            if args.out:
                args.out.write_text(text, encoding='utf-8')
            else:
                sys.stdout.write(text)
    except (LedgerError, sqlite3.DatabaseError, OSError) as error:
        parser.exit(1, f'ledger database: {error}\n')


if __name__ == '__main__':
    main()
