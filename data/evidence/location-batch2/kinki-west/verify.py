"""Verify this research snapshot without changing the ledger.
Run from the repository root: mise exec -- python3 data/evidence/location-batch2/kinki-west/verify.py [--raw]
--raw additionally checks ignored local retrieval bytes.
"""
import copy
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[4]
D = ROOT / 'data/national/location-batch2/kinki-west'
E = Path(__file__).resolve().parent


def read(path):
    return json.loads(path.read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def resolve(ref):
    path, _, pointer = ref.partition('#')
    value = read(ROOT / path)
    for segment in pointer.strip('/').split('/') if pointer else []:
        value = value[int(segment)] if isinstance(value, list) else value[segment]
    return value


manifest = read(ROOT / 'tools/national/manifest.json')
historical = copy.deepcopy(manifest)
for key in ['locations', 'locationLifecycle']:
    historical[key] = [r for r in historical[key] if not r['path'].startswith('data/national/location-batch2/')]
s = read(D / 'selection.json')
c = read(D / 'coverage.json')
o = read(D / 'outcomes.json')
original = read(ROOT / 'data/national/issue24/priorities-snapshot.json')
baseline = read(ROOT / 'data/national/location-batch1/baseline.json')
expected = {r['facilityId'] for r in original['rows'] if 'kinki-west' in r['originalRef']}
assert len(expected) == s['regionalPopulation'] == 108
assert {r['facilityId'] for r in c['rows']} == expected
assert len(c['rows']) == len(expected)
assert expected <= set(baseline['assembledUnlocatedIds'])
selected = {r['facilityId'] for r in s['rows']}
assert len(selected) == len(s['rows']) == 8
assert selected == {r['facilityId'] for r in o['rows']}
assert selected == {r['facilityId'] for r in c['rows'] if r['classification'] == 'selected'}
assert not selected & {r['facilityId'] for r in c['rows'] if r['classification'] in ('already-adopted', 'existing-hold', 'batch1-hold')}
for path, digest in s['inputSHA256'].items():
    actual = (hashlib.sha256((json.dumps(historical, ensure_ascii=False, indent=2)+'\n').encode()).hexdigest()
              if path == 'tools/national/manifest.json' else sha(ROOT / path))
    assert actual == digest, path
for r in c['rows']:
    assert resolve(r['originalRef'])['facilityId'] == r['facilityId']
    for ref in r['reviewRefs']:
        assert resolve(ref)['facilityId'] == r['facilityId']
for r in o['rows']:
    assert resolve(r['selectionRef'])['facilityId'] == r['facilityId']
    assert (r['decision'] == 'held' and r['coordinate'] is None) or (r['coordinate'] and r['comparisonRef'])
    assert r['stopCondition'] and r['resumeCondition'] and r['sourceRecords']
assert o['candidateForAdoptionCount'] == 2
assert o['adoptedCount'] in (0, 2)
assert o['heldCount'] == 6
# Freeze historical counts, then inspect the exact regional increment separately.
sys.path.insert(0, str(ROOT / 'tools/national'))
from assemble import assemble
baseline_ledger, _ = assemble(ROOT, historical)
ledger, _ = assemble(ROOT, manifest)
old = {p['id']: p for p in baseline_ledger['places']}
places = {p['id']: p for p in ledger['places']}
assert sum(not p.get('coordinate') for p in baseline_ledger['places']) == 608
assert sum(not old[fid].get('coordinate') for fid in expected) == s['regionalUnlocated'] == 106
points = {r['facilityId']: r['coordinate'] for r in read(E / 'derived-buildings.json')['rows']}
assert len(points) == 2
for fid in selected:
    assert places[fid].get('coordinate') == points.get(fid)
for row in read(E / 'building-correspondence.json')['rows']:
    assert resolve(row['numericSourceRef'])['facilityId'] == row['facilityId']
    assert resolve(row['derivedRef'])['coordinate'] == points[row['facilityId']]
    for source in row['sources']:
        if '--raw' in sys.argv or not source['path'].startswith('data/work/'):
            assert sha(ROOT/source['path']) == source['sha256'], source['path']
for tile in read(E / 'footprint-tiles.json')['rows']:
    assert sha(ROOT/tile['path']) == tile['sha256'], tile['path']
for r in read(E / 'vector-check.json')['rows']:
    assert sha(ROOT / r['path']) == r['sha256']
cond = read(E / 'source-conditions.json')['gsi']
assert sha(ROOT / cond['termsPath']) == cond['termsSHA256']
raw_count = 0
if '--raw' in sys.argv:
    for filename in ['retrievals.json', 'vector-retrievals.json', 'footprint-retrievals.json', 'build-inputs.json']:
        for r in read(E / filename):
            if 'path' in r:
                assert sha(ROOT / r['path']) == r['sha256'], r['path']
                raw_count += 1
print(json.dumps({'population': 108, 'regionalUnlocatedAtStart': 106, 'regionalUnlocatedCurrent': sum(not places[fid].get('coordinate') for fid in expected), 'selected': 8, 'provisionalIntegrated': 2, 'held': 6, 'rawHashesChecked': raw_count}))
