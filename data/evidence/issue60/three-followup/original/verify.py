from pathlib import Path
import json,hashlib,math
import numpy as np
O=Path(__file__).parent
J=lambda p:json.load(open(p))
checks=[]
def check(label,condition):
 assert condition,label
 checks.append(label)
for item in J(O/'input-hashes.json'):
 check('input:'+item['path'],hashlib.sha256(Path(item['path']).read_bytes()).hexdigest()==item['sha256'])
for item in J(O/'artifact-hashes.json'):
 check('artifact:'+item['path'],hashlib.sha256((O/item['path']).read_bytes()).hexdigest()==item['sha256'])
cs=J(O/'calculations.json');meta=J(O/'mosaic-metadata.json');assessment=J(O/'assessment.json')['rows'];idx=Path('data/national/issue76/remaining-index-after-twelve.json').read_text()
for r in assessment:check('id-in-latest-index:'+str(r['number']),r['facilityId']in idx)
for r in cs:
 n=r['number'];m=meta[str(n)]
 if 'controls'in r:
  src=[q['planPixel']for q in r['controls']]
  check(f'affine-rank:{n}',np.linalg.matrix_rank(np.c_[src,np.ones(len(src))])==3)
  check(f'holdouts-excluded:{n}',all(q['planPixel']not in src for q in r['holdouts']))
 if r.get('coordinate'):
  p=r['coordinate'];s=256*2**m['z'];x=(p['lng']+180)/360*s-m['tileX0']*256;y=(1-math.asinh(math.tan(math.radians(p['lat'])))/math.pi)/2*s-m['tileY0']*256
  check(f'pixel-roundtrip:{n}',math.hypot(x-r['photoPixel'][0],y-r['photoPixel'][1])<.03)
 check(f'unapproved:{n}',r['adoptionApproved']is False)
cands=J(O/'candidates.json');check('candidate-set',set(r['number']for r in cands)=={14,40,41});check('all-five-assessed',set(r['number']for r in assessment)=={7,13,14,40,41})
(O/'verification.json').write_text(json.dumps({'status':'pass','checks':checks,'scope':'hash/ID/calculation only, no adoption approval and no full suite','photographicCorrespondenceNotMechanicallyVerified':True},ensure_ascii=False,indent=2)+'\n')
print('PASS',len(checks),'checks; 5 assessed; 3 unapproved candidates; 7/13 trials excluded')
