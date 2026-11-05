import urllib.request,urllib.error,json,hashlib,datetime,sys
from pathlib import Path
ROOT=Path('data/evidence/issue5/kinki')
def fetch(url):
 p=ROOT/'fetch-log.json'; records=json.loads(p.read_text()) if p.exists() else []
 for r in records:
  if r['url']==url:return r
 r={'url':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  response=urllib.request.urlopen(url,timeout=25); b=response.read()
  dest=ROOT/'snapshots'/(hashlib.sha256(url.encode()).hexdigest()[:20]+'.bin');dest.write_bytes(b)
  r.update(status=response.status,finalUrl=response.geturl(),snapshotPath=str(dest),snapshotSHA256=hashlib.sha256(b).hexdigest(),contentType=response.headers.get('Content-Type'))
 except Exception as e:r['error']=str(e)
 records.append(r);p.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n');return r
if __name__=='__main__':
 for url in sys.argv[1:]:print(json.dumps(fetch(url),ensure_ascii=False))
