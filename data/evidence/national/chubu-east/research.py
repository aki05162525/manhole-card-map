#!/usr/bin/env python3
"""Fetch immutable source bytes with cache and per-host pacing; derive review text."""
import json, urllib.request, urllib.parse, urllib.error, hashlib, datetime, time, concurrent.futures, threading, re
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path('data/evidence/national/chubu-east')
FULL=json.load(open('data/work/national-input/full.json'))
CARDS=[c for c in FULL['cards'] if '15'<=c['id'][:2]<='20']
class Text(HTMLParser):
 def __init__(self): super().__init__(); self.parts=[]; self.skip=0; self.links=[]
 def handle_starttag(self,t,a):
  if t in ('script','style'): self.skip+=1
  if t in ('p','div','br','tr','li','h1','h2','h3','h4','td','th'): self.parts.append('\n')
  if t in ('a','iframe'): self.links += [v for k,v in a if v and k in ('href','src')]
 def handle_endtag(self,t):
  if t in ('script','style'): self.skip=max(0,self.skip-1)
  if t in ('p','div','tr','li','h1','h2','h3','h4'): self.parts.append('\n')
 def handle_data(self,d):
  if not self.skip: self.parts.append(d)
 def text(self): return '\n'.join(x.strip() for x in ''.join(self.parts).splitlines() if x.strip())
def parse(b):
 enc='utf-8'; m=re.search(br'charset\s*=\s*["\']?([\w-]+)',b[:10000],re.I)
 if m: enc=m[1].decode()
 try:s=b.decode(enc,errors='replace')
 except LookupError:s=b.decode('utf-8',errors='replace')
 p=Text();p.feed(s);return p
manifest_path=ROOT/'manifest.json'
manifest=json.load(open(manifest_path)) if manifest_path.exists() else []
cache={m['url']:m for m in manifest};locks={};guard=threading.Lock();last={}
def fetch(url):
 url=urllib.parse.urldefrag(url)[0]
 if url in cache:return cache[url]
 host=urllib.parse.urlsplit(url).netloc
 with guard: lock=locks.setdefault(host,threading.Lock())
 with lock:
  time.sleep(max(0,1.05-(time.monotonic()-last.get(host,0))))
  stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
  m={'url':url,'fetchedAt':stamp,'actorType':'ai'}
  b=None
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; ManholeCardDataReview/1.0)'})
   with urllib.request.urlopen(req,timeout=25) as r:
    b=r.read();m.update(status=r.status,finalUrl=r.url,contentType=r.headers.get('Content-Type',''))
  except urllib.error.HTTPError as e:
   b=e.read();m.update(status=e.code,error=str(e))
  except Exception as e:m['error']=str(e)
  last[host]=time.monotonic()
  if b is not None:
   key=hashlib.sha256(url.encode()).hexdigest()[:20];ext='.pdf' if b[:4]==b'%PDF' else '.html';path=ROOT/(key+ext);path.write_bytes(b)
   m.update(snapshotPath=str(path),sha256=hashlib.sha256(b).hexdigest(),bytes=len(b))
   if ext=='.html': (ROOT/(key+'.txt')).write_text(parse(b).text())
  with guard:
   cache[url]=m;manifest.append(m);manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
  return m
if __name__=='__main__':
 import sys
 urls=sys.argv[1:] or sorted({urllib.parse.urldefrag(u)[0] for c in CARDS for u in (c.get('links') or [])})
 with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
  for m in ex.map(fetch,urls): print(m.get('status','ERR'),m['url'],flush=True)
