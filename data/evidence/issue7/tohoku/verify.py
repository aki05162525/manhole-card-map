"""Verify hashes, raw coordinates, complete assignment, Evidence shape, protected inputs."""
import json,pathlib,hashlib,zipfile,io,re,datetime
D=pathlib.Path('data/evidence/issue7/tohoku')
def read(p):return json.loads(pathlib.Path(p).read_text())
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
p=read('data/national/issue7/tohoku.json');ids=read('data/work/issue7-baseline/assignments.json')['tohoku'];assigned=set(ids);allids=[x['facilityId'] for k in ['updates','unresolved'] for x in p[k]]
assert len(allids)==len(set(allids))==len(ids) and set(allids)==assigned
keys={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
refs={};coords=[]
def walk(x):
 if isinstance(x,dict):
  if x.get('snapshotPath') and x.get('snapshotSHA256'):
   name=x['snapshotPath'];assert not pathlib.Path(name).is_absolute(),name;assert sha(name)==x['snapshotSHA256'],name;refs[name]=x['snapshotSHA256']
  for v in x.values():walk(v)
 elif isinstance(x,list):
  for v in x:walk(v)
for f in ['fetch-records.json','support-records.json','extra-records.json','old-references.json','audit.json']:walk(read(D/f))
walk(p)
for u in p['updates']:
 e=u['evidence'];assert set(e)==keys;assert e['actorType']=='ai' and u['scope']=='building';datetime.date.fromisoformat(e['checkedAt']);c=u['coordinate'];assert 35<c['lat']<42 and 138<c['lng']<143
 if '.zip!' in e['sourceLocator']:
  outer,inner=e['sourceLocator'].split('!');member,idx=inner.split('#/features/');z=zipfile.ZipFile(e['snapshotPath']);s=zipfile.ZipFile(io.BytesIO(z.read(outer)));fc=json.loads(s.read(member));feature=fc['features'][int(idx)];assert feature['geometry']['coordinates']==[c['lng'],c['lat']];assert fc['crs']['properties']['name'].endswith('6668')
 else:
  raw=pathlib.Path(e['snapshotPath']).read_text();assert f"q={c['lat']},{c['lng']}" in raw
 coords.append(u['facilityId'])
for u in p['unresolved']:
 assert u['reasonCategory'] and u['reason'] and u['nextSource'];assert any(a['kind']=='new-fetch' for a in u['attempts']);assert not 'coordinate' in u
protected=read(D/'input-hashes.json');changes=[name for name,h in protected.items() if not pathlib.Path(name).exists() or sha(name)!=h];assert not changes,changes
for name,h in read('data/work/issue7-baseline/hashes.json').items():assert sha('data/work/issue7-baseline/'+name)==h
assert p['corrections']==[]
result={'validatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'assignmentCount':len(ids),'updates':len(p['updates']),'unresolved':len(p['unresolved']),'duplicateIds':0,'missingIds':[],'outOfAssignmentIds':[],'rawCoordinateChecks':len(coords),'snapshotFilesHashChecked':len(refs),'protectedInputFiles':len(protected),'protectedInputChanges':changes,'goEvidenceExactFields':True,'baselineExpectedHashesMatch':True,'correctionOldNewChecks':0,'notes':['意味上の建物同定はaudit.jsonの個別判断であり数値一致検証だけでは保証しない。','全担当に新規取得を試みたが、公開GIS/PLATEAUを全件網羅したとは主張しない。']}
(D/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False))
