import json,pathlib,hashlib,datetime,time,threading,concurrent.futures,urllib.parse,re
import requests
from bs4 import BeautifulSoup
ROOT=pathlib.Path('data/evidence/national/kanto-south-locations-tokyo')
def read(p):return json.loads(pathlib.Path(p).read_text())
def write(p,x):pathlib.Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
P=read(ROOT/'targets.json');old=read('data/evidence/national/kanto-south/manifest.json');new=read(ROOT/'manifest.json') if (ROOT/'manifest.json').exists() else [];M={r['url']:r for r in old+new}
for r in old+new:
 if r.get('finalUrl'):M.setdefault(r['finalUrl'],r)
locks={};last={}
def fetch(u):
 u=urllib.parse.urldefrag(u)[0]
 if u in M:return M[u]
 host=urllib.parse.urlsplit(u).netloc
 with locks.setdefault(host,threading.Lock()):
  if u in M:return M[u]
  time.sleep(max(0,1.1-(time.monotonic()-last.get(host,0))))
  r={'url':u,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()};p=ROOT/(hashlib.sha256(u.encode()).hexdigest()[:20]+'.html')
  try:
   q=requests.get(u,timeout=25);p.write_bytes(q.content);r.update(status=q.status_code,finalUrl=q.url,snapshotPath=str(p),sha256=hashlib.sha256(q.content).hexdigest());q.encoding=q.apparent_encoding
   if q.content.startswith(b'%PDF'):
    last[host]=time.monotonic();M[u]=r;new.append(r);return r
   s=BeautifulSoup(q.text,'html.parser')
   for e in s(['script','style','nav','header','footer']):e.decompose()
   p.with_suffix('.txt').write_text(s.get_text('\n',strip=True))
  except Exception as e:r['error']=str(e)
  last[host]=time.monotonic();M[u]=r;new.append(r)
  return r
def soup(u):
 r=M.get(u)
 if not r or r.get('status')!=200:return None
 return BeautifulSoup(pathlib.Path(r['snapshotPath']).read_bytes(),'html.parser')
def links(u):
 s=soup(u)
 if not s:return []
 return [(e.get_text(' ',strip=True),urllib.parse.urldefrag(urllib.parse.urljoin(M[u].get('finalUrl',u),e.get('href','')))[0]) for e in s.find_all('a',href=True)]
def candidates(u):
 s=soup(u)
 if not s:return []
 out=[]
 for e in s.find_all(['a','iframe','script']):
  v=e.get('href') or e.get('src') or e.get_text()
  if re.search(r'(?:[?&](?:q|destination|ll)=|!3d|!2d|LatLng|latitude|longitude|"lat"|lat:)',v,re.I):out.append(v[:2500])
 return list(dict.fromkeys(out))
if __name__=='__main__':
 jobs={}
 for p in P:
  us=[]
  for u in p['urls']:
   for t,v in links(u):
    if not v.startswith('http') or re.search(r'\.(pdf|jpg|png)$',v):continue
    if any(w in t for w in ['アクセス','交通案内','所在地']) and len(t)<70 or (len(t)>4 and t in p['name']):us.append(v)
  jobs[str(p['index'])]=list(dict.fromkeys(us))
 write(ROOT/'jobs.json',jobs)
 todo=list(dict.fromkeys(u for us in jobs.values() for u in us))
 with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
  for r in ex.map(fetch,todo):print(r['url'],r.get('status',r.get('error')),flush=True);write(ROOT/'manifest.json',new)
 report=[]
 for p in P:
  report.append('\n### '+str(p['index'])+' '+p['name']+' '+p['address'])
  for u in list(dict.fromkeys(p['urls']+jobs[str(p['index'])])):
   cs=candidates(u)
   if cs:report.append(u+'\n'+'\n'.join(cs))
 (ROOT/'candidates.txt').write_text('\n'.join(report))
