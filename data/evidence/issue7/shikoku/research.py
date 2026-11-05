import json,pathlib,hashlib,datetime,concurrent.futures,urllib.request,zipfile,io
ROOT=pathlib.Path(__file__).resolve().parents[4]; OUT=ROOT/'data/evidence/issue7/shikoku'
def load(p):return json.loads((ROOT/p).read_text())
def save(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def fetch(url):
 start=now()
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=35) as r:
   b=r.read(); sha=hashlib.sha256(b).hexdigest(); ext='.pdf' if b.startswith(b'%PDF') else '.html'; p=OUT/(sha+ext);p.write_bytes(b)
   return dict(sourceUrl=url,finalUrl=r.url,status=r.status,snapshotPath=str(p.relative_to(ROOT)),snapshotSHA256=sha,fetchedAt=now(),requestStartedAt=start,contentType=r.headers.get('Content-Type'))
 except Exception as e:return dict(sourceUrl=url,requestStartedAt=start,requestEndedAt=now(),fetchedAt=None,error=str(e))
if __name__=='__main__':
 ids=load('data/work/issue7-baseline/assignments.json')['shikoku'];prior=load('data/national/issue5/west-south.json'); records=[p for p in prior['unresolved'] if p['facilityId'] in ids]
 save(OUT/'prior-records.json',records)
 # Record only hashes for immutable inputs; no source copying.
 paths=list((ROOT/'data/work/issue7-baseline').glob('*.json'))
 paths+=list((ROOT/'data/national/issue5').rglob('*'))+list((ROOT/'data/evidence/issue5').rglob('*'))
 save(OUT/'input-hashes.json',{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.is_file()})
 urls=sorted({e['sourceUrl'] for p in records for e in p.get('evidence',[])})
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex: results=list(ex.map(fetch,urls))
 save(OUT/'fetches.json',results)
 z=zipfile.ZipFile(ROOT/'data/evidence/issue5/chubu/P05-22_GML.zip'); records=[]
 for n in range(36,40):
  inner=f'P05-22_{n}_GML.zip';s=zipfile.ZipFile(io.BytesIO(z.read(inner)));name=f'P05-22_{n}.geojson';d=json.loads(s.read(name))
  for i,x in enumerate(d['features']):records.append(dict(member=inner+'/'+name,index=i,feature=x))
 save(OUT/'p05-shikoku-records.json',dict(scannedCount=len(records),records=[x for x in records if x['feature']['properties']['P05_003'] in ['多度津町役場','うずしお会館','ウェルピア伊予']]))
 print('fetched',len(results),'success',sum('status' in x for x in results),'P05',len(records))
