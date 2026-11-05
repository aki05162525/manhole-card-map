"""Validate this research-only batch. Run at repo root; --with-work checks raw bytes."""
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


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def pointer(ref):
    path, _, fragment = ref.partition('#')
    value = read(path)
    for part in fragment.strip('/').split('/') if fragment else []:
        value = value[int(part)] if isinstance(value, list) else value[part]
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--with-work', action='store_true')
    args = parser.parse_args()
    base = 'data/national/location-batch2/north-kanto/'
    evidence = 'data/evidence/location-batch2/north-kanto/'
    selection = read(base + 'selection.json')
    coverage = read(base + 'coverage.json')
    outcomes = read(base + 'outcomes.json')
    for path, expected in selection['inputSHA256'].items():
        assert sha(path) == expected, path
    ledger, audit = assemble(ROOT, read('tools/national/manifest.json'))
    places = {p['id']: p for p in ledger['places']}
    priorities = read('data/national/issue24/priorities-snapshot.json')['rows']
    expected = {r['facilityId'] for r in priorities if 'north-kanto' in r['originalRef']}
    baseline = set(read('data/national/location-batch1/baseline.json')['assembledUnlocatedIds'])
    covered = {r['facilityId'] for r in coverage['rows']}
    selected = {r['facilityId'] for r in selection['selected']}
    assert len(covered) == len(coverage['rows']) == 91 and covered == expected
    assert covered <= baseline
    assert len(selected) == len(selection['selected']) == 8
    assert selected == {r['facilityId'] for r in coverage['rows'] if r['selected']}
    assert selected == {r['facilityId'] for r in outcomes['rows']}
    assert all(not places[id].get('coordinate') for id in covered)
    assert sum(not p.get('coordinate') for p in places.values()) == 608
    assert not outcomes['updates'] and not outcomes['bindings']
    for row in coverage['rows']:
        assert pointer(row['originalRef'])['facilityId'] == row['facilityId']
        assert row['name'] == places[row['facilityId']]['name'] and row['reason']
    for row in outcomes['rows']:
        assert row['status'] == 'held'
        assert row['candidateCoordinate'] is None and row['adoptedCoordinate'] is None
        assert row['stopCondition'] and row['resumeCondition'] and row['newMethod']
        for ref in row['newEvidenceRefs']:
            assert pointer(ref)['sourceUrl'].startswith(('https://', 'http://'))
    for path in coverage['holdPolicy']['checkedSources']:
        text = (ROOT / path).read_text()
        # Batch1 followups and integration have no selected north-kanto IDs.
        assert not any(id in text for id in selected), path
    raw_count = 0
    if args.with_work:
        for row in read(evidence + 'retrievals.json')['records']:
            if 'sha256' in row:
                assert sha(row['path']) == row['sha256'], row['id']
                raw_count += 1
        ranges = read(evidence + 'vector-retrievals.json')
        assert len({r['etag'] for r in ranges}) == 1
        assert len({r['lastModified'] for r in ranges}) == 1
        for row in ranges:
            assert sha(row['path']) == row['sha256']
            raw_count += 1
        for row in read(evidence + 'vector-window.json')['tiles']:
            assert sha(row['path']) == row['sha256']
            raw_count += 1
        before = read('data/work/location-batch2/north-kanto/before-ledger.json')
        assert ledger == before, 'Research must not change facilities or relations'
    print(json.dumps(dict(population=91,selected=8,adopted=0,held=8,
        nationalUnlocated=608,manifestUnchanged=True,rawFilesChecked=raw_count,
        fullLedgerCompared=args.with_work), ensure_ascii=False))


if __name__ == '__main__':
    main()
