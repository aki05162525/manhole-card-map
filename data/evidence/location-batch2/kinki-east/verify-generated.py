"""Validate generated full/split hashes and exact pin delta (run after builddata)."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4]
W=ROOT/'data/work/location-batch2/kinki-east/adoption'
def read(p): return json.loads(p.read_text())
points={r['facilityId']:r['coordinate'] for r in read(ROOT/'data/national/location-batch2/kinki-east/locations.json')['updates']}
counts={};hashes={}
for stage in ['before','after']:
 p=W/(stage+'-generated');full=read(p/'full.json');details=read(p/'details.json');pins=read(p/'pins.json');manifest=read(p/'manifest.json')
 for name,digest in manifest['files'].items(): assert hashlib.sha256((p/name).read_bytes()).hexdigest()==digest
 assert pins['detailsSHA256']==manifest['files']['details.json']
 assert full['cards']==details['cards'] and full['places']==details['places'] and full['relations']==details['relations']
 assert full['pins']==pins['pins']
 counts[stage]={k:sum(r['kind']==k for r in full['pins']) for k in ['place','lid']}
 hashes[stage]=manifest['files']
 if stage=='before': old=full
 else: new=full
assert old['cards']==new['cards'] and old['relations']==new['relations']
a={p['id']:p for p in old['pins']};b={p['id']:p for p in new['pins']}
assert a.keys()<=b.keys()
assert all(b[k]==v for k,v in a.items())
assert len(b.keys()-a.keys())==2
for fid,xy in points.items():
 place=next(p for p in new['places'] if p['id']==fid)
 assert all(place['coordinate'][k]==v for k,v in xy.items())
 pin=next(p for p in new['pins'] if p['id']==fid)
 assert pin['id'] in b.keys()-a.keys()
 assert all(pin[k]==v for k,v in xy.items())
old_places={p['id']:p for p in old['places']};new_places={p['id']:p for p in new['places']}
assert old_places.keys()==new_places.keys()
for fid in old_places:
 if fid not in points: assert old_places[fid]==new_places[fid]
 else:
  assert {k:v for k,v in old_places[fid].items() if k not in ['coordinate','evidence','locationReview']}=={k:v for k,v in new_places[fid].items() if k not in ['coordinate','evidence','locationReview']}
for row in read(ROOT/'data/national/location-batch2/kinki-east/locations.json')['updates']:
 assert new_places[row['facilityId']]['evidence']==row['evidence']
 assert new_places[row['facilityId']]['locationReview']['status']=='confirmed'
held=read(ROOT/'data/national/location-batch2/kinki-east/decision.json')['heldIds']
assert len(held)==6
for fid in held:
 assert new_places[fid]['coordinate']['status']=='unconfirmed' and fid not in b
result={'counts':counts,'filesSHA256':hashes,'newPlaceIds':list(points),'existingPinsUnchanged':True,'cardsAndRelationsUnchanged':True}
print(json.dumps(result,ensure_ascii=False,indent=2))
