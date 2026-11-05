import json,urllib.request,urllib.error,urllib.parse,hashlib,datetime,time,concurrent.futures,threading,re
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path('data/evidence/national/kyushu-okinawa'); MAN=ROOT/'manifest.json'
class Text(HTMLParser):
 def __init__(self): super().__init__();self.parts=[];self.skip=0
 def handle_starttag(self,t,a):
  if t in ('script','style'): self.skip+=1
  if t in ('p','div','br','tr','td','li','h1','h2','h3','h4'):self.parts.append('\n')
 def handle_endtag(self,t):
  if t in ('script','style'): self.skip=max(0,self.skip-1)
 def handle_data(self,d):
  if not self.skip:self.parts.append(d)
def plain(b):
 enc=re.search(br'charset\s*=\s*["\']?([\w-]+)',b[:8000],re.I); enc=enc.group(1).decode() if enc else 'utf-8'
 try:s=b.decode(enc,errors='replace')
 except:s=b.decode('utf-8',errors='replace')
 p=Text();p.feed(s);return '\n'.join(x.strip() for x in ''.join(p.parts).splitlines() if x.strip())
locks={};last={};guard=threading.Lock()
def fetch(u):
 host=urllib.parse.urlsplit(u).netloc
 with guard:lock=locks.setdefault(host,threading.Lock())
 with lock:
  time.sleep(max(0,1.05-(time.monotonic()-last.get(host,0))))
  now=datetime.datetime.now(datetime.timezone.utc).isoformat(); entry={'url':u,'fetchedAt':now}
  try:
   r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0 (compatible; distribution-data-research/1.0)'}),timeout=35);b=r.read();entry.update(status=r.status,finalUrl=r.url,contentType=r.headers.get('Content-Type',''))
  except urllib.error.HTTPError as e:b=e.read();entry.update(status=e.code,finalUrl=e.url,error=str(e))
  except Exception as e: b=None;entry.update(error=str(e))
  last[host]=time.monotonic()
  if b is not None:
   suffix='.pdf' if b.startswith(b'%PDF') else '.png' if b.startswith(b'\x89PNG') else '.jpg' if b.startswith(b'\xff\xd8') else '.gif' if b.startswith(b'GIF8') else '.zip' if b.startswith(b'PK\x03\x04') else '.html';p=ROOT/(hashlib.sha256(u.encode()).hexdigest()[:20]+suffix);p.write_bytes(b);entry.update(snapshotPath=str(p),snapshotSHA256=hashlib.sha256(b).hexdigest())
  return entry
if __name__=='__main__':
 import sys
 d=json.load(open('data/work/national-input/full.json'));cs=[c for c in d['cards'] if '40'<=c['id'][:2]<='47']
 old=json.load(open(MAN)) if MAN.exists() else [];cache={e['url']:e for e in old}
 urls=json.load(open(sys.argv[1])) if len(sys.argv)>1 else sorted({u for c in cs for u in c.get('links') or []})
 with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
  for e in pool.map(fetch,[u for u in urls if u not in cache]):
   old.append(e);MAN.write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n');print(e['url'],e.get('status',e.get('error')),flush=True)
