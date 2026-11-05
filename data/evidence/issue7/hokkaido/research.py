import json,hashlib,pathlib,datetime,concurrent.futures,urllib.parse,time,threading,sys
import requests
from bs4 import BeautifulSoup
ROOT=pathlib.Path(__file__).resolve().parents[4];D=ROOT/'data/evidence/issue7/hokkaido'
def read(p): return json.loads((ROOT/p).read_text())
def save(p,d): p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
ids=read('data/work/issue7-baseline/assignments.json')['hokkaido'];ledger=read('data/work/issue7-baseline/ledger.json');places={x['id']:x for x in ledger['places']};old={x['facilityId']:x for x in read('data/national/issue5/north.json')['unresolved']}
if not (D/'input-hashes.json').exists():
 paths=list((ROOT/'data/work/issue7-baseline').glob('*.json'))+[ROOT/p for p in ['data/national/issue5/north.json','data/national/issue5/reviews/north.json','data/national/location-updates/north-hokkaido.json','data/evidence/issue5/chubu/P05-22_GML.zip','data/evidence/national/locations-north-hokkaido/decide.py']]
 save(D/'input-hashes.json',{str(p.relative_to(ROOT)):sha(p) for p in paths if p.exists()})
targets=[]
for k in ids:
 es=old[k].get('evidence',[]);urls=[]
 for e in [r['evidence'] for r in ledger['relations'] if r['placeId']==k]+es+[places[k]['evidence']]:
  u=e.get('sourceUrl','')
  if u.startswith('http') and not any(s in u for s in ['google.','goo.gl','nlftp.']) and u not in urls:urls.append(u)
 targets.append({'facilityId':k,'name':places[k]['name'],'address':places[k]['address'],'urls':urls[:3],'oldReason':old[k]['reason'],'oldEvidence':es})
save(D/'targets.json',targets)
urls=list(dict.fromkeys(u for t in targets for u in t['urls']))
if len(sys.argv)>1: urls=json.loads(pathlib.Path(sys.argv[1]).read_text())
records=read('data/evidence/issue7/hokkaido/fetch-records.json') if (D/'fetch-records.json').exists() else []
urls=[u for u in urls if u not in {r['url'] for r in records}]
locks={urllib.parse.urlsplit(u).netloc:threading.Lock() for u in urls}
def fetch(u):
 with locks[urllib.parse.urlsplit(u).netloc]:
  r={'url':u,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  try:
   res=requests.get(u,timeout=30);r.update(status=res.status_code,finalUrl=res.url,contentType=res.headers.get('content-type',''))
   b=res.content;h=hashlib.sha256(b).hexdigest();ext='.pdf' if b.startswith(b'%PDF') else '.xlsx' if b.startswith(b'PK') and u.endswith('.xlsx') else '.html';p=D/'originals'/(h+ext);p.parent.mkdir(exist_ok=True);p.write_bytes(b)
   r.update(snapshotPath=str(p.relative_to(ROOT)),snapshotSHA256=h,bytes=len(b))
   if ext=='.html':
    if res.encoding is None or res.encoding.lower()=='iso-8859-1':res.encoding=res.apparent_encoding
    soup=BeautifulSoup(res.text,'html.parser')
    for tag in soup(['script','style']):tag.decompose()
    (D/'texts').mkdir(exist_ok=True);(D/'texts'/(h+'.txt')).write_text(soup.get_text(' ',strip=True))
  except Exception as e:r['error']=str(e)
  time.sleep(.5)
  return r
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
 for r in ex.map(fetch,urls): records.append(r);print(r['url'],r.get('status',r.get('error')),flush=True);save(D/'fetch-records.json',records)
