"""Verify the research package; --raw also checks ignored source bytes locally."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[4]
N = ROOT / 'data/national/location-batch2/tohoku'
E = Path(__file__).resolve().parent
load = lambda p: json.loads(p.read_text())
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
parser = argparse.ArgumentParser()
parser.add_argument('--raw', action='store_true')
args = parser.parse_args()
s = load(N / 'selection.json')
c = load(N / 'coverage.json')
o = load(N / 'outcomes.json')
for path, digest in s['inputSHA256'].items():
    assert sha(ROOT / path) == digest, path
base_ids = set(load(ROOT / 'data/national/location-batch1/baseline.json')['assembledUnlocatedIds'])
priority = [r for r in load(ROOT / 'data/national/issue24/priorities-snapshot.json')['rows']
            if r['originalRef'].startswith('data/national/issue7/tohoku.json#')]
ids = {r['facilityId'] for r in priority}
assert ids <= base_ids
assert len(ids) == 59 == len(c['rows'])
assert {r['facilityId'] for r in c['rows']} == ids
selected = {r['facilityId'] for r in s['selected']}
assert len(selected) == 8 == len(o['rows'])
assert {r['facilityId'] for r in o['rows']} == selected
assert o['adoptedCount'] == 0 and o['heldCount'] == 8
for r in c['rows']:
    for ref in [r['originalRef'], *r['reviewRefs']]:
        path, pointer = ref.split('#', 1)
        v = load(ROOT / path)
        for part in pointer.strip('/').split('/'):
            v = v[int(part)] if isinstance(v, list) else v[part]
        assert v['facilityId'] == r['facilityId'], ref
sources = {r['id']: r for r in load(E / 'retrievals.json')['records'] if r.get('status') == 200}
for r in o['rows']:
    assert r['status'] == 'held' and r['adoptedCoordinate'] is None and r['binding'] is None
    assert r['newMethod'] and r['stopCondition'] and r['resumeCondition']
    assert set(r['sourceIds']) <= sources.keys()
for f in load(E / 'facts.json')['rows']:
    assert f['snapshotSHA256'] == sources[f['sourceId']]['sha256']
    assert f['sourceUrl'] == sources[f['sourceId']]['url']
for t in load(E / 'vector-inputs.json')['tiles']:
    assert sha(E / t['file']) == t['sha256']
assert len(load(E / 'derived-comparisons.json')['rows']) == o['comparisonCandidateCount']
if args.raw:
    for r in sources.values():
        assert sha(ROOT / r['path']) == r['sha256'], r['path']
    for r in load(E / 'vector-retrievals.json'):
        assert sha(ROOT / r['path']) == r['sha256'], r['path']
sys.path.insert(0, str(ROOT / 'tools/national'))
import assemble
ledger, audit = assemble.assemble(ROOT, load(ROOT / 'tools/national/manifest.json'))
places = {p['id']: p for p in ledger['places']}
assert all(not places[i].get('coordinate') for i in ids)
assert sum(not p.get('coordinate') for p in places.values()) == 608
print(json.dumps({'status': 'pass', 'regionalPopulation': len(ids), 'selected': len(selected),
                  'adopted': 0, 'held': 8, 'nationalUnlocated': 608, 'rawChecked': args.raw}, indent=2))
