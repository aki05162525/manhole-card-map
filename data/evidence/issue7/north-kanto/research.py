import json,hashlib,datetime,concurrent.futures,urllib.request,urllib.error,pathlib,zipfile,io,re
BASE=pathlib.Path('data/evidence/issue7/north-kanto')
def read(p):return json.loads(pathlib.Path(p).read_text())
def save(n,d): (BASE/n).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
ids=read('data/work/issue7-baseline/assignments.json')['north-kanto']; ledger=read('data/work/issue7-baseline/ledger.json'); places={p['id']:p for p in ledger['places']}; inv={p['facilityId']:p for p in read('data/evidence/issue5/north-kanto/inventory.json')}; old={p['facilityId']:p for p in read('data/national/issue5/north-kanto.json')['unresolved']}
if __name__=='__main__':
 paths=list(pathlib.Path('data/work/issue7-baseline').glob('*.json'))+[pathlib.Path('data/national/issue5/north-kanto.json'),pathlib.Path('data/national/issue5/reviews/north-kanto.json'),pathlib.Path('data/evidence/issue5/north-kanto/inventory.json')]
 save('input-hashes.json',{str(p):sha(p.read_bytes()) for p in paths})
 zpath='data/evidence/issue5/chubu/P05-22_GML.zip';z=zipfile.ZipFile(zpath);features=[]
 for pref in ['08','09','10','11']:
  member=f'P05-22_{pref}_GML.zip'; zz=zipfile.ZipFile(io.BytesIO(z.read(member)));fn=f'P05-22_{pref}.geojson';raw=zz.read(fn);data=json.loads(raw)
  for j,f in enumerate(data['features']):features.append({'feature':f,'locator':member+'!'+fn+'#/features/'+str(j),'memberSHA256':sha(raw)})
 # New exhaustive search by facility name (including enclosing building), not only previous candidates.
 def norm(s):return re.sub(r'[\s　（）()・～~「」『』]','',s)
 matches={}
 for i in ids:
  p=places[i];name=norm(p['name']);address=p['address'];out=[]
  for f in features:
   q=f['feature']['properties']; n=norm(q['P05_003']); city=re.split('[市町村]',q['P05_004'])[0]
   if len(n)>=3 and (n in name or name in n) and city in address:out.append(f)
  matches[i]=out
 save('p05-search.json',{'zipPath':zpath,'zipSHA256':sha(pathlib.Path(zpath).read_bytes()),'searchedRecords':len(features),'matches':matches})
 # Each ID gets a fresh attempt at its own official distribution/identity page.
 requests={}
 for i in ids:
  es=inv[i]['evidence']; urls=[e['sourceUrl'] for e in es if 'gk-p.jp' not in e['sourceUrl']]
  if not urls:urls=[places[i]['evidence']['sourceUrl']]
  for u in list(dict.fromkeys(urls))[:2]: requests.setdefault(u,[]).append(i)
 save('request-plan.json',requests)
 def fetch(item):
  u,ii=item;r={'sourceUrl':u,'facilityIds':ii,'requestedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  try:
   try:resp=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'manhole-card-map research/1.0'}),timeout=25)
   except urllib.error.HTTPError as e:resp=e
   b=resp.read();ext='.pdf' if 'pdf' in resp.headers.get('Content-Type','') else '.html';p=BASE/(sha(u.encode())[:24]+ext);p.write_bytes(b)
   r.update(status=resp.status,finalUrl=resp.url,snapshotPath=str(p),snapshotSHA256=sha(b),bytes=len(b),contentType=resp.headers.get('Content-Type'),fetchedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
  except Exception as e:r.update(error=str(e),finishedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
  return r
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:records=list(pool.map(fetch,requests.items()))
 save('fetch-records.json',records)
 print('IDs',len(ids),'URLs',len(records),'success',sum(r.get('status')==200 for r in records),'P05 candidates',sum(bool(v) for v in matches.values()))
