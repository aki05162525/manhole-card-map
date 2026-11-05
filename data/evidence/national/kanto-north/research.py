#!/usr/bin/env python3
"""Cache original response bytes, timestamps and errors; per-host rate limit."""
import json,hashlib,time,threading,urllib.request,urllib.error,urllib.parse,concurrent.futures,datetime,pathlib,re,sys
from html.parser import HTMLParser
ROOT=pathlib.Path('data/evidence/national/kanto-north'); MAN=ROOT/'manifest.json'
lock=threading.Lock(); hosts={}
class Text(HTMLParser):
 def __init__(self):super().__init__();self.parts=[];self.skip=0;self.links=[]
 def handle_starttag(self,t,a):
  d=dict(a)
  if t in ('script','style'):self.skip+=1
  if t in ('p','br','div','li','tr','h1','h2','h3','h4','td'):self.parts.append('\n')
  if t=='a' and d.get('href'):self.links.append(d['href'])
 def handle_endtag(self,t):
  if t in ('script','style'):self.skip=max(0,self.skip-1)
 def handle_data(self,d):
  if not self.skip:self.parts.append(d)
def decode(b):
 encs=['utf-8','cp932','euc-jp']
 m=re.search(br'charset=["\s]*([\w-]+)',b[:5000],re.I)
 if m:encs.insert(0,m[1].decode())
 for e in encs:
  try:return b.decode(e)
  except (UnicodeError,LookupError):pass
 return b.decode('utf-8','replace')
def fetch(url):
 url=urllib.parse.urldefrag(url)[0]; host=urllib.parse.urlsplit(url).netloc
 with lock:hl=hosts.setdefault(host,threading.Lock())
 with hl:
  time.sleep(1.05);now=datetime.datetime.now(datetime.timezone.utc).isoformat(); key=hashlib.sha256(url.encode()).hexdigest()[:20]
  row={'url':url,'fetchedAt':now}
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; ManholeCardDataResearch/1.0)'})
   with urllib.request.urlopen(req,timeout=35) as r:b=r.read();row.update(status=r.status,finalUrl=r.url,contentType=r.headers.get('Content-Type',''))
  except urllib.error.HTTPError as e:b=e.read();row.update(status=e.code,error=str(e))
  except Exception as e:row['error']=str(e);return row
  path=ROOT/(key+'.html');path.write_bytes(b);row.update(snapshotPath=str(path),snapshotSHA256=hashlib.sha256(b).hexdigest())
  if 'pdf' not in row.get('contentType',''):
   p=Text();p.feed(decode(b));(ROOT/(key+'.txt')).write_text(re.sub(r'\n\s*\n+', '\n',''.join(p.parts)))
  return row
def run(urls):
 cache=json.loads(MAN.read_text()) if MAN.exists() else []
 known={r['url'] for r in cache}; todo=list(dict.fromkeys(urllib.parse.urldefrag(u)[0] for u in urls if u.startswith(('http:','https:'))));todo=[u for u in todo if u not in known]
 with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
  for row in ex.map(fetch,todo):
   cache.append(row);MAN.write_text(json.dumps(cache,ensure_ascii=False,indent=2)+'\n');print(row['url'],row.get('status',row.get('error')),flush=True)
 return cache
if __name__=='__main__':
 x=json.load(open('data/work/national-input/full.json')); cs=[c for c in x['cards'] if 8<=int(c['id'][:2])<=11]
 urls=[u for c in cs for u in c.get('links') or []]
 if len(sys.argv)>1:urls=json.load(open(sys.argv[1]))
 run(urls)
