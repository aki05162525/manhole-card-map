import json, pathlib, hashlib, datetime, time, urllib.parse, concurrent.futures, threading
import requests
from bs4 import BeautifulSoup
ROOT=pathlib.Path('data/evidence/national/chugoku-shikoku');ROOT.mkdir(exist_ok=True,parents=True)
D=json.load(open('data/work/national-input/full.json'));CARDS=[c for c in D['cards'] if 31<=int(c['id'][:2])<=39]
manifest_path=ROOT/'manifest.json'
manifest=json.load(open(manifest_path)) if manifest_path.exists() else []
cache={r['url']:r for r in manifest}; locks={};last={};guard=threading.Lock()
def fetch(url):
 if url in cache:return cache[url]
 host=urllib.parse.urlsplit(url).netloc
 with guard:lock=locks.setdefault(host,threading.Lock())
 with lock:
  time.sleep(max(0,1.1-(time.monotonic()-last.get(host,0))))
  rec={'url':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  try:
   r=requests.get(url,timeout=25,headers={'User-Agent':'Mozilla/5.0 (compatible; distribution-data-review/1.0)'})
   ext='.pdf' if 'application/pdf' in r.headers.get('content-type','') else '.html'
   p=ROOT/(hashlib.sha256(url.encode()).hexdigest()[:20]+ext);p.write_bytes(r.content)
   rec.update(status=r.status_code,finalUrl=r.url,snapshotPath=str(p),sha256=hashlib.sha256(r.content).hexdigest())
   if ext=='.html':
    r.encoding=r.apparent_encoding;s=BeautifulSoup(r.text,'html.parser')
    for tag in s(['script','style','nav','header','footer']):tag.decompose()
    p.with_suffix('.txt').write_text(s.get_text('\n',strip=True))
  except Exception as e:rec['error']=str(e)
  last[host]=time.monotonic()
 with guard:
  cache[url]=rec;manifest.append(rec);manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 return rec
if __name__=='__main__':
 import sys
 urls=list(dict.fromkeys(u for c in CARDS for u in (c['links'] or []))) if len(sys.argv)==1 else json.load(open(sys.argv[1]))
 with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
  for r in ex.map(fetch,urls):print(r['url'],r.get('status',r.get('error')),flush=True)
