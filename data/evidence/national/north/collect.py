#!/usr/bin/env python3
"""Fetch source-linked official pages once; preserve response bytes and host pacing."""
import json, pathlib, urllib.request, urllib.error, urllib.parse, hashlib, datetime, threading,time, concurrent.futures,re
ROOT=pathlib.Path('data/evidence/national/north'); MAN=ROOT/'manifest.json'
D=json.load(open('data/work/national-input/full.json')); CARDS=[c for c in D['cards'] if 1<=int(c['id'][:2])<=7]
locks={}; last={}; guard=threading.Lock()
def fetch(url):
 host=urllib.parse.urlsplit(url).netloc
 with guard: lock=locks.setdefault(host,threading.Lock())
 with lock:
  time.sleep(max(0,1.1-(time.monotonic()-last.get(host,0))))
  rec={'url':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; distribution-data-research/1.0)'})
   try: r=urllib.request.urlopen(req,timeout=25)
   except urllib.error.HTTPError as e:r=e
   b=r.read();rec.update(status=r.status,finalUrl=r.geturl(),contentType=r.headers.get('Content-Type',''))
   suffix='.pdf' if b.startswith(b'%PDF') else '.html'
   path=ROOT/(hashlib.sha256(url.encode()).hexdigest()[:20]+suffix);path.write_bytes(b)
   rec.update(snapshotPath=str(path),snapshotSHA256=hashlib.sha256(b).hexdigest(),bytes=len(b))
  except Exception as e:rec['error']=str(e)
  last[host]=time.monotonic()
  return rec
if __name__=='__main__':
 import sys
 old=json.load(open(MAN)) if MAN.exists() else []
 urls=sorted({u for c in CARDS for u in (c['links'] or []) if u.startswith(('http:','https:'))}) if len(sys.argv)==1 else json.load(open(sys.argv[1]))
 done={r['url'] for r in old};urls=[u for u in urls if u not in done]
 with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
  for r in pool.map(fetch,urls):
   old.append(r);MAN.write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n');print(r['url'],r.get('status',r.get('error')),flush=True)
