from research import *
import urllib.parse,sys
def fetch(u,ids):
 records=read('data/evidence/issue7/south-kanto/fetch-records.json')
 if any(r['url']==u for r in records):return next(r for r in records if r['url']==u)
 r={'url':u,'facilityIds':ids,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  req=urllib.request.Request(urllib.parse.quote(u,safe=':/?=&%'),headers={'User-Agent':'Mozilla/5.0'})
  try:resp=urllib.request.urlopen(req,timeout=25)
  except urllib.error.HTTPError as e:resp=e
  b=resp.read();p=OUT/(hashlib.sha256(u.encode()).hexdigest()[:24]+'.raw');p.write_bytes(b)
  r.update(status=resp.code,finalUrl=resp.url,snapshotPath=str(p.relative_to(ROOT)),snapshotSHA256=sha(p),contentType=resp.headers.get('Content-Type'))
 except Exception as e:r['error']=str(e)
 records.append(r);save(OUT/'fetch-records.json',records)
 return r
if __name__=='__main__':
 for u in sys.argv[2:]:print(fetch(u,['facility:kanto-south-'+sys.argv[1]]))
