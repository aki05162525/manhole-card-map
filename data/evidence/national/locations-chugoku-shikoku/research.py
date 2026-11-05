import json,pathlib,urllib.request,urllib.parse,urllib.error,hashlib,datetime,time,threading,concurrent.futures,re,html
ROOT=pathlib.Path(__file__).parent
manifest_path=ROOT/'manifest.json'
manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else []
cache={}
for p in pathlib.Path('data/evidence').rglob('*manifest*.json'):
 try:
  rows=json.loads(p.read_text())
  if not isinstance(rows,list): continue
  for r in rows:
   if isinstance(r,dict) and r.get('url') and (r.get('snapshotPath') or r.get('error')):
    cache[r['url']]=r
    if r.get('finalUrl'): cache[r['finalUrl']]=r
 except Exception: pass
locks={};last={};guard=threading.Lock()
def fetch(url):
 url=urllib.parse.urldefrag(url)[0]
 if url in cache:return cache[url]
 host=urllib.parse.urlsplit(url).netloc
 with guard: lock=locks.setdefault(host,threading.Lock())
 with lock:
  if url in cache:return cache[url]
  time.sleep(max(0,1.1-(time.monotonic()-last.get(host,0))))
  r={'url':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  try:
   try: response=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; official-facility-review/1.0)'}),timeout=25)
   except urllib.error.HTTPError as e: response=e
   b=response.read(); ct=response.headers.get('Content-Type','')
   ext='.pdf' if 'pdf' in ct else '.html'
   path=ROOT/(hashlib.sha256(url.encode()).hexdigest()[:20]+ext);path.write_bytes(b)
   r.update(status=response.status,finalUrl=response.url,snapshotPath=str(path),sha256=hashlib.sha256(b).hexdigest(),contentType=ct)
  except Exception as e:r['error']=str(e)
  last[host]=time.monotonic()
 with guard:
  manifest.append(r);cache[url]=r
  if r.get('finalUrl'):cache[r['finalUrl']]=r
  manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 return r
def read(r):
 p=pathlib.Path(r.get('snapshotPath',''))
 if not p.is_file() or p.suffix=='.pdf':return ''
 b=p.read_bytes()
 for enc in ['utf-8','cp932','euc-jp']:
  try:return b.decode(enc)
  except UnicodeDecodeError:pass
 return b.decode('utf-8',errors='replace')
def inspect(r):
 s=read(r); out=[]
 for m in re.finditer(r'latitude|longitude|LatLng|[?&](?:q|query|destination)=3[3456]\.|"lat"|lat:|markerInfos|maps/embed|og:latitude',s,re.I):
  out.append(s[max(0,m.start()-65):m.end()+210])
 return out
if __name__=='__main__':
 import sys
 urls=json.load(open(sys.argv[1]))
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
  for r in ex.map(fetch,urls):
   print(r['url'],r.get('status',r.get('error')),flush=True)
   print('\n'.join(inspect(r))[:3000],flush=True)
