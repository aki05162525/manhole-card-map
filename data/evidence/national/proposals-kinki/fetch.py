"""Fetch explicit official follow-up URLs, preserving failures and reusing originals."""
import urllib.request,urllib.error,urllib.parse,json,pathlib,hashlib,time,datetime,sys
root=pathlib.Path('data/evidence/national/proposals-kinki'); target=root/'manifest.json'
old=json.load(open('data/evidence/national/kinki/manifest.json')); ms=json.loads(target.read_text()) if target.exists() else []
for u in sys.argv[1:]:
 if any(m['url']==u for m in old+ms):continue
 time.sleep(1.1); m={'url':u,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(u,timeout=30) as r:b=r.read();m.update(status=r.status,finalUrl=r.url,contentType=r.headers.get('Content-Type'))
 except urllib.error.HTTPError as e:b=e.read();m.update(status=e.code,error=str(e))
 except Exception as e:m['error']=str(e);b=None
 if b is not None:
  p=root/'snapshots'/(hashlib.sha256(u.encode()).hexdigest()[:20]+'.html');p.parent.mkdir(exist_ok=True);p.write_bytes(b);m.update(snapshotPath=str(p),snapshotSHA256=hashlib.sha256(b).hexdigest())
 ms.append(m);target.write_text(json.dumps(ms,ensure_ascii=False,indent=2)+'\n');print(u,m.get('status'),m.get('error',''))
