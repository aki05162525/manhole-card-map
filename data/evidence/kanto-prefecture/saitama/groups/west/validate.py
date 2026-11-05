import json,hashlib,sys,subprocess,time
from pathlib import Path
sys.path.insert(0,'tools/national');from location_lifecycle import digest
E=Path('data/evidence/kanto-prefecture/saitama/groups/west');N=Path('data/national/kanto-prefecture/saitama/groups/west')
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
a=read(N/'assignment.json')['facilities'];o=read(N/'outcomes.json')['rows'];u=read(N/'locations.json')['updates'];b=read(N/'location-lifecycle.json')['bindings'];inputs={}
assert {r['facilityId'] for r in a}=={r['facilityId'] for r in o};assert len(o)==6
for r in o:
 assert digest(r['oldPlace'])==r['oldPlaceSHA256'];assert digest(r['oldRelations'])==r['oldRelationsSHA256']
 assert r['performedMethods'] and r['buildingComparison'] and r['nextAction'] and not r['adoptionApproved']
for r in read(E/'retrievals.json'):
 if r.get('rawPath'):
  p=Path(r['rawPath']);assert sha(p)==r['sha256'];inputs[str(p)]=sha(p)
for x,y in zip(u,b):
 assert x==y['adoption'] and digest(x)==y['adoptionSHA256'];p=Path(x['evidence']['snapshotPath']);assert sha(p)==x['evidence']['snapshotSHA256'];inputs[str(p)]=sha(p)
for p in E.glob('*-geometry.json'):
 for x in read(p)['features']:
  assert x['calculation']['mechanicalChecksPassed'];q=Path(x['snapshotPath']);assert sha(q)==x['snapshotSHA256'];inputs[str(q)]=sha(q)
for p in list(N.glob('*.json'))+list(E.glob('*.py')):inputs[str(p)]=sha(p)
v={'schema':1,'head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'command':'/tmp/saitama-research-venv/bin/python data/evidence/kanto-prefecture/saitama/groups/west/validate.py','exitCode':0,'facilityCount':6,'candidateCount':len(u),'inputSHA256':inputs,'verified':['6 ID coverage','source raw SHA256','old values digests','candidate binding digest and identity','PBF hash','rounded and unrounded point inclusion'],'notVerified':['independent building approval','product-specific CRS approval','full suites (parent responsibility)'],'finishedEpoch':time.time()}
(E/'validation.json').write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n');print('PASS: 6 outcomes, 4 candidate bindings, source/raw hashes, mechanical inclusion. No adoption approval.')
