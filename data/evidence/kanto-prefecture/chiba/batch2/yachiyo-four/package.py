"""Rebind existing unapproved proposals after evidence relocation; no network/raw acquisition."""
import hashlib,json
from pathlib import Path
W=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
digest=lambda v:sha(json.dumps(v,sort_keys=True,ensure_ascii=False).encode())
def save(n,v):(W/n).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
u=json.load(open(W/'locations-proposed.json'))
for r in u['updates']:
 r['evidence']['snapshotPath']=str((W/'comparison.json').relative_to(Path.cwd()))
 r['evidence']['snapshotSHA256']=sha((W/'comparison.json').read_bytes())
save('locations-proposed.json',u)
b=json.load(open(W/'location-lifecycle-proposed.json'))
for r in b['bindings']:
 r['adoption']=next(x for x in u['updates'] if x['facilityId']==r['facilityId'])
 r['adoptionSHA256']=digest(r['adoption'])
save('location-lifecycle-proposed.json',b)
s=json.load(open(W/'selection-proposed.json'));assert s['approved']==[]
s['researchOnlyCandidates']=[{'facilityId':r['facilityId'],'sha256':digest(r)} for r in u['updates']]
save('selection-proposed.json',s)
print('Rebound three UNAPPROVED research candidates; manifest unchanged')
