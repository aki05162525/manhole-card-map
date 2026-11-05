"""Validate the bounded research record; --with-work additionally checks local raw bytes.
Run from repository root: mise exec -- python3 -B data/evidence/location-batch2/koshin/verify.py --with-work
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / 'tools/national'))
from assemble import assemble


def read(path):
    return json.loads((ROOT / path).read_text())


def digest(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def resolve(ref):
    path, pointer = ref.split('#', 1)
    obj = read(path)
    for key in pointer.strip('/').split('/'):
        obj = obj[int(key)] if isinstance(obj, list) else obj[key]
    return obj


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--with-work', action='store_true')
    args = parser.parse_args()
    base = 'data/national/location-batch2/koshin/'
    ev = 'data/evidence/location-batch2/koshin/'
    selection = read(base + 'selection.json')
    outcomes = read(base + 'outcomes.json')
    for path, expected in selection['inputSHA256'].items():
        assert digest(path) == expected, path
    snapshot = [r for r in read('data/national/issue24/priorities-snapshot.json')['rows']
                if 'koshin.json#' in r['originalRef']]
    baseline = set(read('data/national/location-batch1/baseline.json')['assembledUnlocatedIds'])
    ledger, _ = assemble(ROOT, read('tools/national/manifest.json'))
    places = {p['id']: p for p in ledger['places']}
    ids = {r['facilityId'] for r in snapshot}
    assert len(ids) == 27
    assert ids == {r['facilityId'] for r in selection['coverage']}
    assert ids <= baseline
    assert all(not places[i].get('coordinate') for i in ids)
    assert sum(not p.get('coordinate') for p in places.values()) == 608
    selected = {r['facilityId'] for r in selection['selected']}
    assert len(selected) == 8
    assert selected == {r['facilityId'] for r in outcomes['rows']}
    assert selected == {r['facilityId'] for r in selection['coverage'] if r['selected']}
    assert selected == {r['facilityId'] for r in snapshot[:8]}
    for row in selection['coverage']:
        assert resolve(row['originalRef'])['facilityId'] == row['facilityId']
        assert all(resolve(ref)['facilityId'] == row['facilityId'] for ref in row['reviewRefs'])
        assert row['reason'] and row['previousFinding']
    for row in outcomes['rows']:
        assert row['decision'] == 'held' and row['coordinate'] is None
        assert row['stopCondition'] and row['resumeCondition'] and row['newMethod']
        for ref in row['factRefs']:
            resolve(ref)
    proposals = read(base + 'proposals.json')
    assert proposals['updates'] == proposals['bindings'] == []
    spec = read(ev + 'vector-inputs.json')
    for row in spec['rows']:
        assert digest(ev + row['file']) == row['sha256']
        assert row['facilityId'] in selected
    facts = read(ev + 'facts.json')
    for row in facts['reuse']:
        assert digest(row['path']) == row['sha256']
    ueda = next(r for r in read(ev + 'retrievals.json')['rows'] if r['file'].endswith('/ueda-tourism.csv'))
    assert digest(ev + 'ueda-tourism.csv') == ueda['sha256']
    raw_checks = 0
    if args.with_work:
        for row in read(ev + 'retrievals.json')['rows']:
            if row.get('status') == 200:
                assert digest(row['file']) == row['sha256'], row['file']
                raw_checks += 1
        for row in read(ev + 'vector-retrievals.json'):
            assert digest(row['path']) == row['sha256']
            raw_checks += 1
        for row in facts['facts']:
            assert digest(row['snapshotPath']) == row['snapshotSHA256']
    print(json.dumps({'regionUnlocated': 27, 'selected': 8, 'held': 8,
                      'adopted': 0, 'nationalLedgerUnlocated': 608,
                      'localRawHashChecks': raw_checks}, ensure_ascii=False))


if __name__ == '__main__':
    main()
