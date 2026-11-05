from research import *
from urllib.parse import urlparse
records=read(BASE/'fetch-records.json');seen={r['sourceUrl'] for r in records};plan={}
def walk(x):
 if isinstance(x,dict):
  if 'url' in x:yield x
  for v in x.values():yield from walk(v)
 elif isinstance(x,list):
  for v in x:yield from walk(v)
for i in ids:
 opts=[]
 for a in walk(old[i].get('priorAttempts',[])):
  u=a['url'];result=a.get('result','')
  if u in seen or any(s in u for s in ['google','goo.gl','gk-p.jp','/search/']) or any(s in result for s in ['429','503','404','タイムアウト']):continue
  opts.append(u)
 for u in list(dict.fromkeys(opts))[:2]:plan.setdefault(u,[]).append(i)
plan['https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-2022.html']=[]
save('additional-plan.json',plan)
def fetch(item):
 u,ii=item;r={'sourceUrl':u,'facilityIds':ii,'requestedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  try:resp=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'manhole-card-map research/1.0'}),timeout=20)
  except urllib.error.HTTPError as e:resp=e
  b=resp.read();p=BASE/(sha(u.encode())[:24]+('.pdf' if 'pdf' in resp.headers.get('Content-Type','') else '.html'));p.write_bytes(b)
  r.update(status=resp.status,finalUrl=resp.url,snapshotPath=str(p),snapshotSHA256=sha(b),bytes=len(b),contentType=resp.headers.get('Content-Type'),fetchedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
 except Exception as e:r.update(error=str(e),finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
 return r
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:records=list(pool.map(fetch,plan.items()))
 save('additional-fetch-records.json',records);print('additional',len(records),'success',sum(r.get('status')==200 for r in records))
