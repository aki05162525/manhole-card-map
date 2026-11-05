import pathlib,json,re,html,urllib.parse,sys,hashlib,datetime,urllib.request,urllib.error,time,concurrent.futures,threading
from html.parser import HTMLParser
ROOT=pathlib.Path('data/evidence/national/locations-north-tohoku')
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.parts=[];self.a=None
 def handle_starttag(self,t,a):
  d=dict(a)
  if t=='a':self.a=[d.get('href',''),'']
  if t in ('iframe','script') and d.get('src'):self.links.append((d['src'],t))
 def handle_data(self,s):
  self.parts.append(s)
  if self.a:self.a[1]+=s
 def handle_endtag(self,t):
  if t=='a' and self.a:self.links.append(tuple(self.a));self.a=None
def decode(b):
 enc=re.search(br'charset\s*=\s*["\']?([\w-]+)',b[:10000],re.I)
 for e in ([enc.group(1).decode()] if enc else [])+['utf-8','cp932','euc-jp']:
  try:return b.decode(e)
  except (UnicodeError,LookupError):pass
 return b.decode('utf-8',errors='replace')
def parsed(r):
 if not r.get('snapshotPath') or r.get('status')!=200:return '',Parser()
 s=decode(pathlib.Path(r['snapshotPath']).read_bytes()); p=Parser()
 try:p.feed(s)
 except:pass
 return s,p
ledger=json.load(open('data/overrides/regions/north.json'))
ids={r['placeId'] for r in ledger['relations'] if '02'<=r['cardId'][:2]<='07'}
targets=[p for p in ledger['places'] if p['id'] in ids and not p.get('coordinate')]
audit=json.load(open('data/national/regions/north.json'))
old=json.load(open('data/evidence/national/north/manifest.json'))
def records():return old+(json.load(open(ROOT/'manifest.json')) if (ROOT/'manifest.json').exists() else [])
def urls(p):
 us={p['evidence']['sourceUrl']}
 for c in audit['cards']:
  if any(r.get('facilityId')==p['id'] for r in c['relations']):us.update(c['sourceUrls'])
 return sorted(us)
def report():
 m={r['url']:r for r in records()}; additions=json.load(open(ROOT/'additional.json')) if (ROOT/'additional.json').exists() else {}
 out=[]
 for p in targets:
  out.append('\n### '+p['id']+' '+p['name']+' '+p['address'])
  for u in urls(p)+additions.get(p['id'],[]):
   r=m.get(u,{});s,pa=parsed(r)
   out.append('URL '+u+' '+str(r.get('status',r.get('error','NOT FETCHED'))))
   for v,t in pa.links:
    v=urllib.parse.urljoin(r.get('finalUrl',u),v)
    if re.search('access|アクセス|交通|地図|所在地|施設案内|庁舎|google.*map|goo.gl|maps.app',v+' '+t,re.I):out.append('LINK '+t.strip()[:60]+' '+v)
   for match in re.finditer(r'(?:[?&](?:q|ll|destination|daddr|center)=|!2d|!3d|latitude|longitude|LatLng|latlng|緯度|経度).{0,150}',html.unescape(s),re.I):out.append('GEO '+match.group(0))
 (ROOT/'review.txt').write_text('\n'.join(out))
locks={};last={};guard=threading.Lock()
def fetch(url):
 host=urllib.parse.urlsplit(url).netloc
 with guard:lock=locks.setdefault(host,threading.Lock())
 with lock:
  time.sleep(max(0,1.1-(time.monotonic()-last.get(host,0))))
  rec={'url':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; distribution-data-research/1.0)'})
   try:r=urllib.request.urlopen(req,timeout=25)
   except urllib.error.HTTPError as e:r=e
   b=r.read();rec.update(status=r.status,finalUrl=r.geturl(),contentType=r.headers.get('Content-Type',''))
   path=ROOT/(hashlib.sha256(url.encode()).hexdigest()[:20]+('.pdf' if b.startswith(b'%PDF') else '.html'));path.write_bytes(b)
   rec.update(snapshotPath=str(path),snapshotSHA256=hashlib.sha256(b).hexdigest(),bytes=len(b))
  except Exception as e:rec['error']=str(e)
  last[host]=time.monotonic();return rec
def collect(us):
 existing={r['url'] for r in records()}; new=json.load(open(ROOT/'manifest.json')) if (ROOT/'manifest.json').exists() else []
 with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
  for r in pool.map(fetch,sorted(set(us)-existing)):
   new.append(r);(ROOT/'manifest.json').write_text(json.dumps(new,ensure_ascii=False,indent=2)+'\n');print(r['url'],r.get('status',r.get('error')),flush=True)
if __name__=='__main__':
 if len(sys.argv)>1:collect(json.load(open(sys.argv[1])))
 report()
