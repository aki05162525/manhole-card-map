import json, pathlib, hashlib, datetime, concurrent.futures, urllib.request, urllib.error, zipfile, io, re
ROOT=pathlib.Path(__file__).resolve().parents[4]
OUT=ROOT/'data/evidence/issue7/south-kanto'
def read(p):return json.loads((ROOT/p).read_text())
def save(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
ids=read('data/work/issue7-baseline/assignments.json')['south-kanto']
old={r['facilityId']:r for r in read('data/national/issue5/south-kanto.json')['unresolved']}
places={r['id']:r for r in read('data/work/issue7-baseline/full.json')['places']}
if __name__=='__main__':
 if (OUT/'fetch-records.json').exists():raise SystemExit('Existing acquisition records preserved; use extra.py for additional URLs.')
 save(OUT/'input-hashes.json',{str(p.relative_to(ROOT)):sha(p) for p in (ROOT/'data/work/issue7-baseline').glob('*.json')})
 targets=[]; urls={}
 for id in ids:
  r=old[id]; sources=r.get('sourcesReused',[])
  selected=[]
  for s in sources:
   u=s.get('sourceUrl',s.get('url',''))
   if u and not any(x in u for x in ['google.','maps.app','nlftp.mlit','japan47go','gkp.jp']) and u not in selected:selected.append(u)
  for u in selected:urls.setdefault(u,[]).append(id)
  targets.append({'facilityId':id,'name':places[id]['name'],'address':places[id].get('address'), 'priorReason':r['reason'],'urls':selected})
 save(OUT/'targets.json',targets)
 def fetch(item):
  u,ids=item; now=datetime.datetime.now(datetime.timezone.utc).isoformat(); result={'url':u,'facilityIds':ids,'fetchedAt':now}
  try:
   req=urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0 (facility location research)'})
   try:resp=urllib.request.urlopen(req,timeout=22)
   except urllib.error.HTTPError as e:resp=e
   b=resp.read(); p=OUT/(hashlib.sha256(u.encode()).hexdigest()[:24]+'.raw');p.write_bytes(b)
   result.update(status=resp.code,finalUrl=resp.url,snapshotPath=str(p.relative_to(ROOT)),snapshotSHA256=sha(p),contentType=resp.headers.get('Content-Type'))
  except Exception as e:result['error']=str(e)
  return result
 with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:records=list(pool.map(fetch,urls.items()))
 save(OUT/'fetch-records.json',records)
 print('targets',len(targets),'URLs',len(records),'success',sum(x.get('status')==200 for x in records))
