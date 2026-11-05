import json,pathlib,hashlib,zipfile,io,concurrent.futures,datetime,urllib.request,urllib.error,re
D=pathlib.Path('data/evidence/issue7/chugoku'); B=pathlib.Path('data/work/issue7-baseline')
def dump(p,x): p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
ids=json.loads((B/'assignments.json').read_text())['chugoku']; places={p['id']:p for p in json.loads((B/'ledger.json').read_text())['places'] if p['id'] in ids}
u={p['facilityId']:p for p in json.load(open('data/national/issue5/west-south.json'))['unresolved']}
if not (D/'input-hashes.json').exists():
 dump(D/'input-hashes.json',{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [*B.glob('*.json'),*pathlib.Path('data/national/issue5').rglob('*.json'),*pathlib.Path('data/national/reviews').glob('*.json')]})
audit=[]; urls={}
for id,p in places.items():
 refs=u[id]['evidence']; refs=[{**e,'snapshotPath':e.get('reusedFrom',e['snapshotPath'])} for e in refs]
 for e in refs:
  path=pathlib.Path(e['snapshotPath']); assert hashlib.sha256(path.read_bytes()).hexdigest()==e['snapshotSHA256']
  if e['sourceUrl'].startswith('http') and 'google.' not in e['sourceUrl']: urls.setdefault(e['sourceUrl'],[]).append(id)
 audit.append({'facilityId':id,'name':p['name'],'address':p['address'],'previousReason':u[id]['reason'],'priorEvidence':refs,'priorReviewReferences':u[id].get('priorReviewReferences',[])})
if (D/'prior-audit.json').exists():
 old={x['facilityId']:x for x in json.loads((D/'prior-audit.json').read_text())}
 for x in audit:
  if 'priorReasonCategory' in old.get(x['facilityId'],{}):x['priorReasonCategory']=old[x['facilityId']]['priorReasonCategory']
dump(D/'prior-audit.json',audit)
z=zipfile.ZipFile('data/evidence/issue5/chubu/P05-22_GML.zip'); records=[]
for pref in range(31,36):
 inner=f'P05-22_{pref}_GML.zip'; zz=zipfile.ZipFile(io.BytesIO(z.read(inner))); member=f'P05-22_{pref}.geojson'; raw=zz.read(member); d=json.loads(raw)
 for i,f in enumerate(d['features']): records.append({'pref':pref,'index':i,'locator':inner+'!'+member+'#/features/'+str(i),'feature':f,'memberSHA256':hashlib.sha256(raw).hexdigest(),'crs':d.get('crs')})
# Search in memory; only selected raw records are saved by build.py.
def fetch(item):
 url,ids=item; at=datetime.datetime.now(datetime.timezone.utc).isoformat(); r={'url':url,'facilityIds':ids,'fetchedAt':at}
 try:
  q=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30); r.update(status=q.status,finalUrl=q.url); raw=q.read(); sha=hashlib.sha256(raw).hexdigest(); path=D/(hashlib.sha256(url.encode()).hexdigest()[:20]+'.html');path.write_bytes(raw);r.update(snapshotPath=str(path),snapshotSHA256=sha)
 except Exception as e:r['error']=str(e)
 return r
if not (D/'fetches.json').exists():
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex: out=list(ex.map(fetch,urls.items()))
 dump(D/'fetches.json',out)
 print('fetched',len(out))
for id,p in places.items():
 # Search meaningful name fragments and exact street number, candidates only, not approval.
 name=re.sub(r'[(（].*?[)）]','',p['name']); words=[x for x in re.split(r'[ 　・]',name) if len(x)>=3]; addr=re.sub(r'\s','',p['address']); nums=re.findall(r'\d+(?:-\d+)+',addr)
 matches=[r for r in records if any(w in r['feature']['properties']['P05_003'] or r['feature']['properties']['P05_003'] in w for w in words) or any(n in r['feature']['properties']['P05_004'] for n in nums)]
 print(id,p['name'],[(r['pref'],r['index'],r['feature']['properties']['P05_003'],r['feature']['properties']['P05_004']) for r in matches][:35])
