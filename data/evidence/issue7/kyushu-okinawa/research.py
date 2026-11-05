"""Fetch official sources once; keep raw bytes and actual retrieval times. No cookies/headers saved."""
import json,hashlib,datetime,pathlib,concurrent.futures,urllib.request,urllib.parse
E=pathlib.Path('data/evidence/issue7/kyushu-okinawa')
def read(p):return json.load(open(p))
def save(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
ids=read('data/work/issue7-baseline/assignments.json')['kyushu-okinawa']
places={p['id']:p for p in read('data/work/issue7-baseline/ledger.json')['places'] if p['id'] in ids}
old={p['facilityId']:p for p in read('data/evidence/national/locations-kyushu-okinawa/unresolved-research.json')}
jobs={}
for fid,p in places.items():
 for typ,url in [('distribution',p['evidence']['sourceUrl']),('facility',old.get(fid,{}).get('alternateSource',{}).get('url'))]:
  if url and 'google.' not in url and 'goo.gl' not in url:
   # HTTPS on same official site, no insecure TLS fallback.
   url=url.replace('http://','https://');jobs.setdefault(url,[]).append({'facilityId':fid,'purpose':typ})
# Initial fixed-input hashes are immutable once recorded.
if not (E/'input-hashes.json').exists():
 save(E/'input-hashes.json',{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in pathlib.Path('data/work/issue7-baseline').glob('*.json')})
def fetch(job):
 url,targets=job;r={'url':url,'targets':targets,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (facility-source-research)'}),timeout=25) as f:
   b=f.read();r.update(status=f.status,finalUrl=f.url,contentType=f.headers.get('Content-Type',''));h=hashlib.sha256(b).hexdigest();ext='.pdf' if b.startswith(b'%PDF') else '.html';p=E/(h[:24]+ext);p.write_bytes(b);r.update(snapshotPath=str(p),snapshotSHA256=h)
 except Exception as e:r['error']=str(e)
 r['fetchedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();return r
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex: rows=list(ex.map(fetch,jobs.items()))
 save(E/'fetches.json',rows);print('Fetched',len(rows),'success',sum(r.get('status')==200 for r in rows))
