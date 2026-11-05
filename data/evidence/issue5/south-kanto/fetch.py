import requests,hashlib,json,datetime,sys
from pathlib import Path
D=Path(__file__).parent
p=D/'fetch-records.json'; records=json.loads(p.read_text()) if p.exists() else []
for url in sys.argv[1:]:
 if any(x['sourceUrl']==url for x in records):continue
 r={'sourceUrl':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  q=requests.get(url,timeout=40);raw=q.content;out=D/(hashlib.sha256(url.encode()).hexdigest()[:24]+'.raw');out.write_bytes(raw)
  r.update(status=q.status_code,finalUrl=q.url,snapshotPath=str(out),snapshotSHA256=hashlib.sha256(raw).hexdigest(),contentType=q.headers.get('content-type'),responseHeaders=dict(q.headers))
 except Exception as e:r['error']=str(e)
 records.append(r);p.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in r.items() if k!='responseHeaders'},ensure_ascii=False))
