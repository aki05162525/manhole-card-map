import json,hashlib,copy
from pathlib import Path
D=Path('data/national/location-batch2/hokkaido');E=Path('data/evidence/location-batch2/hokkaido');W=Path('data/work/location-batch2/hokkaido')
load=lambda p:json.loads(Path(p).read_text());sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
s=load(D/'selection.json');o=load(D/'outcomes.json');r=load(E/'retrievals.json');v=load(E/'vector-exploration.json')
for row in r+v['ranges']+v['tiles']:
 if 'snapshotPath' in row:assert sha(row['snapshotPath'])==row['snapshotSHA256']
for path in [D/'selection.json',D/'outcomes.json',E/'facts.json']:
 def walk(x):
  if isinstance(x,str) and x.startswith('data/') and '#' in x:
   f,ptr=x.split('#',1);cur=load(f)
   for k in ptr.lstrip('/').split('/'):cur=cur[int(k)] if isinstance(cur,list) else cur[k]
  elif isinstance(x,dict):
   for val in x.values():walk(val)
  elif isinstance(x,list):
   for val in x:walk(val)
 walk(load(path))
b=load(W/'before-ledger.json');a=load(W/'after-ledger.json');old={p['id']:p for p in b['places']};new={p['id']:p for p in a['places']};fid='facility:north-53b2b9df9a8da2705261'
assert b['relations']==a['relations'];assert {i for i in old if old[i]!=new[i]}=={fid}
for i in old:
 x,y=copy.deepcopy(old[i]),copy.deepcopy(new[i])
 if i==fid:
  for k in ['coordinate','evidence','locationReview']:x.pop(k,None);y.pop(k,None)
 assert x==y
assert len(s['rows'])==38 and len(s['selectedIds'])==8
assert {r['facilityId'] for r in o['rows']}==set(s['selectedIds'])
sets={r['facilityId'] for r in load('data/national/issue24/priorities-snapshot.json')['rows'] if 'hokkaido' in r['originalRef']}
assert sets=={r['facilityId'] for r in s['rows']}
bg=load(W/'before-generated/full.json');ag=load(W/'after-generated/full.json');details=load(W/'after-generated/details.json');pins=load(W/'after-generated/pins.json');m=load(W/'after-generated/manifest.json')
assert bg['relations']==ag['relations']
assert details['places']==ag['places'];assert pins['pins']==ag['pins']
assert pins['detailsSHA256']==sha(W/'after-generated/details.json')
for p,h in m['files'].items():assert sha(W/'after-generated'/p)==h
before_pins={p['id']:p for p in bg['pins']};after_pins={p['id']:p for p in ag['pins']};assert set(after_pins)-set(before_pins)=={fid}
assert all(after_pins[i]==p for i,p in before_pins.items())
oldplaces={p['id']:p for p in bg['places']};newplaces={p['id']:p for p in ag['places']};assert {i for i in oldplaces if oldplaces[i]!=newplaces[i]}=={fid}
result={'schema':1,'checks':['原本/PMTiles range SHA256','JSON pointer','地域全38 IDと8選定一致','全関係不変','台帳差分は科学館coordinate/evidence/locationReviewのみ','full/details一致','既存ピン全件不変・科学館1ピン追加','pins.detailsSHA256/manifest file hashes'],'counts':{'beforeNationalUnlocated':sum(not p.get('coordinate') for p in b['places']),'afterNationalUnlocated':sum(not p.get('coordinate') for p in a['places']),'beforePlacePins':sum(p['kind']=='place' for p in bg['pins']),'afterPlacePins':sum(p['kind']=='place' for p in ag['pins']),'regionalBeforeUnlocated':38,'regionalAfterUnlocated':37},'inputs':{str(p):sha(p) for p in [W/'before-ledger.json',W/'after-ledger.json',W/'before-generated/full.json',W/'after-generated/full.json',W/'after-generated/details.json',W/'after-generated/pins.json']},'reusedInputs':{str(p):sha(p) for p in [Path('data/raw/gkp-list-20261021.html'),Path('data/work/municheck.json'),Path('data/work/ocr.json'),Path('data/work/geocoded-c.json'),Path('data/work/addresses-sources.json')]},'reuseNote':'親rootの保存原本を同パスでコピー。再取得ではない。一覧取得日2026-10-21、review-list保存2026-11-05、as-of2026-11-05。'}
(D/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(result['counts'])
