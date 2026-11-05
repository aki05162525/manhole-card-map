import json,pathlib,hashlib
R=pathlib.Path('data/evidence/issue5/north-kanto')
def walk(x):
 if isinstance(x,dict):
  yield x
  for v in x.values():yield from walk(v)
 elif isinstance(x,list):
  for v in x:yield from walk(v)
records=[]
for p in pathlib.Path('data/evidence/national').glob('*kanto-north*/*.json'):
 try:d=json.loads(p.read_text())
 except (ValueError,UnicodeError):continue
 for x in walk(d):
  if x.get('snapshotSHA256') and x.get('fetchedAt'):records.append((p,x))
count=0
for p in [R/'reused-originals.json',R/'inventory.json',pathlib.Path('data/national/issue5/north-kanto.json')]:
 d=json.loads(p.read_text())
 for x in walk(d):
  if 'acquisitionTimeStatus' not in x:continue
  matches=[(mp,m) for mp,m in records if m.get('snapshotSHA256')==x['snapshotSHA256'] and m.get('url',m.get('sourceUrl'))==x['sourceUrl'] and not m.get('cacheReused') and not m.get('reusedFrom')]
  if matches:
   mp,m=matches[0];x['fetchedAt']=m['fetchedAt'];x['acquisitionTimeStatus']='旧取得メタデータの非cache記録をURL・SHA256で照合。今回取得時刻ではない。';x['acquisitionRecord']={'path':str(mp),'sha256':hashlib.sha256(mp.read_bytes()).hexdigest(),'record':m};count+=1
 p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print('enriched reference instances',count)
