from research import *
import sys
jobs=read(sys.argv[1]);dest=OUT/sys.argv[2]
def fetch(item):
 u=item['url'];p=OUT/(hashlib.sha256(u.encode()).hexdigest()[:20]+('.pdf' if '.pdf' in u else '.html'));r=dict(item);r['startedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 try:
  res=urllib.request.urlopen(u,timeout=25);data=res.read();p.write_bytes(data);r.update(status=res.status,finalUrl=res.url,snapshotPath=str(p),snapshotSHA256=sha(p),contentType=res.headers.get('content-type'),bytes=len(data))
 except Exception as e:r['error']=str(e)
 r['fetchedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();return r
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:records=list(ex.map(fetch,jobs))
save(dest,records)
print('fetched',len(records),'ok',sum(x.get('status')==200 for x in records))
