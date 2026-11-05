"""Offline research integrity check. --with-work additionally verifies private raw bytes.
Run from repository root; does not edit manifest or application data.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--with-work', action='store_true')
args = parser.parse_args()
N = Path('data/national/location-batch2/tokai')
E = Path('data/evidence/location-batch2/tokai')
def read(path):
    return json.loads(Path(path).read_text())
def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def pointer(ref):
    path, ptr = ref.split('#', 1)
    value = read(path)
    for key in ptr.strip('/').split('/'):
        value = value[int(key)] if isinstance(value, list) else value[key]
    return value

s, o = read(N / 'selection.json'), read(N / 'outcomes.json')
assert sha(N / 'selection.json') == o['selectionSHA256']
for path, digest in s['inputSHA256'].items():
    if not path.startswith('data/work/') or args.with_work:
        assert sha(path) == digest, path
population = {r['facilityId'] for r in read('data/national/issue24/priorities-snapshot.json')['rows']
              if r['originalRef'].startswith('data/national/issue7/tokai.json#')}
rows = s['rows']
assert len(rows) == len(population) == 35
assert {r['facilityId'] for r in rows} == population
assert population <= set(read('data/national/location-batch1/baseline.json')['assembledUnlocatedIds'])
selected = {r['facilityId'] for r in rows if r['selected']}
assert len(selected) == 8 == s['selectedCount'] == o['selectedCount']
assert selected == {r['facilityId'] for r in o['rows']}
assert len(o['rows']) == 8 and o['adoptedCount'] == o['candidateCount'] == 0
assert o['heldCount'] == 8 and o['updates'] == []
for r in rows:
    assert pointer(r['originalRef'])['facilityId'] == r['facilityId']
    for ref in r['reviewRefs']:
        assert pointer(ref)['facilityId'] == r['facilityId']
    assert r['reason'] and r['previousReason']
    if r['followup']:
        assert not r['selected']
retrievals = read(E / 'retrievals.json')['rows']
by_id = {r['id']: r for r in retrievals}
assert len(by_id) == len(retrievals)
for r in o['rows']:
    assert r['coordinate'] is None and r['decision'] == 'held'
    assert r['stopCondition'] and r['resumeCondition'] and r['newMethod']
    assert set(r['evidenceIds']) <= set(by_id)
    assert r['evidenceFacts']
    for fact in r['evidenceFacts']:
        assert fact['evidenceId'] in r['evidenceIds']
        assert fact['locator'] and fact['version']
for r in retrievals:
    if 'path' in r:
        assert r['status'] == 200
        if args.with_work:
            assert sha(r['path']) == r['sha256'], r['path']
    else:
        assert r['error']
if args.with_work:
    for r in read(E / 'inspection.json')['files']:
        assert sha(r['path']) == r['sha256'], r['path']
rights = read(E / 'rights.json')
assert sha(rights['vector']['termsSnapshotRef']) == rights['vector']['termsSnapshotSHA256']
assert sha(rights['sourceCRSRef']) == rights['sourceCRSSHA256']
v = read(E / 'vector-inputs.json')
for r in v['rows']:
    assert sha(E / r['file']) == r['sha256']
records = read(E / 'vector-retrievals.json')
assert len({r['etag'] for r in records}) == 1
for r in records:
    assert r['status'] == 206
    start, end = map(int, r['range'].split('=')[1].split('-'))
    assert r['bytes'] == end - start + 1
    if args.with_work:
        assert sha(r['path']) == r['sha256']
for r in v['rows']:
    assert any(x['sha256'] == r['sha256'] for x in records)
with tempfile.TemporaryDirectory() as td:
    p = Path(td) / 'ledger.json'
    subprocess.run(['python3', '-B', 'tools/national/assemble.py', '--out', str(p)], check=True)
    assert sha(p) == s['inputSHA256']['data/work/location-batch2/tokai/before-ledger.json']
    places = {r['id']: r for r in read(p)['places']}
    assert all(not places[f].get('coordinate') for f in population)
print(json.dumps({'population': 35, 'selected': 8, 'adopted': 0, 'held': 8,
                  'unchangedAssemble': True, 'privateRawVerified': args.with_work,
                  'retrievalRecords': len(retrievals), 'vectorRangeRecords': len(records)}))
