import json,pathlib,hashlib,urllib.request,urllib.error,urllib.parse,time,datetime,threading,concurrent.futures,re,sys
from bs4 import BeautifulSoup
ROOT=pathlib.Path('data/evidence/national/locations-chubu-east-north'); MP=ROOT/'manifest.json'
def loadcache():
 c={}
 for p in pathlib.Path('data/evidence').rglob('manifest.json'):
  try:m=json.loads(p.read_text())
  except:continue
  if isinstance(m,dict):m=m.get('sources',m.get('entries',[]))
  if not isinstance(m,list):continue
  for x in m:
   if not isinstance(x,dict):continue
   u=x.get('url',x.get('sourceUrl'));sp=x.get('snapshotPath')
   if u and sp and pathlib.Path(sp).is_file():
    c[u]=x
    if x.get('finalUrl'):c[x['finalUrl']]=x
 return c
cache=loadcache();manifest=json.loads(MP.read_text()) if MP.exists() else [];lock=threading.Lock();hosts={}
def fetch(u):
 u=urllib.parse.urldefrag(u)[0]
 if u in cache:return dict(cache[u],reused=True)
 h=urllib.parse.urlsplit(u).netloc
 with lock:hl=hosts.setdefault(h,threading.Lock())
 with hl:
  time.sleep(1.05);now=datetime.datetime.now(datetime.timezone.utc).isoformat();m={'url':u,'fetchedAt':now,'actorType':'ai'}
  try:
   with urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0 (facility evidence audit)'}),timeout=25) as r:
    raw=r.read();m.update(status=r.status,finalUrl=r.url,contentType=r.headers.get('Content-Type',''))
  except urllib.error.HTTPError as e:raw=e.read();m.update(status=e.code,error=str(e))
  except Exception as e:raw=None;m.update(status=None,error=str(e))
  if raw is not None:
   p=ROOT/(hashlib.sha256(u.encode()).hexdigest()[:24]+('.pdf' if 'pdf' in m.get('contentType','') else '.html'));p.write_bytes(raw);m.update(snapshotPath=str(p),sha256=hashlib.sha256(raw).hexdigest(),bytes=len(raw))
  with lock:
   manifest.append(m);cache[u]=m;MP.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
  return m
def inspect(m):
 if not m.get('snapshotPath') or m.get('status')!=200:return {'error':m.get('error')}
 raw=pathlib.Path(m['snapshotPath']).read_bytes();s=BeautifulSoup(raw,'html.parser');text=s.get_text(' ',strip=True);u=m.get('finalUrl',m['url']);links=[]
 for a in s.find_all(['a','iframe','script']):
  h=a.get('href',a.get('src',''));t=a.get_text(' ',strip=True)
  if re.search(r'maps|map\?|アクセス|交通|所在地|施設案内|access|\.js',h+' '+t,re.I):links.append((t[:80],urllib.parse.urljoin(u,h)))
 coords=re.findall(r'.{0,90}(?:latitude|longitude|LatLng|lat["\s:]+\d|destination=|marker=|q=\d\d\.|!3d\d|!4d\d).{0,190}',raw.decode('utf-8','replace'))
 return {'title':s.title.get_text() if s.title else '', 'links':links,'coords':coords,'text':text}
if __name__=='__main__':
 q=json.load(open(sys.argv[1]));urls=list(dict.fromkeys(u for us in q.values() for u in us));out={}
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
  for u,m in zip(urls,pool.map(fetch,urls)):
   out[u]={'manifest':m,**inspect(m)};print(m.get('status'),u,flush=True)
 (ROOT/(pathlib.Path(sys.argv[1]).stem+'-results.json')).write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
