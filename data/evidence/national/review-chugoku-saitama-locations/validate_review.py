"""Read-only input validation; writes only this review's validation.json."""
import json,hashlib,ast
from pathlib import Path
ROOT=Path.cwd();OUT=Path('data/evidence/national/review-chugoku-saitama-locations'); RP=Path('data/national/reviews/chugoku-saitama-locations.json')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
r=read(RP); expected=[]
for region,n in [('chugoku-shikoku',101),('kanto-north-saitama',55)]:
 data=read('data/national/location-updates/'+region+'.json');assert len(data['updates'])==n
 expected.extend(u['facilityId'] for u in data['updates'])
 for i,u in enumerate(data['updates']):
  v=next(v for v in r['reviews'] if v['facilityId']==u['facilityId']);assert v['region']==region and v['updateIndex']==i and v['coordinate']==u['coordinate'];assert v['reason']
assert len(expected)==len(set(expected))==156
actual=[v['facilityId'] for v in r['reviews']];assert len(actual)==len(set(actual))==156 and set(actual)==set(expected)
keys={'accepted':'acceptedFacilityIds','deferred':'deferredFacilityIds','correction-required':'correctionRequiredFacilityIds'}
for status,key in keys.items():assert set(r[key])=={v['facilityId'] for v in r['reviews'] if v['status']==status}
assert sum(len(r[k]) for k in keys.values())==156
for x in r['inputs']:assert sha(x['path'])==x['sha256'],x['path']
files=read(OUT/'evidence-integrity.json')
for f in files:assert sha(f['path'])==f['sha256'],f['path']
for p in read(OUT/'snapshot-path-patches.json'):
 u=read(p['target'])['updates'];i=int(p['path'].split('/')[2]);assert u[i]['facilityId']==p['facilityId'] and u[i]['evidence']['snapshotPath']==p['old'];new=Path(p['new']);assert not new.is_absolute() and (ROOT/new).resolve().is_relative_to(ROOT.resolve());assert sha(p['old'])==sha(new)
assert len(read(OUT/'snapshot-path-patches.json'))==101
parent=read('data/work/national-assembled-tokyo-kinki-locations.json')
for p in r['exactCorrections']:
 v=[v for v in parent[p['collection']] if all(v.get(k)==value for k,value in p['match'].items())];assert len(v)==1 and v[0][p['field']]==p['old'] and p['old']!=p['new']
# Execute the actual repo_path function in isolation (no importing modules / cache writes).
code=ast.parse(Path('tools/national/assemble.py').read_text());fn=next(x for x in code.body if isinstance(x,ast.FunctionDef) and x.name=='repo_path')
def reject(message):raise ValueError(message)
ns={'Path':Path,'reject':reject};exec(compile(ast.Module(body=[fn],type_ignores=[]),'<repo_path>','exec'),ns)
absolute=read(OUT/'snapshot-path-patches.json')[0]['old'];relative=read(OUT/'snapshot-path-patches.json')[0]['new']
try:ns['repo_path'](ROOT,absolute)
except ValueError:rejected=True
else:rejected=False
assert rejected and ns['repo_path'](ROOT,relative).is_file()
g=read(OUT/'metadata-gap-chain.json');assert len(g)==24 and sum(len(x['affectedPrimaryUpdateFacilityIds']) for x in g)==15
assert all(x['fetchedAt'] is None and not x['snapshotSavedAtIsAcquisitionTime'] for x in g)
p05=read(OUT/'p05-records.json');assert len(p05)==32 and len({x['sourceLocator'] for x in p05})==28
assert len(r['preservedUnresolved'])==4 and all(x['facilityId'] not in expected and x['status']=='deferred' for x in r['preservedUnresolved'])
result={'passed':True,'reviewedUpdates':156,'accepted':len(r['acceptedFacilityIds']),'deferred':len(r['deferredFacilityIds']),'correctionRequired':len(r['correctionRequiredFacilityIds']),'exactPartition':True,'inputHashesUnchanged':True,'evidenceFilesHashed':len(files),'p05Updates':32,'p05UniqueFeatures':28,'metadataGapOriginals':24,'metadataGapPrimaryUpdates':15,'absolutePathsRejectedByActualAssemblerFunction':rejected,'relativePathPatches':101,'exactRecordPatches':len(r['exactCorrections']),'preservedUnresolvedOutsideUpdateCount':4,'reviewSHA256':sha(RP),'limitation':'機械検証は採否の網羅性、証拠完全性、patch前提を検査。施設同定の意味判定は個別reviewのreasonと原典抜粋を読む。'}
(OUT/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False))
