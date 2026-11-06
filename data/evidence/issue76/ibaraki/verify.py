"""Read-only check of all assigned IDs, immutable candidate hashes, refs and measurements.
Run with the same shapely/mapbox-vector-tile environment as measure.py, repository root.
"""
import json,sys,hashlib
from pathlib import Path
from measure import measure,resolve,digest
parent=Path('/home/akihiro/personal/manhole-card-map')
def read(p):return json.loads(Path(p).read_text())
def reference(ref):
 p,_,ptr=ref.partition('#')
 if not Path(p).exists():
  assert p in ['docs/verification/issue76-common.md','data/evidence/issue76/common/product.json']
  p=str(parent/p)
 assert Path(p).is_file(),p
 if ptr:resolve(p+'#'+ptr)

def check(c):
 a=read(f'data/national/issue76/{c}/assessment.json');inp=read(f'data/evidence/issue76/{c}/measurement-inputs.json');measured=measure(c);saved=read(f'data/evidence/issue76/{c}/measurements.json')
 assert measured==saved,'measurement results stale'
 source={'ibaraki':('round2/outcomes.json','facilities'),'tochigi':('batch2-outcomes.json','rows'),'gunma':('round2-outcomes.json','facilities')}[c]
 ids={r['facilityId'] for r in read('data/national/kanto-prefecture/'+c+'/'+source[0])[source[1]]}
 assert len(a['outcomes'])==len(ids) and {r['facilityId'] for r in a['outcomes']}==ids
 baseline={p['id']:p for p in read('/tmp/issue76-baseline-ledger.json')['places']}
 assert ids<=baseline.keys() and all('coordinate' not in baseline[id] for id in ids)
 sources={r['facilityId']:r for r in inp['inputs']};m={r['facilityId']:r for r in saved['rows']}
 selection=read(inp['selectionPath']);selected={r['facilityId']:r['sha256'] for group in selection['locations'] for r in group['approved']}
 assert sources.keys()==selected.keys()
 for o in a['outcomes']:
  id=o['facilityId'];assert o['recommendation'] in ['hold','propose'];assert o['positionSuitability']['status']==('acceptable' if o['recommendation']=='propose' else 'held')
  for ref in o['positionSuitability']['evidence']:reference(ref)
  if id in sources:
   s=sources[id];assert o['sourceLocationPath']==s['sourceLocationPath'] and o['sourceLocationSHA256']==s['sourceLocationSHA256']==selected[id]
   assert o['boundaryMarginMeters']==m[id]['boundaryMarginMeters']
  else:assert o['sourceLocationPath'] is None and o['sourceLocationSHA256'] is None and o['recommendation']=='hold'
 cr=read(f'data/evidence/issue76/{c}/common-reference.json')
 for ref in cr['references']:assert hashlib.sha256((parent/ref['path']).read_bytes()).hexdigest()==ref['sha256']
 assert cr['matchingProductETagEvidence']
 for ref in cr['matchingProductETagEvidence']:assert resolve(ref).strip('"')=='dfa81a9cba11aad28247d63a2d8361ec-2015'
 return {'schema':1,'county':c,'assignedIDs':len(ids),'propose':sum(o['recommendation']=='propose' for o in a['outcomes']),'hold':sum(o['recommendation']=='hold' for o in a['outcomes']),'measuredCandidates':len(m),'checks':['all assigned IDs exactly once, baseline unlocated','latest selection normalized row hashes unchanged','evidence paths/pointers resolve including parent common references','common input hashes and own saved ETag references match','all scoped geometry/road/building measurements reproduced without input writes'],'fullSuiteRun':False,'adoptionApproved':False}
if __name__=='__main__':print(json.dumps(check(sys.argv[1]),ensure_ascii=False,indent=2))
