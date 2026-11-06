import json,hashlib
from pathlib import Path
D=Path('/tmp/issue60-round2-saitama')
a=json.loads((D/'assessment.json').read_text());u=json.loads((D/'candidate-updates.json').read_text())['updates'];ids=[r['facilityId'] for r in a['outcomes']]
assert len(ids)==len(set(ids))==19
assert sorted(r['number'] for r in a['outcomes'])==list(range(22,41))
assert {r['facilityId'] for r in a['outcomes'] if r['recommendation']=='propose'}=={x['facilityId'] for x in u}
assert len(u)==7
checks=0
for r in a['outcomes']:
 for e in r['positionSuitability']['evidence']:
  p=Path(e['path']);assert p.exists();assert hashlib.sha256(p.read_bytes()).hexdigest()==e['sha256'];checks+=1
  pointer=e.get('pointer','')
  if pointer.startswith('/'):
   obj=json.loads(p.read_text())
   for part in pointer[1:].split('/'):
    part=part.replace('~1','/').replace('~0','~');obj=obj[int(part)] if isinstance(obj,list) else obj[part]
for r in u:
 assert r['coordinate']==next(x['candidateCoordinate'] for x in a['outcomes'] if x['facilityId']==r['facilityId'])
 assert set(r['evidence'])=={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
 p=Path(r['evidence']['snapshotPath']);assert hashlib.sha256(p.read_bytes()).hexdigest()==r['evidence']['snapshotSHA256']
assert next(x['coordinate'] for x in u if x['facilityId'].endswith('4f8550974a31b7d62c39'))==next(x['coordinate'] for x in u if x['facilityId'].endswith('e80f795026cf0f441105'))
print(json.dumps({'status':'PASS','assessed':19,'proposed':7,'held':12,'evidenceRefsChecked':checks,'fullSuiteRun':False,'repoModified':False}))
