"""Check real before/after builddata outputs, split generation, pins and exact deltas."""
import hashlib,json
from collections import Counter
from pathlib import Path
R=Path(__file__).resolve().parents[4];E=Path(__file__).resolve().parent;W=R/'data/work/location-batch2/kyushu-okinawa/recheck'
def read(p):return json.loads(p.read_text())
ids=set(read(R/'data/national/location-batch2/kyushu-okinawa/integration.json')['adoptedFacilityIds'])
data={};hashes={};counts={}
for stage in ['before','after']:
 p=W/(stage+'-generated');d={n:read(p/(n+'.json')) for n in ['full','details','pins','manifest']};data[stage]=d
 hashes[stage]={n+'.json':hashlib.sha256((p/(n+'.json')).read_bytes()).hexdigest() for n in ['full','details','pins']}
 assert d['manifest']['files']==hashes[stage]
 assert d['pins']['detailsSHA256']==hashes[stage]['details.json']
 for k in ['places','cards','relations']:assert d['full'][k]==d['details'][k]
 assert d['full']['pins']==d['pins']['pins']
 assert d['full']['evaluatedAt']=='2026-11-05'
 counts[stage]=dict(Counter(p['kind'] for p in d['pins']['pins']))
a=data['before']['full'];b=data['after']['full']
assert a['cards']==b['cards'] and a['relations']==b['relations']
old={p['id']:p for p in a['places']};new={p['id']:p for p in b['places']};assert old.keys()==new.keys()
assert {i for i in old if old[i]!=new[i]}==ids
for i in old:
 if i not in ids:assert old[i]==new[i]
 else:
  assert {k:v for k,v in old[i].items() if k not in ['coordinate','evidence','locationReview']}=={k:v for k,v in new[i].items() if k not in ['coordinate','evidence','locationReview']}
  assert new[i]['coordinate']['status']=='confirmed' and new[i]['locationReview']['status']=='confirmed'
pold={p['id']:p for p in a['pins']};pnew={p['id']:p for p in b['pins']}
assert all(pnew[i]==p for i,p in pold.items())
added=[pnew[i] for i in pnew.keys()-pold.keys()];assert len(added)==5
assert {p['id'] for p in added}==ids
assert counts['after']['place']-counts['before']['place']==5
assert counts['after']['lid']==counts['before']['lid']==1309
report={'schema':1,'baselineCommit':'93904c720fc2b279db26ff3a9329fcf2855c2311','counts':counts,'filesSHA256':hashes,'cards':len(b['cards']),'places':len(b['places']),'relations':len(b['relations']),'generatedUnlocated':{s:sum(p['coordinate']['status']!='confirmed' for p in data[s]['full']['places']) for s in data},'addedPlaceIds':sorted(ids),'existingPinsUnchanged':True,'allRelationsAndCardsUnchanged':True,'fullDetailsPinsGenerationConsistent':True}
(E/'generated-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
