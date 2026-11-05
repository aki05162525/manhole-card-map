import json,pathlib,hashlib,datetime,time,threading,concurrent.futures,re,urllib.parse,shutil
import requests
from bs4 import BeautifulSoup
ROOT=pathlib.Path('data/evidence/national/locations-chubu-west')
OLD=pathlib.Path('data/evidence/national/chubu-west')
manifest=json.load(open(ROOT/'manifest.json')) if (ROOT/'manifest.json').exists() else []
cache={}
for m in json.load(open(OLD/'manifest.json'))+manifest:
 for u in [m['url'],m.get('finalUrl','')]:
  if u:cache[u]=m
locks={}; times={}
def fetch(u):
 u=u.split('#')[0]
 if u in cache:return cache[u]
 host=urllib.parse.urlparse(u).netloc; lock=locks.setdefault(host,threading.Lock())
 with lock:
  if u in cache:return cache[u]
  time.sleep(max(0,1.1-(time.time()-times.get(host,0))))
  now=datetime.datetime.now(datetime.timezone.utc).isoformat();ident=hashlib.sha256(u.encode()).hexdigest()[:24]
  m={'url':u,'fetchedAt':now}
  try:
   r=requests.get(u,timeout=25);p=ROOT/(ident+'.html');p.write_bytes(r.content)
   m.update(status=r.status_code,finalUrl=r.url,snapshotPath=str(p),snapshotSHA256=hashlib.sha256(r.content).hexdigest())
  except Exception as e:m['error']=str(e)
  times[host]=time.time();cache[u]=m
 return m
def batch(urls):
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
  for m in ex.map(fetch,dict.fromkeys(urls)):
   if m not in manifest:manifest.append(m)
   (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
def soup(m):
 return BeautifulSoup(pathlib.Path(m['snapshotPath']).read_bytes(),'html.parser') if m.get('status')==200 else None
def coords(s):
 t=str(s);out=[]
 for p in [r'(?:q|query|destination)=(-?\d+\.\d+)[,%2C ]+(1\d\d\.\d+)',r'!2d(1\d\d\.\d+)!3d(\d\d\.\d+)',r'!3d(\d\d\.\d+)!4d(1\d\d\.\d+)']:
  for m in re.finditer(p,urllib.parse.unquote(t)):
   a,b=m.groups();out.append((a,b,m.group()))
 for line in t.splitlines():
  if re.search('latitude|longitude|LatLng|latlng|marker|map_lat|map_lng',line,re.I) and re.search(r'\d{2,3}\.\d{3}',line):out.append(line[:1600])
 return out
if __name__=='__main__':
 import sys
 if len(sys.argv)>1:batch(sys.argv[1:])
