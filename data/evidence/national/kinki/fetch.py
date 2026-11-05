import json, pathlib, hashlib, datetime, time, concurrent.futures, urllib.parse, threading
import requests
from bs4 import BeautifulSoup
ROOT=pathlib.Path('data/evidence/national/kinki'); SNAP=ROOT/'snapshots';SNAP.mkdir(exist_ok=True)
x=json.load(open('data/work/national-input/full.json')); cards=[c for c in x['cards'] if '24'<=c['id'][:2]<='30']
urls=sorted({u for c in cards for u in c.get('links') or [] if 'google.' not in u})
manifest=json.load(open(ROOT/'manifest.json')) if (ROOT/'manifest.json').exists() else []
cache={m['url']:m for m in manifest}; locks={}; last={}
def fetch(u):
 if u in cache:return cache[u]
 host=urllib.parse.urlparse(u).netloc
 with locks.setdefault(host,threading.Lock()):
  time.sleep(max(0,1.1-(time.monotonic()-last.get(host,0))));last[host]=time.monotonic()
  m={'url':u,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  try:
   r=requests.get(u,timeout=35,headers={'User-Agent':'ManholeCardMap evidence research/1.0'});m.update(status=r.status_code,finalUrl=r.url,contentType=r.headers.get('Content-Type',''))
   b=r.content;sha=hashlib.sha256(b).hexdigest();p=SNAP/(hashlib.sha256(u.encode()).hexdigest()[:20]+'.html');p.write_bytes(b);m.update(snapshotPath=str(p),snapshotSHA256=sha)
   if 'html' in m['contentType']:
    soup=BeautifulSoup(b,'html.parser');[s.decompose() for s in soup(['script','style','nav','header','footer'])];p.with_suffix('.txt').write_text(soup.get_text('\n',strip=True))
  except Exception as e:m['error']=str(e)
  cache[u]=m
  print(m.get('status','ERR'),u,flush=True)
  return m
if __name__=='__main__':
 import sys
 if len(sys.argv)>1:urls=json.load(open(sys.argv[1]))
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:list(ex.map(fetch,urls))
 (ROOT/'manifest.json').write_text(json.dumps(list(cache.values()),ensure_ascii=False,indent=2)+'\n')
