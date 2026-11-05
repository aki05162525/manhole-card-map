"""Verify generated before/after output; raw inputs are kept in the local work area."""
import hashlib
import json
from pathlib import Path
W = Path('data/work/location-batch2/north-kanto')
E = Path('data/evidence/location-batch2/north-kanto')
def read(p): return json.loads(p.read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
a = read(W/'after-generated/full.json'); b = read(W/'before-generated/full.json')
expected = {r['facilityId']: r for r in read(Path('data/national/location-batch2/north-kanto/locations.json'))['updates']}
assert a['cards'] == b['cards'] and a['relations'] == b['relations']
old = {p['id']: p for p in b['places']}; new = {p['id']: p for p in a['places']}
assert old.keys() == new.keys()
assert {id for id in old if old[id] != new[id]} == expected.keys()
bp = {p['id']: p for p in b['pins']}; ap = {p['id']: p for p in a['pins']}
assert bp.keys() <= ap.keys() and all(ap[id] == p for id, p in bp.items())
assert len(ap.keys() - bp.keys()) == 2
rows = []
for id, r in expected.items():
 p = new[id]; assert all(p['coordinate'][k] == v for k,v in r['coordinate'].items())
 assert p['coordinate']['status'] == 'confirmed' and p['locationReview']['status'] == 'confirmed'
 matches = [p for pid,p in ap.items() if pid not in bp and pid == id]
 assert len(matches) == 1, (id,matches)
 assert all(matches[0][k] == v for k,v in r['coordinate'].items())
 rows.append(dict(facilityId=id,oldPlaceSHA256=hashlib.sha256(json.dumps(old[id],sort_keys=True,ensure_ascii=False).encode()).hexdigest(),coordinate=p['coordinate'],pin=matches[0]))
m = read(W/'after-generated/manifest.json'); details = read(W/'after-generated/details.json'); pins = read(W/'after-generated/pins.json')
for name,h in m['files'].items(): assert sha(W/'after-generated'/name) == h
assert pins['detailsSHA256'] == m['files']['details.json'] and pins['pins'] == a['pins']
for k in ['cards','places','relations']: assert details[k] == a[k]
result = dict(schema=1,filesSHA256=m['files'],evaluatedAt=m['evaluatedAt'],listDate=m['updated'],cards=len(a['cards']),places=len(a['places']),relations=len(a['relations']),facilityPinsBefore=sum(p['kind']=='place' for p in b['pins']),facilityPinsAfter=sum(p['kind']=='place' for p in a['pins']),existingPinsUnchanged=True,fullDetailsPinsConsistent=True,rows=rows)
print(json.dumps(result,ensure_ascii=False,indent=2))
