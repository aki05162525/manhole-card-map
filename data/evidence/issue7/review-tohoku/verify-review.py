"""Read-only checks of the submitted evidence; writes only this review directory."""
import json,pathlib,hashlib,zipfile,io,re,datetime
D=pathlib.Path('data/evidence/issue7/review-tohoku')
def read(p):return json.loads(pathlib.Path(p).read_text())
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
p=read('data/national/issue7/tohoku.json');audit={r['facilityId']:r for r in read('data/evidence/issue7/tohoku/audit.json')}
assigned=read('data/work/issue7-baseline/assignments.json')['tohoku'];ids=[u['facilityId'] for k in ['updates','unresolved'] for u in p[k]]
assert len(ids)==len(set(ids))==84 and set(ids)==set(assigned)
ledger=read('data/work/issue7-baseline/ledger.json');places={r['id']:r for r in ledger['places']}
refs={}
def walk(o):
 if isinstance(o,dict):
  if o.get('snapshotPath') and o.get('snapshotSHA256'):
   name=o['snapshotPath'];assert sha(name)==o['snapshotSHA256'],name;refs[name]=o['snapshotSHA256']
  for v in o.values():walk(v)
 elif isinstance(o,list):
  for v in o:walk(v)
for n in ['fetch-records','support-records','extra-records','old-references','audit']:walk(read('data/evidence/issue7/tohoku/'+n+'.json'))
walk(p)
checks=[]
for u in p['updates']:
 e=u['evidence'];a=audit[u['facilityId']];assert u['facilityId'] in places,u['facilityId'];assert a['name']==places[u['facilityId']]['name']
 assert set(e)=={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
 assert re.fullmatch(r'\d{4}-\d{2}-\d{2}',e['checkedAt']);datetime.date.fromisoformat(e['checkedAt']);assert u['scope']=='building'
 c={'facilityId':u['facilityId'],'coordinate':u['coordinate'],'sourceLocator':e['sourceLocator'],'snapshotSHA256':e['snapshotSHA256'],'idMatchesFixedLedger':True,'checkedAt':e['checkedAt'],'exactSevenEvidenceFields':True}
 if '.zip!' in e['sourceLocator']:
  outer,inner=e['sourceLocator'].split('!');member,idx=inner.split('#/features/')
  z=zipfile.ZipFile(e['snapshotPath']);zb=z.read(outer);s=zipfile.ZipFile(io.BytesIO(zb));mb=s.read(member);fc=json.loads(mb);feature=fc['features'][int(idx)]
  assert feature==a['rawFeature'];assert hashlib.sha256(mb).hexdigest()==a['memberSHA256'];assert fc['crs']==a['crs'];assert fc['crs']['properties']['name']=='urn:ogc:def:crs:EPSG::6668'
  assert feature['geometry']['coordinates']==[u['coordinate']['lng'],u['coordinate']['lat']]
  c.update(rawFeature=feature,memberSHA256=hashlib.sha256(mb).hexdigest(),innerArchiveSHA256=hashlib.sha256(zb).hexdigest(),crs=fc['crs'],axisOrder='GeoJSON [longitude, latitude]; rekey only, no datum conversion',featureId='No id property in raw Feature; exact archive/member/zero-based index retained')
 else:
  text=pathlib.Path(e['snapshotPath']).read_text();nums=re.findall(r'q=(-?\d+\.\d+),(-?\d+\.\d+)',text);assert len(set(nums))==1,nums
  lat,lng=next(iter(set(nums)));assert [float(lat),float(lng)]==[u['coordinate']['lat'],u['coordinate']['lng']]
  c.update(rawValues=[lat,lng],axisOrder='q=latitude,longitude',crs='Geographic web-map destination, WGS84-compatible interpretation; no explicit EPSG declaration in municipal HTML; not a surveyed JGD2011 claim',uniqueNumericDestinationCount=1)
 checks.append(c)
protected=read('data/evidence/issue7/tohoku/input-hashes.json');changes=[f for f,h in protected.items() if not pathlib.Path(f).exists() or sha(f)!=h]
assert not changes,changes
for f,h in read('data/work/issue7-baseline/hashes.json').items():assert sha('data/work/issue7-baseline/'+f)==h
out={'assignmentCount':84,'candidateCount':25,'remainingCount':59,'idCoverageExact':True,'numericChecks':checks,'referencedSnapshotHashes':refs,'protectedInputCount':len(protected),'protectedInputChanges':changes,'baselineExpectedHashesMatch':True,'codeSHA256':sha('cmd/builddata/ledger.go'),'evidenceContract':'cmd/builddata/ledger.go:17,113; exact extracted Evidence and validateEvidence executed by evidence-probe.go','goResultPath':str(D/'go-evidence.txt'),'sourceProposalSHA256':sha('data/national/issue7/tohoku.json')}
(D/'validation.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in out.items() if k not in ['numericChecks','referencedSnapshotHashes']},ensure_ascii=False));print('snapshot files:',len(refs))
