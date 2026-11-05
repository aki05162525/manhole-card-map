"""Verify research references and exact regional adoption delta; callable from any cwd.

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
adopted = {r['facilityId'] for r in outcomes['rows'] if r['adopted']}
assert len(adopted) == outcomes['adoptedCount'] == 2
assert outcomes['heldCount'] == 6
assert all(r['resumeCondition'] and r['stopReason'] and 'numericParts' in r for r in outcomes['rows'])
assert all(r['proposedCoordinate'] is None and r['lifecycleBinding'] is None
           for r in outcomes['rows'] if not r['adopted'])
for path, expected_hash in selection['inputSHA256'].items():
    raw = (subprocess.check_output(['git', 'show', 'f66b7e994ef250fadee78f396d22fdfc40ba6a83:' + path], cwd=ROOT)
           if path == 'tools/national/manifest.json' else (ROOT / path).read_bytes())
    assert hashlib.sha256(raw).hexdigest() == expected_hash, path
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
    assert {i for i in expected if places[i].get('coordinate')} == adopted
    for row in selection['rows']:
        assert row['name'] == places[row['facilityId']]['name']
        assert row['address'] == places[row['facilityId']]['address']

calculations = read(E / 'reassessment-calculations.json')
for path, expected_hash in calculations['dependencies'].items():
    assert digest(ROOT / path) == expected_hash, path
facts = read(E / 'facts.json')
for ref in facts['references']:
    record = next(r for r in retrievals if r['key'] == ref['key'])
    for key in ('snapshotPath', 'snapshotSHA256', 'fetchedAt'):
        assert ref[key] == record[key], (ref['key'], key)
for ref in facts['reusedEvidence']:
    assert digest(ROOT / ref['snapshotPath']) == ref['snapshotSHA256']
subprocess.run([sys.executable, '-B', '-m', 'unittest', 'discover', '-s', 'tools/national',
                '-p', 'test_location_batch2_shikoku.py', '-v'], cwd=ROOT, check=True)
print('PASS: population 15, selected 8, provisional adoption 2, held 6, excluded 7; hashes and exact delta')
print('LIMIT: hashes/references and ledger invariants do not prove visual building identity or current distribution; independent review required')
