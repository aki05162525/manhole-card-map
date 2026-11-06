"""Offline Issue7 assignment, explicit adoption, and optional generation audit."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

from assemble import coordinate, repo_path, unique_object


REGIONS = ('hokkaido', 'tohoku', 'north-kanto', 'south-kanto', 'hokuriku',
           'koshin', 'tokai', 'kinki-east', 'kinki-west', 'chugoku', 'shikoku',
           'kyushu-okinawa', 'sakuragicho')
DEFINITIONS = {
    'assigned': 'Fixed assignment IDs (810), each classified exactly once in its original region.',
    'regionalCandidates': 'Original regional updates; not approval or generated locations.',
    'originalUnresolved': 'Original regional unresolved rows, retained even after followup adoption.',
    'currentAdopted': 'Assignment IDs explicitly selected by current manifest with matching update hash.',
    'currentRemaining': 'Assignment IDs absent from current explicit manifest selection; not a claim of completed web research.',
    'candidateNotAdopted': 'Original candidate IDs absent from current selection.',
    'currentIntegrated': 'Adopted target IDs whose full confirmed coordinate matches the selected update; null without full.',
    'adoptedLocationNotGenerated': 'Adopted target IDs without matching confirmed location in supplied full (includes absent/stale); null without full.',
    'targetConfirmedLocations': 'Target IDs with a confirmed coordinate in full, regardless of adoption; null without full.',
    'targetPins': 'Target IDs with a non-reference place pin in full; separate from location and adoption; null without full.',
    'ledgerAdoptedMatches': 'Adopted target IDs whose supplied ledger coordinate matches selection; null without ledger.',
    'baselineLocationIds': 'Frozen 642 pre-Issue7 manifest location approvals, not all baseline ledger coordinates (776).',
    'issue7AddedIds': 'Current selected location IDs minus frozen baseline IDs, intersect assignment IDs.',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def fid(value):
    require(isinstance(value, str) and value.startswith('facility:') and len(value) > 9,
            f'invalid facility ID: {value}')
    return value


def unique_ids(values, context):
    require(isinstance(values, list), f'{context}: expected list')
    result = set()
    for value in values:
        fid(value)
        require(value not in result, f'{context}: duplicate ID {value}')
        result.add(value)
    return result


def index(rows, key, context):
    require(isinstance(rows, list), f'{context}: expected list')
    result = {}
    for row in rows:
        require(isinstance(row, dict), f'{context}: expected object')
        value = row.get(key)
        if key == 'facilityId':
            fid(value)
        else:
            require(isinstance(value, str) and bool(value.strip()), f'{context}: invalid ID')
        require(value not in result, f'{context}: duplicate ID {value}')
        result[value] = row
    return result


def audit(root, baseline='data/national/issue7/assignment-baseline.json',
          manifest='tools/national/manifest.json', regions_dir='data/national/issue7',
          full=None, ledger=None):
    root = Path(root)
    full = full or None
    hashes = {}
    cache = {}

    def read(name):
        name = str(name)
        if name not in cache:
            # Read once: parsed bytes and recorded digest always describe the same snapshot.
            raw = repo_path(root, name).read_bytes()
            hashes[name] = hashlib.sha256(raw).hexdigest()
            def invalid(value):
                raise ValueError(f'invalid JSON number: {value}')
            cache[name] = json.loads(raw, object_pairs_hook=unique_object, parse_constant=invalid)
        return cache[name]

    def document(name):
        d = read(name)
        require(isinstance(d, dict) and type(d.get('schema')) is int and d['schema'] == 1,
                f'{name}: unsupported schema')
        return d

    base = document(baseline)
    assignments = base['assignments']
    require(isinstance(assignments, dict) and set(assignments) == set(REGIONS), 'expected exactly 13 assignment regions')
    owners = {}
    for region in REGIONS:
        for value in unique_ids(assignments[region], region):
            require(value not in owners, f'duplicate assignment: {value}')
            owners[value] = region
    require(len(owners) == 810, 'expected 810 assigned IDs')
    old = unique_ids(base['baselineLocationIds'], 'baseline locations')
    require(len(old) == 642 and not old.intersection(owners), 'expected 642 disjoint baseline location IDs')

    originals = {}
    for region in REGIONS:
        name = f'{regions_dir}/{region}.json'
        d = document(name)
        for collection in ('updates', 'unresolved'):
            rows = index(d[collection], 'facilityId', name + '/' + collection)
            for value, row in rows.items():
                require(owners.get(value) == region, f'{region}: outside assignment {value}')
                require(value not in originals, f'duplicate classification: {value}')
                if collection == 'updates':
                    coordinate(row['coordinate'])
                else:
                    for field in ('reasonCategory', 'reason', 'investigationStatus'):
                        require(isinstance(row.get(field), str) and row[field].strip(), f'{value}: missing {field}')
                    require(isinstance(row.get('nextSource'), (str, dict, list)) and bool(row['nextSource']), f'{value}: missing nextSource')
                    require(isinstance(row.get('attempts'), list) and all(isinstance(a, dict) for a in row['attempts']), f'{value}: invalid attempts')
                originals[value] = dict(region=region, originalClassification=('candidate' if collection == 'updates' else 'unresolved'), original=row)
    require(set(originals) == set(owners), f'unclassified IDs: {sorted(set(owners) - set(originals))}')

    selected = {}
    m = document(manifest)
    require(isinstance(m['locations'], list), 'manifest locations must be a list')
    for selection in m['locations']:
        name = selection['path']
        source = document(name)
        rows = index(source['updates'], 'facilityId', name)
        approvals = index(selection['approved'], 'facilityId', name + '/approved')
        for value, approval in approvals.items():
            require(value not in selected, f'duplicate approval: {value}')
            require(value in rows, f'approved update missing: {value}')
            row = rows[value]
            digest = hashlib.sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            require(digest == approval['sha256'], f'approved update changed: {value}')
            coordinate(row['coordinate'])
            selected[value] = dict(path=name, sha256=digest, update=row)
    new_ids = set(selected) - old
    require(new_ids <= set(owners), f'new selections outside Issue7 assignment: {sorted(new_ids - set(owners))}')

    full_places, pins, ledger_places = None, None, None
    if full is not None:
        d = document(full)
        full_places = index(d['places'], 'id', 'full places')
        require(isinstance(d['pins'], list), 'full pins must be a list')
        pins = index([p for p in d['pins'] if p['kind'] == 'place' and not p.get('reference', False)], 'id', 'full place pins')
        for value, place in full_places.items():
            co = place.get('coordinate', {})
            require(isinstance(co, dict), f'invalid full coordinate: {value}')
            if co.get('status') == 'confirmed':
                coordinate({k: co[k] for k in ('lat', 'lng')})
        for value, pin in pins.items():
            require(value in full_places, f'pin missing place: {value}')
            co = full_places[value].get('coordinate', {})
            require(co.get('status') == 'confirmed', f'pin without confirmed coordinate: {value}')
            coordinate({k: pin[k] for k in ('lat', 'lng')})
            require(all(pin[k] == co[k] for k in ('lat', 'lng')), f'pin coordinate mismatch: {value}')
    if ledger is not None:
        ledger_places = index(document(ledger)['places'], 'id', 'ledger places')
        for place in ledger_places.values():
            if 'coordinate' in place:
                coordinate(place['coordinate'])

    facilities = []
    for value in sorted(owners):
        selection = selected.get(value)
        row = dict(facilityId=value, **originals[value], currentSelection=selection,
                   currentStatus='adopted' if selection else 'remaining', generated=None, ledger=None)
        if full_places is not None:
            co = full_places.get(value, {}).get('coordinate', {})
            confirmed = co.get('status') == 'confirmed'
            matches = bool(selection and confirmed and all(co[k] == selection['update']['coordinate'][k] for k in ('lat', 'lng')))
            row['generated'] = dict(present=value in full_places, confirmedLocation=confirmed,
                                    matchesAdopted=matches, pin=value in pins)
        if ledger_places is not None:
            co = ledger_places.get(value, {}).get('coordinate')
            row['ledger'] = dict(present=value in ledger_places, hasCoordinate=co is not None,
                                 matchesAdopted=bool(selection and co is not None and
                                     all(co[k] == selection['update']['coordinate'][k] for k in ('lat', 'lng'))))
        facilities.append(row)

    def summarize(rows):
        adopted = sum(r['currentStatus'] == 'adopted' for r in rows)
        candidates = sum(r['originalClassification'] == 'candidate' for r in rows)
        integrated = sum(r['generated']['matchesAdopted'] for r in rows) if full is not None else None
        unresolved = [r['original'] for r in rows if r['originalClassification'] == 'unresolved']
        return dict(assigned=len(rows), regionalCandidates=candidates, originalUnresolved=len(unresolved),
                    currentAdopted=adopted, currentRemaining=len(rows)-adopted,
                    candidateNotAdopted=sum(r['originalClassification'] == 'candidate' and r['currentStatus'] == 'remaining' for r in rows),
                    currentIntegrated=integrated,
                    adoptedLocationNotGenerated=adopted-integrated if integrated is not None else None,
                    targetConfirmedLocations=sum(r['generated']['confirmedLocation'] for r in rows) if full is not None else None,
                    targetPins=sum(r['generated']['pin'] for r in rows) if full is not None else None,
                    ledgerAdoptedMatches=sum(r['ledger']['matchesAdopted'] for r in rows) if ledger is not None else None,
                    originalUnresolvedByReason=dict(sorted(Counter(r['reasonCategory'] for r in unresolved).items())),
                    originalUnresolvedByInvestigationStatus=dict(sorted(Counter(r['investigationStatus'] for r in unresolved).items())))

    return dict(schema=1, inputSHA256=dict(sorted(hashes.items())), definitions=DEFINITIONS,
                summary=summarize(facilities),
                regions={r: summarize([f for f in facilities if f['region'] == r]) for r in REGIONS},
                locationSelection=dict(baselineLocationIds=sorted(old), currentSelectedIds=sorted(selected),
                                       issue7AddedIds=sorted(new_ids), baselineNoLongerSelectedIds=sorted(old-set(selected))),
                facilities=facilities)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--baseline', default='data/national/issue7/assignment-baseline.json')
    parser.add_argument('--manifest', default='tools/national/manifest.json')
    parser.add_argument('--regions-dir', default='data/national/issue7')
    parser.add_argument('--full', default='data/work/internal-data/full.json', help='repository-relative internal full JSON; empty string skips generated data')
    parser.add_argument('--ledger', help='optional repository-relative generated ledger JSON')
    parser.add_argument('--out', type=Path, required=True, help='new output file; existing paths are never overwritten')
    args = parser.parse_args()
    try:
        require(not args.out.exists(), 'output already exists')
        output = args.out.resolve()
        require(not output.is_relative_to((args.root / 'data/work/issue7-baseline').resolve()), 'fixed baseline output forbidden')
        require(not output.is_relative_to((args.root / 'data').resolve()) or output.is_relative_to((args.root / 'data/work').resolve()), 'source data output forbidden')
        result = audit(args.root, args.baseline, args.manifest, args.regions_dir, args.full, args.ledger)
        serialized = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n'
        with args.out.open('x', encoding='utf-8') as stream:
            stream.write(serialized)
    except (ValueError, KeyError, TypeError, IndexError, OSError) as err:
        parser.exit(1, f'Issue7 audit failed: {err}\n')


if __name__ == '__main__':
    main()
