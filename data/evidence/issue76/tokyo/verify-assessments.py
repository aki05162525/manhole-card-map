"""Read-only check of 55 additions, no assembly/full suites.
python3 -B data/evidence/issue76/tokyo/verify-assessments.py [baseline-ledger.json]
Common files may be read in parent checkout before parent integration.
"""
import sys,json,hashlib,subprocess
from pathlib import Path
load=lambda p:json.loads(Path(p).read_text())
hashrow=lambda r:hashlib.sha256(json.dumps(r,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
parent=Path('/home/akihiro/personal/manhole-card-map')
base=load(sys.argv[1] if len(sys.argv)>1 else '/tmp/issue76-baseline-ledger.json')
places={r['id']:r for r in base['places']}
checks=[];allids=[];inputs={}
def resolve(ref):
 path,_,pointer=ref.partition('#');p=Path(path)
 if not p.exists() and path in ['docs/verification/issue76-common.md','data/evidence/issue76/common/product.json']:p=parent/path
 assert p.is_file(),ref
 inputs[path]=hashlib.sha256(p.read_bytes()).hexdigest()
 if pointer:
  d=load(p)
  for bit in pointer.removeprefix('/').split('/'):
   bit=bit.replace('~1','/').replace('~0','~')
   d=d[int(bit)] if isinstance(d,list) else d[bit]
for c,count in [('tokyo',24),('kanagawa',14),('chiba',17)]:
 p=Path('data/national/issue76')/c/'assessment.json';d=load(p)
 assert d['schema']==1 and d['county']==c
 assert d['baselineCommit']=='888f61936aad65ea41c6e0105aed01c3acd1bd2a'
 assert len(d['outcomes'])==count
 expected=load('data/national/kanto-prefecture/'+c+('/outcomes.json' if c=='tokyo' else '/all-outcomes.json' if c=='kanagawa' else '/scope.json'))['rows']
 assert {r['facilityId'] for r in expected}=={r['facilityId'] for r in d['outcomes']}
 for ref in d['sourceSelectionPaths']+d['sourceLifecyclePaths']:resolve(ref)
 for r in d['outcomes']:
  id=r['facilityId'];allids.append(id);assert id in places
  assert places[id].get('coordinate') is None,(id,'unexpected existing adopted position')
  assert r['recommendation'] in ['propose','hold']
  assert r['positionSuitability']['status']==('acceptable' if r['recommendation']=='propose' else 'held')
  if r['sourceLocationPath']:
   resolve(r['sourceLocationPath'])
   match=[v for v in load(r['sourceLocationPath'])['updates'] if v['facilityId']==id];assert len(match)==1
   assert hashrow(match[0])==r['sourceLocationSHA256']
   ev=match[0]['evidence'];assert hashlib.sha256(Path(ev['snapshotPath']).read_bytes()).hexdigest()==ev['snapshotSHA256']
  else:assert r['sourceLocationSHA256'] is None
  for ref in r['positionSuitability']['evidence']:resolve(ref)
  assert r['positionSuitability']['buildingAssessment'] and r['positionSuitability']['uncertaintyBasis'] and r['nextAction'] and r['limitations']
  if r['boundaryMarginMeters'] is not None:assert r['boundaryMarginMeters']>0;resolve(r['boundaryMarginMethod'])
  if r['recommendation']=='propose':assert r['sourceLocationPath'] and r['boundaryMarginMeters'] is not None
 m=load(f'data/evidence/issue76/{c}/measurements.json')
 for r in m['rows']:
  if 'coordinate' in r:
   match=[v for v in load(m['sourceLocationPath'])['updates'] if v['facilityId']==r['facilityId']];assert r['coordinate']==match[0]['coordinate']
  refs=r.get('unionSourceFeatures',[])+r.get('overlappingUnselectedFeatures',[])+[r[k]['source'] for k in ['nearestOtherFootprint','nearestRoadCenterline'] if r.get(k)]
  for ref in refs:
   resolve(ref['path']);assert inputs[ref['path']]==ref['sha256']
 # Rebuild decision artifact without writing research or final files.
 regenerated=subprocess.check_output([sys.executable,'data/evidence/issue76/tokyo/assemble-assessment.py',c],text=True)
 assert json.loads(regenerated)==d
 checks.append({'county':c,'ids':count,'proposed':sum(r['recommendation']=='propose' for r in d['outcomes']),'held':sum(r['recommendation']=='hold' for r in d['outcomes']),'candidateRows':sum(r['sourceLocationPath'] is not None for r in d['outcomes']),'measuredRows':len(m['rows'])})
for script in ['measure.py','assemble-assessment.py','verify-assessments.py']:resolve('data/evidence/issue76/tokyo/'+script)
assert len(allids)==len(set(allids))==55
assert subprocess.check_output(['git','diff','--name-only'],text=True)==''
assert subprocess.check_output(['git','diff','--cached','--name-only'],text=True)==''
print(json.dumps({'schema':1,'result':'passed','baselineCommit':'888f61936aad65ea41c6e0105aed01c3acd1bd2a','checks':checks,'uniqueAssignedIds':55,'inputSHA256':inputs,'scope':['All-ID membership/exactly once','Baseline all assigned coordinates absent','Normalized candidate hashes using assemble.py serialization','Unchanged candidate coordinates and source evidence hashes','All referenced JSON pointers and local files including parent common evidence','PBF hashes for measured target and nearest geometries','Read-only assessment regeneration','No tracked or staged changes'],'notPerformed':['Full suites','New building-identity review','Municipal original-image reread','Adoption approval, manifest changes, commit/push/PR','Map display or route verification']},ensure_ascii=False,indent=2))
