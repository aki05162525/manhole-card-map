"""Verify research references and non-adoption; run from repository root.

mise exec -- python3 -B data/evidence/location-batch2/shikoku/verify.py
Add --raw to check ignored local retrieval bytes as well.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[4]
E = ROOT / 'data/evidence/location-batch2/shikoku'
N = ROOT / 'data/national/location-batch2/shikoku'

def read(path):
    return json.loads(path.read_text())

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

selection = read(N / 'selection.json')
outcomes = read(N / 'outcomes.json')
priorities = read(ROOT / 'data/national/issue24/priorities-snapshot.json')
baseline = read(ROOT / 'data/national/location-batch1/baseline.json')
expected = {r['facilityId'] for r in priorities['rows']
            if r['originalRef'].startswith('data/national/issue7/shikoku.json#')}
assert {r['facilityId'] for r in selection['rows']} == expected
assert len(expected) == 15
selected = set(selection['selectedIds'])
assert len(selected) == len(selection['selectedIds']) == 8
assert selected <= expected <= set(baseline['assembledUnlocatedIds'])
assert {r['facilityId'] for r in outcomes['rows']} == selected
assert all(r['decision'] == 'held' and not r['adopted']
           and r['proposedCoordinate'] is None and r['lifecycleBinding'] is None
           and r['resumeCondition'] for r in outcomes['rows'])
for path, expected_hash in selection['inputSHA256'].items():
    assert digest(ROOT / path) == expected_hash, path
for row in selection['rows']:
    path, pointer = row['originalRef'].split('#')
    value = read(ROOT / path)
    for token in pointer.strip('/').split('/'):
        value = value[int(token)] if isinstance(value, list) else value[token]
    assert value['facilityId'] == row['facilityId']
    assert row['reason']
retrievals = read(E / 'retrievals.json')['records']
keys = {r['key'] for r in retrievals}
assert len(keys) == len(retrievals)
for row in outcomes['rows']:
    assert set(row['retrievalKeys']) <= keys
if '--raw' in sys.argv:
    for row in retrievals:
        if 'snapshotPath' in row:
            path = ROOT / row['snapshotPath']
            assert digest(path) == row['snapshotSHA256'], row['key']
            assert path.stat().st_size == row['bytes']
vector = read(E / 'vector-inputs.json')
for row in vector['rows']:
    assert digest(ROOT / row['path']) == row['sha256']
assert len({(r['etag'], r['lastModified']) for r in vector['retrievals']}) == 1
terms = vector['terms']['reusedTerms']
assert digest(ROOT / terms['path']) == terms['sha256']
if '--raw' in sys.argv:
    for row in vector['retrievals']:
        assert digest(ROOT / row['snapshotPath']) == row['snapshotSHA256']
with tempfile.TemporaryDirectory() as tmp:
    output = Path(tmp) / 'ledger.json'
    subprocess.run([sys.executable, '-B', str(ROOT / 'tools/national/assemble.py'),
                    '--out', str(output)], cwd=ROOT, check=True)
    ledger = read(output)
    places = {p['id']: p for p in ledger['places']}
    assert all(not places[i].get('coordinate') for i in expected)
    assert sum(not p.get('coordinate') for p in places.values()) == 608
    for row in selection['rows']:
        assert row['name'] == places[row['facilityId']]['name']
        assert row['address'] == places[row['facilityId']]['address']
    before = ROOT / 'data/work/location-batch2/shikoku/before-ledger.json'
    if '--raw' in sys.argv:
        assert read(before) == ledger, 'all places and relations must remain identical'
print('PASS: population 15, selected/held 8, excluded 7, adopted 0; references/hashes; current assemble unchanged')
