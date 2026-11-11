"""One-off migration: copy location research and source reviews from data/national into data/db.

Delete it with data/national in stage C2. Research rows are copied for facilities without a
current location only; text is copied as written, never summarized or completed. Records whose
fields cannot be read mechanically are left out and listed by --report.
Running it twice leaves the row files unchanged.
"""
import argparse
from contextlib import closing
import json
from pathlib import Path
import sys

import ledgerdb as db

ISSUE7 = ['chugoku', 'hokkaido', 'hokuriku', 'kinki-east', 'kinki-west', 'koshin', 'kyushu-okinawa',
          'north-kanto', 'shikoku', 'tohoku', 'tokai']
BATCH2 = ['chugoku', 'hokkaido', 'hokuriku', 'kinki-east', 'kinki-west', 'koshin', 'kyushu-okinawa',
          'shikoku', 'tohoku', 'tokai']
# Final outcome records of each work unit that mention a facility without a location at d5402e11:
# (file, pointer to the list, explicit column mapping).
# Without a mapping, a column takes the one key of GENERIC present in the record.
SOURCES = (
    [(f'data/national/issue7/{name}.json', '/unresolved',
      dict(status='investigationStatus', blockers='reasonCategory', finding='reason'))
     for name in ISSUE7]
    + [(f'data/national/issue16/group-{g}-outcomes.json', '/outcomes', None) for g in 'ab']
    + [('data/national/issue20/north-outcomes.json', '/groups', None),
       ('data/national/issue25/investigation.json', '', None),
       ('data/national/issue26/outcomes.json', '/outcomes', None),
       ('data/national/issue27/outcomes.json', '/facilities', None),
       ('data/national/issue57/pilot-outcomes.json', '/rows', None),
       ('data/national/location-batch1/kinki-outcomes.json', '/rows', None),
       ('data/national/location-batch1/west-outcomes.json', '/outcomes', None)]
    + [(f'data/national/location-batch2/{name}/outcomes.json', '/rows', None) for name in BATCH2]
    + [('data/national/issue76/gunma/assessment.json', '/outcomes',
        dict(status='recommendation', finding='positionSuitability/buildingAssessment', next_action='nextAction')),
       ('data/national/kanto-prefecture/gunma/outcomes.json', '/facilities', None),
       ('data/national/kanto-prefecture/gunma/round2-outcomes.json', '/facilities', None),
       ('data/national/kanto-prefecture/gunma/south/outcomes.json', '/facilities', None)])
GENERIC = dict(
    status=('status', 'decision'), stage=('stage',), blockers=('blockers', 'stopCategories'),
    finding=('finding', 'findings', 'result', 'conclusion', 'facts'),
    stop_condition=('stopCondition', 'stop', 'stopReason'),
    resume_condition=('resumeCondition', 'resume', 'resumeWhen', 'resumeConditions'),
    next_action=('nextAction',))
# The date a record was written: its own field, else the file's end time, else the file's base date.
RECORD_DATES = ('checkedAt', 'endedAt')
FILE_DATES = ('endedAt', 'finishedAt', 'researchFinishedAt', 'assessmentDate', 'asOf')
RESEARCH_TABLES = ('location_research',)
REVIEW_TABLES = ('source_review', 'source_review_evidence', 'source_review_target')


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def resolve(document, pointer):
    value = document
    for part in filter(None, pointer.split('/')):
        value = value[int(part)] if isinstance(value, list) else value[part]
    return value


def unlocated(rows):
    current = {}
    for d in sorted(rows['location_decision'], key=lambda d: (d['facility_id'], d['seq'])):
        current[d['facility_id']] = d['action']
    return {f['id'] for f in rows['facility'] if current.get(f['id'], 'withdraw') == 'withdraw'}


def text(value):
    """A string, or a list of strings joined by newlines; anything else is unreadable."""
    if isinstance(value, str) and value.strip():
        return value
    if isinstance(value, list) and value and all(isinstance(v, str) and v.strip() and '\n' not in v
                                                 for v in value):
        return '\n'.join(value)
    return None


def research_rows(root, targets):
    rows, skipped = [], []
    for path, pointer, mapping in SOURCES:
        document = read_json(root / path)
        records = resolve(document, pointer)
        records = list(enumerate(records)) if isinstance(records, list) else [(None, records)]
        work_unit = path.split('/')[2]
        file_date = next((document[k] for k in FILE_DATES if isinstance(document.get(k), str)), None)
        for index, record in records:
            ids = [record['facilityId']] if isinstance(record.get('facilityId'), str) else record.get('facilityIds')
            ref = f'{path}#{pointer}' + ('' if index is None else f'/{index}')
            if not isinstance(ids, list):
                skipped.append((ref, None, 'no facilityId or facilityIds'))
                continue
            for fid in ids:
                if fid not in targets:
                    continue
                row = dict(facility_id=fid, source_ref=ref, work_unit=work_unit,
                           researched_at=next((record[k] for k in RECORD_DATES if isinstance(record.get(k), str)),
                                              file_date))
                for column, keys in GENERIC.items():
                    keys = [mapping[column]] if mapping and column in mapping else [] if mapping else keys
                    present = [k for k in keys if k.split('/')[0] in record]
                    if len(present) > 1:
                        raise db.LedgerError(f'{ref}: {column} could come from {", ".join(present)}')
                    value = resolve(record, present[0]) if present else None
                    if column == 'blockers' and isinstance(value, str):
                        value = [value]
                    if column == 'blockers' and value is not None and not (
                            isinstance(value, list) and all(isinstance(v, str) and v.strip() for v in value)):
                        value = None
                        skipped.append((ref, fid, f'{column} from {present[0]} is not a list of strings'))
                    elif column != 'blockers' and value is not None:
                        readable = text(value)
                        if readable is None:
                            skipped.append((ref, fid, f'{column} from {present[0]} is not text'))
                        value = readable
                    row[column] = value
                rows.append(row)
    return rows, skipped


def review_rows(root, rows):
    registry = read_json(root / 'data/national/source-review/registry.json')
    reviews, evidence, targets = [], [], []
    with closing(db.load({t: v for t, v in rows.items() if t not in REVIEW_TABLES + RESEARCH_TABLES})) as database:
        places = {p['id']: p for p in json.loads(db.export_ledger(database))['places']}
    decisions = {}
    for d in sorted(rows['location_decision'], key=lambda d: (d['facility_id'], d['seq'])):
        decisions.setdefault(d['facility_id'], []).append(d)
    for r in registry['reviews']:
        reviews.append(dict(id=r['id'], source_name=r['source']['name'], source_version=r['source']['version'],
                            source_derivation=r['source']['derivation'], status=r['status'],
                            checked_at=r['checkedAt'], actor_type=r['actorType'], conditions=r['conditions'],
                            notes=r.get('notes')))
        evidence.extend(dict(review_id=r['id'], position=i, url=e['url'], locator=e['locator'],
                             checked_at=e['checkedAt']) for i, e in enumerate(r['evidence']))
        for s in r['selectors']:
            history = decisions.get(s['facilityId'], [])
            # The record a selector names is either an approved adoption or the current ledger place.
            match = [d for d in history if d['adoption_sha256'] == s['recordSHA256']]
            if not match and history and db.digest(places[s['facilityId']]) == s['recordSHA256']:
                match = history[-1:]
            if not match:
                raise db.LedgerError(f'source review {r["id"]}: no decision for {s["facilityId"]}')
            targets.append(dict(facility_id=s['facilityId'], seq=match[0]['seq'], review_id=r['id'],
                                record_sha256=s['recordSHA256']))
    return dict(source_review=reviews, source_review_evidence=evidence, source_review_target=targets)


def migrate(root, out):
    rows = db.read_rows(root)
    research, skipped = research_rows(root, unlocated(rows))
    rows['location_research'] = research
    rows.update(review_rows(root, rows))
    with closing(db.load(rows)) as database:
        db.dump(database, out)
    return research, skipped


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=db.ROOT)
    parser.add_argument('--out', type=Path, help=f'default: <root>/{db.ROWS}')
    parser.add_argument('--report', action='store_true', help='print rows per work unit and skipped fields')
    args = parser.parse_args()
    try:
        research, skipped = migrate(args.root, args.out or args.root / db.ROWS)
    except (db.LedgerError, OSError, KeyError) as error:
        parser.exit(1, f'migration failed: {error}\n')
    if args.report:
        units = {}
        for r in research:
            units.setdefault(r['work_unit'], set()).add(r['facility_id'])
        json.dump(dict(rows=len(research), facilities=len({r['facility_id'] for r in research}),
                       facilitiesByWorkUnit={k: len(v) for k, v in sorted(units.items())},
                       skipped=[dict(ref=ref, facilityId=fid, reason=why) for ref, fid, why in skipped]),
                  sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write('\n')


if __name__ == '__main__':
    main()
