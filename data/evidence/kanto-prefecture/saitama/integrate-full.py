"""Combine county research proposals only; never modify manifest or approve adoption."""
import copy,hashlib,json,sys
from pathlib import Path
sys.path.insert(0,'tools/national')
from location_lifecycle import digest
N=Path('data/national/kanto-prefecture/saitama');E=Path('data/evidence/kanto-prefecture/saitama')
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p,j):p.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')
inv={r['facilityId']:r for r in read(N/'inventory.json')['rows']};answers={r['facilityId']:r for r in read(N/'human-followup.json')['responses']};rows=[];updates=[]
for group in ['waterworks','civic','west','tourism','north']:
 p=N/'groups'/group/'outcomes.json';d=read(p);rr=d if isinstance(d,list) else d['rows'];lu=read(N/'groups'/group/'locations.json')['updates']
 for old in rr:
  r=copy.deepcopy(old);fid=r['facilityId'];r['group']=group;r['name']=inv[fid]['name'];r['adoptionApproved']=False;r['buildingComparisonPerformed']=True;r['candidateCoordinate']=r.get('candidateCoordinate');r['remainingWork']=r.get('remainingWork') or r.get('nextAction') or r.get('stopReason');r['evidenceReferences']=[{'path':str(p),'sha256':sha(p)}];r['oldPlace']=inv[fid]['oldPlace'];r['oldRelations']=inv[fid]['oldRelations'];r['oldPlaceSHA256']=digest(r['oldPlace']);r['oldRelationsSHA256']=digest(r['oldRelations'])
  if fid in answers:
   r['userReport']=answers[fid];r['evidenceReferences'].append({'path':str(N/'human-followup.json'),'sha256':sha(N/'human-followup.json')})
   if group=='waterworks':r['status']='candidate-building-point-user-binding';r['remainingWork']='利用者が管理棟の配布窓口を確認。独立原本同定と製品CRSレビュー・採用審査が残る。';r['stopReason']='独立レビュー未実施';r['nextAction']=r['remainingWork']
  rows.append(r)
 for u in lu:
  u=copy.deepcopy(u)
  if group=='waterworks' and u['facilityId'] in answers:
   u['evidence']['verificationMethod']+=' 追補:2026-11-06利用者回答は当該管理棟内の配布窓口を確認。これは利用者報告であり、上記原本が直接窓口を明示したという意味ではない。human-followup.json参照。checkedAtは基準2026-11-05を維持。'
  updates.append(u)
assert len(rows)==39 and len({r['facilityId'] for r in rows})==39
assert len(updates)==len({u['facilityId'] for u in updates})
save(N/'full-outcomes.json',{'schema':1,'asOf':'2026-11-05','adoptionApproved':False,'manifestModified':False,'summary':{'investigated':39,'unattempted':0,'candidateCoordinates':len(updates),'unresolved':39-len(updates)},'rows':rows})
save(N/'full-locations.json',{'schema':1,'updates':updates})
bindings=[]
for u in updates:
 old=inv[u['facilityId']]['oldPlace'];bindings.append({'facilityId':u['facilityId'],'identity':{k:old[k] for k in ['name','address']},'adoption':u,'adoptionSHA256':digest(u),'sourceVersion':'optimal_bvmap-v1 2026-07-01 / Last-Modified2026-09-17; research only'})
save(N/'full-location-lifecycle.json',{'schema':1,'bindings':bindings,'events':[],'groups':[]})
save(N/'full-selection-proposal.json',{'schema':1,'adoptionApproved':False,'manifestModified':False,'warning':'Hypothetical explicit selection for full-ledger validation only. Independent building/source/CRS review required. Not permission to adopt.','locations':{'path':str(N/'full-locations.json'),'approved':[{'facilityId':u['facilityId'],'sha256':digest(u)} for u in updates]},'locationLifecycle':{'path':str(N/'full-location-lifecycle.json'),'sha256':sha(N/'full-location-lifecycle.json')}})
a=read(N/'parallel-assignment.json')
for g in a['groups']:g['status']='investigated-local-validation-complete'
save(N/'parallel-assignment.json',a)
print('39 investigated;',len(updates),'unapproved proposals')
