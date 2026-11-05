import json,re,html,hashlib,datetime,time,urllib.request,urllib.error,urllib.parse, pathlib,concurrent.futures,threading
ROOT=pathlib.Path('data/evidence/national/locations-kyushu-okinawa'); OLD=json.load(open('data/evidence/national/kyushu-okinawa/manifest.json'))
MAN=ROOT/'manifest.json'; records=json.load(open(MAN)) if MAN.exists() else []
cache={}
for x in OLD+records:
 for k in ['url','finalUrl']:
  if x.get(k): cache[x[k].split('#')[0]]=x
locks={}; last={}; guard=threading.Lock()
def fetch(url):
 url=html.unescape(url).strip().split('#')[0]
 if url in cache:return cache[url]
 host=urllib.parse.urlsplit(url).netloc
 with guard: lock=locks.setdefault(host,threading.Lock())
 with lock:
  if url in cache:return cache[url]
  time.sleep(max(0,1.05-(time.monotonic()-last.get(host,0))))
  x={'url':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  try:
   r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; facility-evidence-research)'}),timeout=25)
   b=r.read();x.update(status=r.status,finalUrl=r.url,contentType=r.headers.get('Content-Type',''))
  except urllib.error.HTTPError as e:
   b=e.read();x.update(status=e.code,finalUrl=e.url,error=str(e),contentType=e.headers.get('Content-Type',''))
  except Exception as e:b=None;x.update(error=str(e))
  last[host]=time.monotonic()
  if b is not None:
   ext='.pdf' if b.startswith(b'%PDF') else '.html';p=ROOT/(hashlib.sha256(url.encode()).hexdigest()[:24]+ext);p.write_bytes(b)
   x.update(snapshotPath=str(p),snapshotSHA256=hashlib.sha256(b).hexdigest())
  with guard:
   records.append(x);cache[url]=x
   if x.get('finalUrl'):cache[x['finalUrl']]=x
   MAN.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
  return x
def read(x):
 if not x.get('snapshotPath'):return ''
 b=pathlib.Path(x['snapshotPath']).read_bytes()
 for enc in ['utf-8','cp932','euc-jp']:
  try:return b.decode(enc)
  except:pass
 return b.decode('utf-8',errors='replace')
def links(x):
 return [(html.unescape(re.sub('<[^>]+>','',t)).strip(),urllib.parse.urljoin(x.get('finalUrl',x['url']),html.unescape(u))) for u,t in re.findall(r'<a[^>]*href=[\"\x27]([^\"\x27]+)[\"\x27][^>]*>(.*?)</a>',read(x),re.S|re.I)]
def scan(x):
 s=read(x)
 return list(dict.fromkeys(re.findall(r'.{0,90}(?:!3d[\d.-]+!4d[\d.-]+|[?&](?:q|destination)=[\d.,%+-]+|latitude.{0,100}|LatLng\(.{0,100}|(?:lat|lng|lon)[\"\x27 ]*[:=]\s*[\"\x27]?[\d.-]+|[Mm]arker.{0,100}).{0,100}',s)))
if __name__=='__main__':
 import sys
 urls=json.load(open(sys.argv[1]));
 with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
  for x in pool.map(fetch,urls):print(x['url'],x.get('status',x.get('error')),flush=True)
