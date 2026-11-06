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
source = ROOT / 'data/evidence/issue60/human-answers-20261106/round2'
review = read_json(source / 'adoption-review.json')
assessment = read_json(source / 'assessment.json')['outcomes']
candidates = {r['facilityId']: r for r in read_json(source / 'locations-proposed.json')['updates']}
assert digest(assessment) == review['assessmentSHA256']
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
    assert digest(candidate) == review['approvedCandidateSHA256'][fid]
    assert all(place['coordinate'][k] == v for k, v in candidate['coordinate'].items())
    assert place['evidence']['checkedAt'] == candidate['evidence']['checkedAt']
    assert place['evidence']['sourceUrl'] == candidate['evidence']['sourceUrl']
    assert place['evidence']['verificationMethod'].startswith(row['adoptionMethod'])
    if row['number'] in (3, 5, 9):
        assert not place['evidence']['verificationMethod'].startswith('国土地理院最適化ベクトルタイルを加工。')
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
    remaining=read_json(ROOT / 'data/national/issue76/remaining-index-after-human-answers.json')['summary'])
print(json.dumps(report, ensure_ascii=False, indent=2))
