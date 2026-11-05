"""Verify research scope, references, preserved ledger, and saved source hashes.
Run from repository root after assemble --out data/work/location-batch2/south-kanto/after-ledger.json.
No network; no coordinate adoption. --raw also checks local ignored acquired originals.
"""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--raw', action='store_true')
args = parser.parse_args()
N = Path('data/national/location-batch2/south-kanto')
E = Path('data/evidence/location-batch2/south-kanto')
W = Path('data/work/location-batch2/south-kanto')

def read(p):
    return json.loads(Path(p).read_text())

def digest(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def resolve(ref):
    path, _, pointer = ref.partition('#')
    value = read(path)
    for part in pointer.strip('/').split('/') if pointer else []:
        value = value[int(part)] if isinstance(value, list) else value[part]
    return value

s = read(N / 'selection.json')
o = read(N / 'outcomes.json')
p = read('data/national/issue24/priorities-snapshot.json')
b = read('data/national/location-batch1/baseline.json')
expected = {r['facilityId'] for r in p['rows'] if r['originalRef'].startswith('data/national/issue7/south-kanto.json#')}
assert expected == {r['facilityId'] for r in s['rows']}
assert expected <= set(b['assembledUnlocatedIds'])
assert len(expected) == s['regionalPopulation'] == s['regionalUnlocated'] == 56
selected = set(s['selectedIds'])
assert len(selected) == 8
assert selected == {r['facilityId'] for r in s['rows'] if r['selected']}
assert selected == {r['facilityId'] for r in o['rows']}
assert o['candidateCount'] == o['adoptedCount'] == 0
assert o['heldCount'] == o['selectedCount'] == 8 and o['updates'] == []
for path, sha in s['inputSHA256'].items():
    if path.startswith('data/work/') and not args.raw:
        continue
    assert digest(path) == sha, path
for row in s['rows']:
    assert resolve(row['originalRef'])['facilityId'] == row['facilityId']
    assert row['selectionReason'] if row['selected'] else row['exclusionReason']
    for ref in row['reviewRefs']:
        assert resolve(ref)['facilityId'] == row['facilityId']
for row in o['rows']:
    assert row['decision'] == 'held'
    assert row['candidateCoordinate'] is None and row['adoptedCoordinate'] is None
    assert row['newMethod'] and row['stopCondition'] and row['resumeCondition']
    for ref in row['sourceRefs']:
        assert resolve(ref)['key']
v = read(E / 'vector-inspection.json')
assert v['selectedFeatures'] == [] and len(v['tiles']) == 10
for t in v['tiles']:
    assert digest(t['snapshotPath']) == t['sha256']
for r in read(E / 'retrievals.json')['records']:
    if args.raw and r.get('status') == 200:
        assert digest(r['rawPath']) == r['sha256'], r['key']
if args.raw:
    for r in v['ranges']:
        assert digest(r['rawPath']) == r['sha256']
    before = read(W / 'before-ledger.json')
    after = read(W / 'after-ledger.json')
    assert before == after, 'research-only PR must preserve every field and relation'
    unlocated = {r['id'] for r in after['places'] if not r.get('coordinate')}
    assert len(unlocated) == s['nationalUnlocatedAtStart'] == 608
    assert expected <= unlocated
print(json.dumps({'regionalPopulation': 56, 'selected': 8, 'adopted': 0, 'held': 8,
                  'vectorTileHashes': 10, 'rawChecked': args.raw,
                  'allLedgerFieldsUnchanged': True if args.raw else None}))
