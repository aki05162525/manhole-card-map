"""Offline checks for the Issue44 research-only snapshot; no adoption authority."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[4]
N = ROOT / 'data/national/location-batch2/kyushu-okinawa'
E = Path(__file__).resolve().parent

def read(path):
    return json.loads(path.read_text())

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def pointer(ref):
    path, fragment = ref.split('#', 1)
    value = read(ROOT / path)
    for key in fragment.lstrip('/').split('/'):
        key = key.replace('~1', '/').replace('~0', '~')
        value = value[int(key)] if isinstance(value, list) else value[key]
    return value

parser = argparse.ArgumentParser()
parser.add_argument('--with-work', action='store_true', help='also require and hash local research originals')
args = parser.parse_args()
selection, coverage, outcomes = [read(N / f'{name}.json') for name in ('selection', 'coverage', 'outcomes')]
priorities = read(ROOT / 'data/national/issue24/priorities-snapshot.json')['rows']
expected = {r['facilityId'] for r in priorities if 'issue7/kyushu-okinawa.json#' in r['originalRef']}
baseline = set(read(ROOT / 'data/national/location-batch1/baseline.json')['assembledUnlocatedIds'])
assert expected <= baseline
assert len(coverage['rows']) == len(expected) == 66
assert {r['facilityId'] for r in coverage['rows']} == expected
selected = {r['facilityId'] for r in selection['selected']}
assert len(selected) == len(selection['selected']) == 8
assert selected == {r['facilityId'] for r in coverage['rows'] if r['selection'] == 'selected'}
assert selected == {r['facilityId'] for r in outcomes['rows']}
assert len(outcomes['rows']) == 8
assert (outcomes['proposed'], outcomes['adopted'], outcomes['held']) == (0, 0, 8)
for row in coverage['rows']:
    assert pointer(row['originalRef'])['facilityId'] == row['facilityId']
    for ref in row['reviewRefs']:
        assert pointer(ref)['facilityId'] == row['facilityId']
    assert row['exclusionOrSelectionReason']
for path, sha in selection['inputSHA256'].items():
    if path.startswith('data/work/') and not args.with_work:
        continue
    assert digest(ROOT / path) == sha, path
records = read(E / 'retrievals.json')['records']
by_id = {r['id']: r for r in records}
assert len(by_id) == len(records)
for row in outcomes['rows']:
    assert row['status'] == 'held' and row['coordinate'] is None
    assert row['stopCondition'] and row['resumeCondition'] and row['newMethod']
    assert set(row['sourceIds']) <= by_id.keys()
if args.with_work:
    for row in records:
        if 'snapshotPath' in row:
            assert digest(ROOT / row['snapshotPath']) == row['snapshotSHA256'], row['id']
    for row in read(E / 'vector-retrievals.json'):
        assert digest(ROOT / row['path']) == row['sha256']
        assert row['status'] == 206
old = ROOT / by_id['tokunoshima-layout']['sameBytesAs']
assert digest(old) == by_id['tokunoshima-layout']['snapshotSHA256']
v = read(E / 'vector-exploration.json')
assert digest(E / v['file']) == v['sha256']
assert v['selectedGeometry'] is None and v['derivedCoordinate'] is None
etags = {r['etag'] for r in read(E / 'vector-retrievals.json')}
assert len(etags) == 1 and None not in etags
for path in v['termsRefs']:
    assert (ROOT / path).is_file()
with tempfile.TemporaryDirectory() as tmp:
    output = Path(tmp) / 'ledger.json'
    subprocess.run(['python3', '-B', 'tools/national/assemble.py', '--out', str(output)], cwd=ROOT, check=True)
    assert digest(output) == selection['inputSHA256']['data/work/location-batch2/kyushu-okinawa/before.json']
    places = {r['id']: r for r in read(output)['places']}
    assert all(not places[id].get('coordinate') for id in selected)
    assert sum(not places[id].get('coordinate') for id in expected) == 65
    assert sum(not p.get('coordinate') for p in places.values()) == 608
print(json.dumps({'regionalSnapshot': 66, 'regionalUnlocated': 65, 'selected': 8, 'adopted': 0,
                  'held': 8, 'nationalLedgerUnlocated': 608, 'retrievals': len(records),
                  'assemblyUnchanged': True, 'workOriginalsChecked': args.with_work}, indent=2))
