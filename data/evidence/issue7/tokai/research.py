import json,pathlib,hashlib,datetime,concurrent.futures,urllib.request,urllib.error,zipfile,io,re
ROOT=pathlib.Path('.');OUT=ROOT/'data/evidence/issue7/tokai'
def read(p):return json.loads(pathlib.Path(p).read_text())
def save(p,d):pathlib.Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
ids=read('data/work/issue7-baseline/assignments.json')['tokai'];places={x['id']:x for x in read('data/work/issue7-baseline/ledger.json')['places']};old=read('data/national/issue5/chubu.json');un={x['facilityId']:x for x in old['unresolved']}
if __name__=='__main__':
 if (OUT/'fetch-records.json').exists():raise SystemExit('Existing acquisition records are immutable; use a new batch file for further research.')
 paths=list(pathlib.Path('data/work/issue7-baseline').glob('*.json'))+[pathlib.Path('data/national/issue5/chubu.json'),pathlib.Path('data/national/issue5/reviews/chubu.json'),pathlib.Path('data/national/location-updates/chubu-west.json'),pathlib.Path('data/national/reviews/chubu-west-locations.json'),pathlib.Path('data/evidence/issue5/chubu/P05-22_GML.zip')]
 save(OUT/'input-hashes.json',{str(p):sha(p) for p in paths})
 jobs={}
 for id in ids:
  urls=[places[id]['evidence']['sourceUrl']]
  for p in un.get(id,{}).get('priorResearch',[]):
   for a in p['record'].get('attempts',[]):
    u=a.get('url','')
    if u.startswith('https://') and not any(t in u for t in ['google.','goo.gl']) and u not in urls:urls.append(u)
  for u in urls[:3]:jobs.setdefault(u,[]).append(id)
 def fetch(item):
  u,fids=item;p=OUT/(hashlib.sha256(u.encode()).hexdigest()[:20]+'.html');r={'url':u,'facilityIds':fids,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  try:
   res=urllib.request.urlopen(u,timeout=25);data=res.read();p.write_bytes(data);r.update(status=res.status,finalUrl=res.url,snapshotPath=str(p),snapshotSHA256=sha(p),contentType=res.headers.get('content-type'),bytes=len(data))
  except Exception as e:r['error']=str(e)
  r['fetchedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();return r
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:records=list(ex.map(fetch,jobs.items()))
 save(OUT/'fetch-records.json',records)
 print('fetched',len(records),'ok',sum(x.get('status')==200 for x in records))
