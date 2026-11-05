import json, pathlib, hashlib, datetime, time, concurrent.futures, urllib.parse, threading
import requests
from bs4 import BeautifulSoup
ROOT=pathlib.Path('data/evidence/national/chubu-west'); MAN=ROOT/'manifest.json'
x=json.load(open('data/work/national-input/full.json')); cards=[c for c in x['cards'] if c['id'][:2] in ['21','22','23']]
manifest=json.load(open(MAN)) if MAN.exists() else []
cache={m['url']:m for m in manifest}; locks={};times={}
def fetch(u):
 u=u.split('#')[0]
 if u in cache:return cache[u]
 host=urllib.parse.urlparse(u).netloc
 lock=locks.setdefault(host,threading.Lock())
 with lock:
  time.sleep(max(0,1.1-(time.time()-times.get(host,0))))
  now=datetime.datetime.now(datetime.timezone.utc).isoformat(); ident=hashlib.sha256(u.encode()).hexdigest()[:20]
  m={'url':u,'fetchedAt':now}
  try:
   r=requests.get(u,timeout=35); p=ROOT/(ident+'.html');p.write_bytes(r.content)
   m.update(status=r.status_code,finalUrl=r.url,snapshotPath=str(p),snapshotSHA256=hashlib.sha256(r.content).hexdigest())
   soup=BeautifulSoup(r.content,'html.parser')
   for z in soup(['script','style','nav','header','footer']): z.decompose()
   (ROOT/(ident+'.txt')).write_text(soup.get_text('\n',strip=True))
  except Exception as e:m['error']=str(e)
  times[host]=time.time();cache[u]=m
 return m
if __name__=='__main__':
 import sys
 urls=sys.argv[1:] or sorted({u.split('#')[0] for c in cards for u in c.get('links',[]) if 'google.com/maps' not in u and 'instagram.com' not in u})
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
  for m in ex.map(fetch,urls):
   if m not in manifest:manifest.append(m)
   MAN.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print('Fetched',len(manifest),'success',sum(m.get('status')==200 for m in manifest))
