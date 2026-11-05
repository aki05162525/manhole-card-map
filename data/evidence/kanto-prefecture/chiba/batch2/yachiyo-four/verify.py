import hashlib,json,sys
from pathlib import Path
sys.path.insert(0,'tools/national')
from assemble import evidence,coordinate
from location_lifecycle import digest,apply
W=Path(__file__).resolve().parent;root=Path.cwd()
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
# General originals remain ignored; default verification uses tracked GSI/evidence only.
if '--with-local-originals' in sys.argv:
 for r in json.load(open(W/'retrievals.json')):
  assert r['status']=='acquired';assert sha(r['rawPath'])==r['sha256']
t=json.load(open(W/'tile-inputs.json'))
for r in t['rows']:assert sha(r['path'])==r['sha256']
center=next(r for r in t['rows'] if r['tile']=={'z':16,'x':58272,'y':25797})
assert center['sha256']==sha('data/evidence/location-batch2/south-kanto/yachiyo-tile.pbf.gz')
for r in json.load(open(W/'range-retrievals.json')):
 assert r['status']=='acquired';assert r['httpStatus']==206;assert r['etag']==t['generation'][0];assert r['lastModified']==t['generation'][1];assert sha(r['rawPath'])==r['sha256']
old=json.load(open(W/'old-values.json'))['rows'];scope=json.load(open(root/'data/national/kanto-prefecture/chiba/scope.json'))['rows']
for r in old:
 orig=next(s for s in scope if s['facilityId']==r['facilityId']);assert r['previousPlace']==orig['currentPlace'];assert r['previousPlaceSHA256']==digest(orig['currentPlace']);assert r['previousRelationsSHA256']==digest(orig['currentRelations'])
u=json.load(open(W/'locations-proposed.json'))['updates'];b=json.load(open(W/'location-lifecycle-proposed.json'))
for r in u:coordinate(r['coordinate']);evidence(root,r['evidence'])
assert len(u)==3 and len(old)==4
ledger={'places':[dict(r['previousPlace']) for r in old]}
for place in ledger['places']:
 match=next((v for v in u if v['facilityId']==place['id']),None)
 if match:place.update(coordinate=match['coordinate'],evidence=match['evidence'])
apply(root,ledger,u,[b])
assert all(r['adoptionSHA256']==digest(r['adoption']) for r in b['bindings'])
calc=json.load(open(W/'calculation.json'));assert calc['roundedWithin'] and calc['unroundedWithin'];assert not calc['crsApproved'] and not calc['identityApproved'];assert sha(W/'combined.json')==calc['combinedSHA256']
print('PASS: tracked evidence (general originals only with explicit local flag), range responses, 9 tiles, inherited center bytes, 4 IDs/old values, 3 research bindings/evidence/schema, rounded inclusion; no adoption approved')

selection=json.load(open(W/'selection-proposed.json'));assert selection['approved']==[]
assert selection['researchOnlyCandidates']==[{'facilityId':r['facilityId'],'sha256':digest(r)} for r in u]
for r in old:assert r['previousCoordinate'] is None
assert next(r for r in old if r['facilityId'].endswith('legacy-yachiyo-0'))['previousRelations'][0]['status']=='unknown'
assert next(r for r in old if r['facilityId'].endswith('legacy-yachiyo-1'))['previousRelations'][0]['status']=='ended'
print('PASS: selection hashes and unchanged legacy statuses; no location approved')
