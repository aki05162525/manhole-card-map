"""Compare real builddata outputs; pass the pre-adoption full JSON as argv[1]."""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / 'tools/national'))
from assemble import read_json
from location_lifecycle import digest

before = read_json(Path(sys.argv[1]))
after = read_json(ROOT / 'web/public/data/full.json')
source = ROOT / 'data/evidence/issue60/kinugasa-followup'
review = read_json(source / 'adoption-review.json')
assessment = read_json(source / 'original/kanagawa/assessment.json')['rows']
candidates = {r['facilityId']: r for r in read_json(source / 'original/kanagawa/locations-proposed.json')['updates']}
assert {r['facilityId'] for r in assessment if r['recommendation'] == 'propose'} == set(review['approvedIds'])
assert before['cards'] == after['cards']
assert before['relations'] == after['relations']
old_pins = {p['id']: p for p in before['pins']}
new_pins = {p['id']: p for p in after['pins']}
assert new_pins.keys() - old_pins.keys() == set(review['approvedIds'])
assert all(new_pins[fid] == p for fid, p in old_pins.items())
old_places = {p['id']: p for p in before['places']}
new_places = {p['id']: p for p in after['places']}
assert old_places.keys() == new_places.keys()
assert {fid for fid in old_places if old_places[fid] != new_places[fid]} == set(review['approvedIds'])
for row in assessment:
    fid = row['facilityId']
    if fid not in review['approvedIds']:
        continue
    candidate = candidates[fid]
    place = new_places[fid]
    assert digest(candidate) == review['candidateAssemblySHA256']
    assert all(place['coordinate'][k] == v for k, v in candidate['coordinate'].items())
    assert place['evidence']['checkedAt'] == candidate['evidence']['checkedAt']
    assert place['evidence']['sourceUrl'] == candidate['evidence']['sourceUrl']
    assert 'BldA589' in place['evidence']['verificationMethod']
manifest = read_json(ROOT / 'web/public/data/manifest.json')
for name, expected in manifest['files'].items():
    assert hashlib.sha256((ROOT / 'web/public/data' / name).read_bytes()).hexdigest() == expected
report = dict(schema=1, sourceListing='data/evidence/national/list-source/gkp-20261105.html',
    sourceListingAcquired='2026-11-05', evaluatedAt=after['evaluatedAt'],
    generationHashes=manifest['files'], inputs=manifest['inputs'],
    previousPlacePins=sum(p['kind'] == 'place' for p in before['pins']),
    placePins=sum(p['kind'] == 'place' for p in after['pins']),
    newlyCheckedIds=review['approvedIds'], existingPinsUnchanged=True,
    cardsAndEffectiveRelationsUnchanged=True, existingPlacesUnchanged=True,
    coordinateSourceDateAndMethodPreserved=True,
    remaining=read_json(ROOT / 'data/national/issue76/remaining-index-after-kinugasa.json')['summary'])
print(json.dumps(report, ensure_ascii=False, indent=2))
