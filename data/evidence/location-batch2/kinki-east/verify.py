"""Validate this research packet; --raw also checks ignored originals on the research machine."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / 'tools/national'))
from assemble import assemble

parser = argparse.ArgumentParser()
parser.add_argument('--raw', action='store_true')
args = parser.parse_args()
N = ROOT / 'data/national/location-batch2/kinki-east'
E = Path(__file__).resolve().parent
read = lambda p: json.loads(Path(p).read_text())
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
selection = read(N / 'selection.json')
outcomes = read(N / 'outcomes.json')
priority = read(ROOT / 'data/national/issue24/priorities-snapshot.json')
population = {r['facilityId'] for r in priority['rows'] if 'kinki-east.json#' in r['originalRef']}
assert len(population) == 38
assert {r['facilityId'] for r in selection['rows']} == population
assert len(selection['rows']) == 38
assert population <= set(read(ROOT / 'data/national/location-batch1/baseline.json')['assembledUnlocatedIds'])
selected = {r['facilityId'] for r in selection['rows'] if r['selection'] == 'selected'}
assert len(selected) == 8
assert selected == {r['facilityId'] for r in outcomes['rows']}
assert len(outcomes['rows']) == 8
assert outcomes['updates'] == [] and outcomes['adopted'] == 0
for p, digest in selection['inputSHA256'].items():
    assert sha(ROOT / p) == digest, p

def resolve(ref):
    path, pointer = ref.split('#')
    value = read(ROOT / path)
    for key in pointer.strip('/').split('/'):
        value = value[int(key)] if isinstance(value, list) else value[key]
    return value

for row in selection['rows']:
    assert resolve(row['originalRef'])['facilityId'] == row['facilityId']
    assert row['reason']
retrievals = read(E / 'retrievals.json')
for row in outcomes['rows']:
    assert row['status'] == 'held' and row['coordinate'] is None
    assert row['resumeCondition'] and row['stopCondition']
    for evidence in row['evidence']:
        source = resolve(evidence['reference'])
        assert source['sha256'] == evidence['snapshotSHA256']
        assert source['url'] == evidence['sourceUrl']
        assert source['rawPath'] == evidence['rawPath']
        assert source['fetchedAt'] == evidence['fetchedAt']
        assert source['status'] == 200
if args.raw:
    for r in retrievals:
        if 'rawPath' in r:
            assert sha(ROOT / r['rawPath']) == r['sha256'], r['rawPath']
    for r in read(E / 'rendering.json')['files']:
        assert sha(ROOT / r['path']) == r['sha256'], r['path']
# Assembler validates every existing evidence and manifest-selected record.
ledger, audit = assemble(ROOT, read(ROOT / 'tools/national/manifest.json'))
places = {p['id']: p for p in ledger['places']}
assert all(not places[i].get('coordinate') for i in population)
assert sum(not p.get('coordinate') for p in places.values()) == 608
print(json.dumps({'population': len(population), 'selected': len(selected), 'held': 8,
                  'adopted': 0, 'nationalRegisteredUnlocated': 608,
                  'retrievals': len(retrievals), 'rawChecked': args.raw,
                  'manifestSHA256': sha(ROOT / 'tools/national/manifest.json'),
                  'assembledSHA256': hashlib.sha256(json.dumps(ledger, sort_keys=True, ensure_ascii=False).encode()).hexdigest()}, indent=2))
