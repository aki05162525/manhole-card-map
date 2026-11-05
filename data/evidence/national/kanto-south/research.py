import json,hashlib,pathlib,time,threading,concurrent.futures,urllib.parse,datetime
import requests
from bs4 import BeautifulSoup
ROOT=pathlib.Path('data/evidence/national/kanto-south');ROOT.mkdir(exist_ok=True,parents=True)
d=json.load(open('data/work/national-input/full.json'));cards=[c for c in d['cards'] if c['id'][:2] in ('00','12','13','14')]
locks={};last={}
urls=sorted({u for c in cards for u in c.get('links') or [] if u.startswith('http')})
for u in urls: locks.setdefault(urllib.parse.urlsplit(u).netloc,threading.Lock())
manifest=json.load(open(ROOT/'manifest.json')) if (ROOT/'manifest.json').exists() else []
done={r['url'] for r in manifest}
def fetch(u):
 host=urllib.parse.urlsplit(u).netloc
 with locks[host]:
  time.sleep(max(0,1-(time.monotonic()-last.get(host,0))))
  stamp=datetime.datetime.now(datetime.timezone.utc).isoformat();p=ROOT/(hashlib.sha256(u.encode()).hexdigest()[:20]+'.html');r={'url':u,'fetchedAt':stamp}
  try:
   q=requests.get(u,timeout=35);p.write_bytes(q.content);r.update(status=q.status_code,finalUrl=q.url,snapshotPath=str(p),sha256=hashlib.sha256(q.content).hexdigest())
   q.encoding=q.apparent_encoding;s=BeautifulSoup(q.text,'html.parser')
   for el in s(['script','style','header','footer','nav']):el.decompose()
   p.with_suffix('.txt').write_text(s.get_text('\n',strip=True))
  except Exception as e:r['error']=str(e)
  last[host]=time.monotonic()
  return r
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
  for r in ex.map(fetch,[u for u in urls if u not in done]):
   manifest.append(r);(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(r['url'],r.get('status',r.get('error')),flush=True)
 print('cards',len(cards),'urls',len(urls))
