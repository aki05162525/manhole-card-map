import json,hashlib,datetime,concurrent.futures,urllib.request,urllib.error
from pathlib import Path
R=Path('data/evidence/issue7/koshin');b=Path('data/work/issue7-baseline')
def dump(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
ids=json.loads((b/'assignments.json').read_text())['koshin'];ps=[p for p in json.loads((b/'ledger.json').read_text())['places'] if p['id'] in ids]
def fetch(url):
 key=hashlib.sha256(url.encode()).hexdigest()[:20];p=R/(key+('.pdf' if '.pdf' in url else '.html'));m={'sourceUrl':url,'fetchedAt':None}
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (facility evidence research)'})
  with urllib.request.urlopen(req,timeout=25) as r:body=r.read();m.update(status=r.status,finalUrl=r.url,contentType=r.headers.get('Content-Type'))
  p.write_bytes(body);m.update(snapshotPath=str(p),snapshotSHA256=hashlib.sha256(body).hexdigest(),bytes=len(body))
 except Exception as e:m.update(error=str(e),status=getattr(e,'code',None))
 m['fetchedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();return m
if __name__=='__main__':
 urls=list(dict.fromkeys(p['evidence']['sourceUrl'] for p in ps))
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:rows=list(ex.map(fetch,urls))
 dump(R/'fetch-records.json',rows);print([(r['sourceUrl'],r['status']) for r in rows])
