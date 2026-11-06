"""Generate a current residual index without rewriting historical research."""
import argparse
import hashlib
import json
from pathlib import Path

from assemble import assemble, read_json
from issue76_adoption import approved_ids

HISTORY = 'data/national/issue57/remaining-index.json'
MANIFEST = 'tools/national/manifest.json'


def unique_rows(rows, key, label):
    result = {row[key]: row for row in rows}
    if len(result) != len(rows):
        raise ValueError('duplicate ' + label)
    return result


def remaining_rows(ledger, historical, assessments, approved):
    places = unique_rows(ledger['places'], 'id', 'ledger facility')
    history = unique_rows(historical['facilities'], 'facilityId', 'historical facility')
    history_indexes = {row['facilityId']: i for i, row in enumerate(historical['facilities'])}
    for fid in approved:
        if fid not in places or places[fid].get('coordinate') is None:
            raise ValueError('approval not applied: ' + fid)
    for fid, item in assessments.items():
        if fid not in places:
            raise ValueError('assessed facility missing: ' + fid)
        if fid not in approved:
            if item['row']['recommendation'] != 'hold':
                raise ValueError('unresolved adoption review: ' + fid)
            if places[fid].get('coordinate') is not None:
                raise ValueError('held facility already located: ' + fid)
    rows = []
    for fid, place in sorted(places.items()):
        if place.get('coordinate') is not None:
            continue
        if fid not in history:
            raise ValueError('missing historical facility: ' + fid)
        row = dict(facilityId=fid, name=place['name'], address=place['address'],
                   historyRef=f'{HISTORY}#/facilities/{history_indexes[fid]}')
        if fid in assessments:
            item = assessments[fid]
            source = item['row']
            reason = source['positionSuitability']['buildingAssessment']
            if isinstance(reason, dict):
                reason = reason['remainingGap']
            if not reason or not source['nextAction']:
                raise ValueError('held reason or next action missing: ' + fid)
            row.update(county=item['county'], status='held', reason=reason,
                       nextAction=source['nextAction'], assessmentRef=item['assessmentRef'],
                       reviewRef=item['reviewRef'])
        rows.append(row)
    return rows


def merge_assessment_packages(packages):
    """A reviewed followup may replace only its hash-bound, unapproved hold."""
    assessments, approved, sources = {}, set(), {}
    for package in packages:
        path, data = package['path'], package['data']
        county, outcomes = data['county'], data['outcomes']
        if path in sources:
            raise ValueError('duplicate assessment package: ' + path)
        selected = approved_ids(outcomes, package['common'], package['review'])
        supersedes = data.get('supersedes')
        if supersedes is not None:
            prior = sources.get(supersedes.get('assessmentPath'))
            if (prior is None or prior['sha256'] != supersedes.get('assessmentSHA256') or
                    prior['data']['county'] != county):
                raise ValueError('followup source, hash or county mismatch: ' + path)
        for i, row in enumerate(outcomes):
            fid = row['facilityId']
            previous = assessments.get(fid)
            if supersedes is not None:
                if (previous is None or previous['assessmentPath'] != supersedes['assessmentPath'] or
                        previous['county'] != county):
                    raise ValueError('followup does not replace its source row: ' + fid)
                if previous['row']['recommendation'] != 'hold' or fid in approved:
                    raise ValueError('followup may replace only an unapproved hold: ' + fid)
                if fid not in selected:
                    raise ValueError('followup replacement requires explicit approval: ' + fid)
            elif previous is not None:
                raise ValueError('duplicate county assessment: ' + fid)
            assessments[fid] = dict(county=county, row=row, assessmentPath=path,
                assessmentRef=f'{path}#/outcomes/{i}',
                reviewRef=str(Path(path).with_name('review.json')))
        approved.update(selected)
        sources[path] = package
    counties = {}
    for fid, item in assessments.items():
        count = counties.setdefault(item['county'], dict(assessed=0, adopted=0, held=0))
        count['assessed'] += 1
        count['adopted' if fid in approved else 'held'] += 1
    return assessments, approved, counties


def build(root):
    paths = {HISTORY, MANIFEST}
    manifest = read_json(root / MANIFEST)
    ledger, _ = assemble(root, manifest)
    packages = []
    for path in sorted((root / 'data/national/issue76').rglob('assessment.json')):
        relative = path.relative_to(root).as_posix()
        review_path = path.parent / 'review.json'
        package_path = path.parent / 'review-inputs.json'
        paths.update((relative, review_path.relative_to(root).as_posix(),
                      package_path.relative_to(root).as_posix()))
        packages.append(dict(path=relative, data=read_json(path),
            sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
            review=read_json(review_path), common=read_json(package_path)['common']))
    assessments, approved, counties = merge_assessment_packages(packages)
    rows = remaining_rows(ledger, read_json(root / HISTORY), assessments, approved)
    return dict(schema=1, sourceDataAsOf='2026-11-05', adoptionReviewDate='2026-11-06',
        scope='National ledger facilities without coordinates after Issue76 adoption; not public pin counts or a new distribution survey.',
        summary=dict(ledgerFacilities=len(ledger['places']), remaining=len(rows),
                     issue76Assessed=len(assessments), issue76Adopted=len(approved),
                     kantoHeld=sum('assessmentRef' in r for r in rows),
                     otherRemaining=sum('assessmentRef' not in r for r in rows)),
        counties=counties,
        inputSHA256={p: hashlib.sha256((root / p).read_bytes()).hexdigest() for p in sorted(paths)},
        facilities=rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--out', type=Path, help='New output file; existing files are never overwritten.')
    group.add_argument('--check', type=Path, help='Read-only comparison with a saved index.')
    args = parser.parse_args()
    result = build(args.root.resolve())
    if args.check:
        if result != read_json(args.check):
            raise SystemExit('remaining index differs from current inputs')
    else:
        with args.out.open('x', encoding='utf-8') as stream:
            json.dump(result, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
    print(json.dumps(result['summary'], ensure_ascii=False))


if __name__ == '__main__':
    main()
