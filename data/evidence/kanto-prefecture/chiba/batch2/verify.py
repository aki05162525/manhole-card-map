"""County research integrity check; no manifest or ledger files are mutated."""
import copy, hashlib, json, subprocess, sys
from pathlib import Path
sys.path.insert(0, 'tools/national')
from assemble import assemble
from location_lifecycle import digest
ROOT=Path.cwd();E=ROOT/'data/evidence/kanto-prefecture/chiba/batch2';N=ROOT/'data/national/kanto-prefecture/chiba/batch2'
load=lambda p:json.loads(Path(p).read_text())
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
manifest=load(ROOT/'tools/national/manifest.json');before,audit=assemble(ROOT,manifest)
updates=load(N/'locations-proposed.json')['updates'];bindings=load(N/'location-lifecycle-proposed.json')['bindings'];selection=load(N/'selection-proposed.json')
scope=load(N.parent/'scope.json');olds=load(N/'old-values.json')['rows'];summary=load(E/'research-summary.json')
ids=set(scope['facilityIds']);assert len(ids)==17
assert len(summary['rows'])==17 and {r['facilityId'] for r in summary['rows']}==ids
assert len(olds)==17 and {r['facilityId'] for r in olds}==ids
places={r['id']:r for r in before['places']}
for r in olds:
    fid=r['facilityId'];assert r['previousPlace']==places[fid]
    assert r['previousPlaceSHA256']==digest(places[fid])
    relations=[x for x in before['relations'] if x['placeId']==fid]
    assert r['previousRelations']==relations
    assert r['previousRelationsSHA256']==digest(relations)
for u,b,s in zip(updates,bindings,selection['candidateOnly']):
    fid=u['facilityId'];assert fid==b['facilityId']==s['facilityId'];assert fid in ids
    assert b['adoption']==u and b['adoptionSHA256']==digest(u)==s['sha256']
    assert s['bindingSHA256']==digest(b)
    assert b['identity']=={k:places[fid][k] for k in ['name','address']}
    assert s['expectedOldPlaceSHA256']==digest(places[fid]);assert s['expectedOldCoordinate']==places[fid].get('coordinate')
    proof=ROOT/u['evidence']['snapshotPath'];assert proof.is_relative_to(ROOT/'data/evidence/kanto-prefecture/chiba')
    assert sha(proof)==u['evidence']['snapshotSHA256']
assert len(bindings)==len(updates)==len(selection['candidateOnly'])
assert len({u['facilityId'] for u in updates})==len(updates)
assert selection['locations']['approved']==[] and selection['locationLifecycle']==[]
assert selection['relationPatches']==[]
proposed=copy.deepcopy(manifest)
fragment=selection['afterIndependentApprovalOnly']
for key in ['locations','locationLifecycle']:proposed.setdefault(key,[]).extend(fragment[key])
after,paudit=assemble(ROOT,proposed)
assert {k:v for k,v in before.items() if k!='places'}=={k:v for k,v in after.items() if k!='places'}
changed=[]
for a,b in zip(before['places'],after['places']):
    assert a['id']==b['id']
    if a!=b:
        changed.append(a['id'])
        assert {k for k in set(a)|set(b) if a.get(k)!=b.get(k)}<={'coordinate','evidence','locationReview'}
assert set(changed)=={u['facilityId'] for u in updates}
# Negative control: the existing assembler must reject a tampered proposed hash.
bad=copy.deepcopy(proposed);bad['locations'][-1]['approved'][0]['sha256']='0'*64
try:assemble(ROOT,bad)
except ValueError as exc:print('NEGATIVE CONTROL rejected altered selection SHA256:',exc)
else:raise AssertionError('altered selection unexpectedly accepted')
# Validate protected historical files and the shared manifest were not changed by this batch.
for name in ['data/evidence/kanto-prefecture/chiba/reproduction.txt','data/evidence/kanto-prefecture/chiba/validation.json','tools/national/manifest.json']:
    original=subprocess.check_output(['git','show','05f1bbe:'+name]);assert (ROOT/name).read_bytes()==original,name
print('PASS: 17 IDs/current old values/full relations; candidate evidence/hash/identity/binding/selection; simulated whole-ledger changes limited to',len(changed),'positions; manifest/protected files unchanged; approved 0')
print('SIMULATION ONLY; building interpretation and CRS not approved by these checks')
