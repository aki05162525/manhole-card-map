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
# The fixed Issue 7 regions; their unresolved rows carry reasonCategory and reason.
ISSUE7_REGIONS = ISSUE7 + ['south-kanto', 'sakuragicho']
# tools/national/national_audit.py REASONS: the labels whose adopted locations it queues for reconfirmation.
RECHECK_LABELS = ['relocation', 'relocation-or-building-identity', 'relocation-or-multiple-buildings',
                  'relocation-or-separate-building', '移転・別棟', '移転・別棟・住所競合', '移転・旧新地点の対応未確定',
                  '移転別棟', 'coordinate-conflict', '座標競合']
NEXT_SOURCE_COLUMNS = dict(url='next_source_url', urls='next_source_urls', required='next_source_required',
                           needed='next_source_needed', task='next_source_task', notRequired='next_source_not_required')
# Answers people gave: (file, pointer to the list, answer field, question field, record and file date fields).
ANSWERS = [
    ('data/national/issue57/human-responses.json', '/responses', ('answer',), 'receivedQuestionSummary',
     ('checkedAt',), ()),
    ('data/national/kanto-prefecture/gunma/round2-human-responses.json', '/responses', ('responseVerbatim', 'report'),
     'question', ('receivedAt',), ()),
    ('data/evidence/issue60/manual-user-additional/inputs/issue60-recheck-chiba-nov6/human-report.json', '/answers',
     ('reportedNarrative',), None, (), ('reportedConfirmationDate',)),
] + [(f'data/evidence/national/shizuoka-human-followup{n}-20261106/human-answers.json', '/responses', ('answer',),
      None, (), ('receivedAt',)) for n in ('', '3', '4', '5')]
NEW_TABLES = ('location_research', 'location_research_attempt', 'location_candidate', 'location_recheck',
              'user_answer', 'user_answer_facility', 'source_review', 'source_review_evidence', 'source_review_target')


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


def unit(path):
    """The work unit a file belongs to: the directory under data/national or data/evidence."""
    parts = path.split('/')
    return parts[3] if parts[2] == 'national' and parts[1] == 'evidence' else parts[2]


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
        work_unit = unit(path)
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
                row.update(dict.fromkeys(['next_source', *NEXT_SOURCE_COLUMNS.values()]))
                rows.append(row)
    return rows, skipped


def issue7_details(root, research, skipped):
    """nextSource under its own field names, and the attempts of each issue7 research row."""
    attempts = []
    for row in research:
        if row['work_unit'] != 'issue7':
            continue
        path, pointer = row['source_ref'].split('#')
        record = resolve(read_json(root / path), pointer)
        source = record.get('nextSource')
        if isinstance(source, str) and source.strip():
            row['next_source'] = source
        elif isinstance(source, dict) and set(source) <= set(NEXT_SOURCE_COLUMNS) and all(
                isinstance(v, str) or (k == 'urls' and isinstance(v, list)) for k, v in source.items()):
            row.update({NEXT_SOURCE_COLUMNS[k]: v for k, v in source.items()})
        elif source is not None:
            skipped.append((row['source_ref'], row['facility_id'], 'nextSource has other fields'))
        for position, attempt in enumerate(record.get('attempts') or []):
            pick = {}
            for column, keys in dict(kind=('kind', 'type'), source_url=('sourceUrl', 'url'),
                                     result=('result', 'outcome'), error=('error',),
                                     attempted_at=('fetchedAt', 'checkedAt'), snapshot_sha256=('snapshotSHA256',),
                                     http_status=('status',)).items():
                present = [k for k in keys if attempt.get(k) is not None]
                if len(present) > 1:
                    raise db.LedgerError(f'{row["source_ref"]} attempt {position}: {column} from {present}')
                pick[column] = attempt[present[0]] if present else None
            if not isinstance(pick['http_status'], (int, type(None))):
                skipped.append((row['source_ref'], row['facility_id'], f'attempt {position} status is not a number'))
                pick['http_status'] = None
            attempts.append(dict(facility_id=row['facility_id'], source_ref=row['source_ref'], position=position,
                                 **pick))
    return attempts


def candidate_rows(root, targets):
    """Unselected location updates, as tools/national/source_inventory.py lists candidates."""
    manifest = read_json(root / 'tools/national/manifest.json')
    paths = sorted({s['path'] for s in manifest['locations']} | {f'data/national/issue7/{r}.json' for r in ISSUE7_REGIONS})
    # Reviews that name the candidate file they read (input.path) and decide on each facility.
    reviews = {}
    for review_path in sorted((root / 'data/national/reviews').glob('*.json')) + sorted(
            (root / 'data/national/issue7/reviews').glob('*.json')):
        review = read_json(review_path)
        source = review.get('input', {}).get('path') if isinstance(review.get('input'), dict) else None
        if source:
            reviews.setdefault(source, []).append((review_path.relative_to(root).as_posix(), review))
    rows, seen = [], set()
    for path in paths:
        for index, update in enumerate(read_json(root / path)['updates']):
            fid = update['facilityId']
            key = (fid, db.digest(update))
            if fid not in targets or key in seen:
                continue
            seen.add(key)
            ev = update['evidence']
            row = dict(facility_id=fid, source_ref=f'{path}#/updates/{index}', work_unit=unit(path),
                       lat=update['coordinate']['lat'], lng=update['coordinate']['lng'], scope=update.get('scope'),
                       source_url=ev['sourceUrl'], source_locator=ev.get('sourceLocator'), checked_at=ev.get('checkedAt'),
                       review_ref=None, review_status=None, review_reason=None)
            for review_path, review in reviews.get(path, []):
                for name, items in review.items():
                    for i, item in enumerate(items if isinstance(items, list) else []):
                        if not (isinstance(item, dict) and item.get('facilityId') == fid):
                            continue
                        status = next((item[k] for k in ('decision', 'status') if isinstance(item.get(k), str)), None)
                        reason = next((item[k] for k in ('reason', 'finding') if isinstance(item.get(k), str)), None)
                        if status is not None and row['review_ref'] is None:
                            row.update(review_ref=f'{review_path}#/{name}/{i}', review_status=status,
                                       review_reason=reason)
            rows.append(row)
    return rows


def recheck_rows(root, targets):
    rows = []
    for region in ISSUE7_REGIONS:
        path = f'data/national/issue7/{region}.json'
        for index, record in enumerate(read_json(root / path)['unresolved']):
            if record['facilityId'] not in targets and record.get('reasonCategory') in RECHECK_LABELS:
                rows.append(dict(facility_id=record['facilityId'], source_ref=f'{path}#/unresolved/{index}',
                                 work_unit='issue7', kind=record['reasonCategory'], text=record['reason']))
    return rows


def answer_rows(root, facilities, skipped):
    answers, links = [], []
    for path, pointer, answer_keys, question_key, record_dates, file_dates in ANSWERS:
        document = read_json(root / path)
        file_date = next((document[k] for k in file_dates if isinstance(document.get(k), str)), None)
        for index, record in enumerate(resolve(document, pointer)):
            ref = f'{path}#{pointer}/{index}'
            ids = record.get('facilityIds') or [record['facilityId']]
            field = next((k for k in answer_keys if isinstance(record.get(k), str) and record[k].strip()), None)
            if field is None:
                skipped.append((ref, None, 'no answer text'))
                continue
            if not set(ids) <= facilities:
                skipped.append((ref, ', '.join(sorted(set(ids) - facilities)), 'facility is not in the ledger'))
                continue
            answers.append(dict(source_ref=ref, work_unit=unit(path), actor_type='human',
                                answered_at=next((record[k] for k in record_dates if isinstance(record.get(k), str)),
                                                 file_date),
                                question=record.get(question_key) if question_key else None,
                                answer=record[field], answer_field=field))
            links.extend(dict(source_ref=ref, facility_id=fid, position=i) for i, fid in enumerate(ids))
    return answers, links


def review_rows(root, rows):
    registry = read_json(root / 'data/national/source-review/registry.json')
    reviews, evidence, targets = [], [], []
    with closing(db.load({t: v for t, v in rows.items() if t not in NEW_TABLES})) as database:
        places = {p['id']: p for p in json.loads(db.export_ledger(database))['places']}
    decisions = {}
    for d in sorted(rows['location_decision'], key=lambda d: (d['facility_id'], d['seq'])):
        decisions.setdefault(d['facility_id'], []).append(d)
    for r in registry['reviews']:
        reviews.append(dict(id=r['id'], source_name=r['source']['name'], source_version=r['source']['version'],
                            source_derivation=r['source']['derivation'], status=r['status'],
                            checked_at=r['checkedAt'], actor_type=r['actorType'], conditions=r['conditions'],
                            notes=r.get('notes'), selection_review=r.get('selectionReview')))
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
    targets = unlocated(rows)
    research, skipped = research_rows(root, targets)
    rows['location_research'] = research
    rows['location_research_attempt'] = issue7_details(root, research, skipped)
    rows['location_candidate'] = candidate_rows(root, targets)
    rows['location_recheck'] = recheck_rows(root, targets)
    rows['user_answer'], rows['user_answer_facility'] = answer_rows(root, {f['id'] for f in rows['facility']}, skipped)
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
