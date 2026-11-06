"""Read-only assessment checks; no suites, fetching, or research regeneration.
Run from repo root: python -B data/evidence/issue76/saitama/verify.py
Requires the same Shapely/mapbox-vector-tile environment as measure.py.
"""
import hashlib
import json
from pathlib import Path
import sys
sys.path.insert(0, 'tools/national')
from location_lifecycle import digest
from measure import main

def read(path):
    return json.loads(Path(path).read_text())

n = 'data/national/kanto-prefecture/saitama/'
e = 'data/evidence/issue76/saitama/'
a = read('data/national/issue76/saitama/assessment.json')
old = read(n + 'full-outcomes.json')['rows']
locations = {r['facilityId']: r for r in read(n + 'full-locations.json')['updates']}
selection = read(n + 'full-selection-proposal.json')
selected = {r['facilityId']: r['sha256'] for r in selection['locations']['approved']}
rows = a['outcomes']
assert len(rows) == len({r['facilityId'] for r in rows}) == 39
assert {r['facilityId'] for r in rows} == {r['facilityId'] for r in old}
assert {r['facilityId'] for r in rows if r['recommendation'] == 'propose'} == set(selected) == set(locations)
assert sum(r['recommendation'] == 'hold' for r in rows) == 19
for row in rows:
    fid = row['facilityId']
    assert row['nextAction'] and row['limitations']
    if fid in locations:
        assert row['sourceLocationPath'] == n + 'full-locations.json'
        assert row['sourceLocationSHA256'] == digest(locations[fid]) == selected[fid]
        assert row['positionSuitability']['status'] == 'acceptable'
    else:
        assert row['sourceLocationPath'] is None and row['sourceLocationSHA256'] is None
        assert row['positionSuitability']['status'] == 'held'
    for ref in row['positionSuitability']['evidence']:
        path, pointer = ref.split('#', 1)
        assert Path(path).is_file(), path
        if pointer.startswith('/'):
            obj = read(path)
            for token in pointer[1:].split('/'):
                obj = obj[int(token)] if isinstance(obj, list) else obj[token]
assert hashlib.sha256(Path(selection['locationLifecycle']['path']).read_bytes()).hexdigest() == selection['locationLifecycle']['sha256']
actual = main()
assert actual == read(e + 'measurements.json')
metrics = {r['facilityId']: r for r in actual['rows']}
for row in rows:
    if row['facilityId'] in metrics:
        m = metrics[row['facilityId']]
        assert row['boundaryMarginMeters'] == m['boundaryMarginMeters']
        assert m['coordinateUnchanged'] == locations[row['facilityId']]['coordinate']
        assert m['pointInside']
print(json.dumps({'schema': 1, 'assessmentCoverage': 39, 'proposed': 20, 'held': 19,
                  'normalizedCandidateHashesMatched': 20,
                  'evidencePointersResolved': True, 'measurementsReproduced': 20,
                  'candidateCoordinatesUnchanged': True,
                  'fullSuitesRun': False, 'independentAdoptionReview': 'pending parent'}, indent=2))
