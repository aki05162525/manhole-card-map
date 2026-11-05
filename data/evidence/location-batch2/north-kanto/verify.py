"""Validate this batch and its exact provisional/adopted delta. Run at repo root; --with-work checks raw bytes."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import copy
import subprocess

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
        actual = hashlib.sha256(subprocess.check_output(['git', 'show', selection['baseCommit'] + ':' + path])).hexdigest() if path == 'tools/national/manifest.json' else sha(path)
        assert actual == expected, path
    manifest = read('tools/national/manifest.json')
    historical = copy.deepcopy(manifest)
    for key in ('locations', 'locationLifecycle'):
        historical[key] = [r for r in historical[key] if not r['path'].startswith(base)]
    before_ledger, _ = assemble(ROOT, historical)
    ledger, audit = assemble(ROOT, manifest)
    accepted = {r['facilityId']: r for r in read(base + 'locations.json')['updates']}
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
    assert all(not places[id].get('coordinate') for id in covered - accepted.keys())
    assert all(places[id]['coordinate'] == row['coordinate'] for id, row in accepted.items())
    before_unlocated = sum(not p.get('coordinate') for p in before_ledger['places'])
    after_unlocated = sum(not p.get('coordinate') for p in places.values())
    assert after_unlocated == before_unlocated - len(accepted)
    assert len(outcomes['updates']) == len(outcomes['bindings']) == 2
    for row in coverage['rows']:
        assert pointer(row['originalRef'])['facilityId'] == row['facilityId']
        assert row['name'] == places[row['facilityId']]['name'] and row['reason']
    for row in outcomes['rows']:
        assert row['status'] in ('held', 'proposed', 'adopted')
        if row['facilityId'] not in accepted:
            assert row['candidateCoordinate'] is None and row['adoptedCoordinate'] is None
        else:
            assert row['candidateCoordinate'] == accepted[row['facilityId']]['coordinate']
        assert row['stopCondition'] and row['resumeCondition'] and row['newMethod']
        for ref in row['newEvidenceRefs']:
            assert pointer(ref)['sourceUrl'].startswith(('https://', 'http://'))
    for path in coverage['holdPolicy']['checkedSources']:
        text = (ROOT / path).read_text()
        # Batch1 followups and integration have no selected north-kanto IDs.
        overlap = {id for id in selected if id in text}
        allowed = {r['facilityId'] for r in coverage['holdPolicy']['allowedReopened'] if r['holdRef'].split('#')[0] == path}
        assert overlap == allowed, (path, overlap, allowed)
    for r in coverage['holdPolicy']['allowedReopened']:
        assert pointer(r['holdRef'])['facilityId'] == r['facilityId'] and r['newMethod']
    assert ledger['relations'] == before_ledger['relations']
    old = {p['id']: p for p in before_ledger['places']}
    assert {id for id in old if old[id] != places[id]} == accepted.keys()
    for row in read(evidence + 'old-values.json')['rows']:
        assert row['oldPlace'] == old[row['facilityId']]
        assert hashlib.sha256(json.dumps(row['oldPlace'], sort_keys=True, ensure_ascii=False).encode()).hexdigest() == row['oldPlaceSHA256']
        assert row['oldCoordinate'] is None
    for id in accepted:
        assert not old[id].get('coordinate')
        assert {k for k in old[id].keys() | places[id].keys() if old[id].get(k) != places[id].get(k)} == {'coordinate','evidence','locationReview'}
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
        batch1_manifest = copy.deepcopy(manifest)
        for key in ('locations', 'locationLifecycle'):
            batch1_manifest[key] = [r for r in batch1_manifest[key] if not r['path'].startswith('data/national/location-batch2/')]
        batch1_ledger, _ = assemble(ROOT, batch1_manifest)
        assert batch1_ledger == before, 'Historical baseline must remain exact'
        for window in read(evidence + 'revision-windows.json')['windows']:
            for tile in window['tiles']:
                assert sha(tile['path']) == tile['sha256']
                raw_count += 1
        for r in read(evidence + 'comparison-facts.json')['rows']:
            for key in ('comparisonImage','decodedFile'):
                assert sha(r[key]['path']) == r[key]['sha256']
    print(json.dumps(dict(population=91,selected=8,integrated=len(accepted),held=6,
        nationalUnlocated=after_unlocated,parentUnlocated=before_unlocated,manifestUnchanged=(manifest == historical),rawFilesChecked=raw_count,
        fullLedgerCompared=args.with_work), ensure_ascii=False))


if __name__ == '__main__':
    main()
