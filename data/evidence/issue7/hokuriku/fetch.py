import json,hashlib,datetime,concurrent.futures,urllib.request,urllib.error
from pathlib import Path
B=Path('data/evidence/issue7/hokuriku');A=json.load(open('data/work/issue7-baseline/assignments.json'))['hokuriku'];L=json.load(open('data/work/issue7-baseline/ledger.json'));old=json.load(open('data/national/issue5/chubu.json'));U={x['facilityId']:x for x in old['unresolved']}
jobs={}
for p in L['places']:
 if p['id'] not in A:continue
 urls=[p['evidence']['sourceUrl']]
 for r in U.get(p['id'],{}).get('priorResearch',[]):
  for t in r['record'].get('attempts',[]):
   u=t.get('url','')
   if u.startswith('http') and not any(x in u for x in ['google','goo.gl']):urls.append(u)
 urls=list(dict.fromkeys(urls))
 # Revisit distribution and one alternate official/operator source; no repeated failures.
 for u in urls[:1]+([urls[-1]] if len(urls)>1 else []):jobs.setdefault(u,[]).append(p['id'])
def fetch(item):
 u,ids=item;r={'sourceUrl':u,'facilityIds':ids,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=35) as q:b=q.read();r.update(status=q.status,finalUrl=q.url,contentType=q.headers.get('Content-Type',''))
  ext='.pdf' if b.startswith(b'%PDF') else '.html';p=B/(hashlib.sha256(u.encode()).hexdigest()[:20]+ext);p.write_bytes(b);r.update(snapshotPath=str(p),snapshotSHA256=hashlib.sha256(b).hexdigest(),bytes=len(b))
 except Exception as e:r['error']=str(e)
 r['fetchedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();return r
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:r=list(ex.map(fetch,jobs.items()))
 (B/'fetch-records.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
 print('fetches',len(r),'success',sum('snapshotPath'in x for x in r))
