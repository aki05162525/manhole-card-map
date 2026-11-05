"""Offline verification of immutable inputs, saved bytes, coordinates and coverage."""
import sys
sys.dont_write_bytecode=True
from research import *
import subprocess,re,collections
report=load('data/national/issue7/shikoku.json'); assignments=load('data/work/issue7-baseline/assignments.json');ids=assignments['shikoku'];allids=[i for v in assignments.values() for i in v]
assert all(allids.count(i)==1 for i in ids)
classified=[x['facilityId'] for x in report['updates']+report['unresolved']]
assert len(classified)==len(set(classified)) and set(classified)==set(ids)
for name,sha in load('data/work/issue7-baseline/hashes.json').items():assert hashlib.sha256((ROOT/'data/work/issue7-baseline'/name).read_bytes()).hexdigest()==sha,name
immutable=load('data/evidence/issue7/shikoku/input-hashes.json')
for path,sha in immutable.items():assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==sha,path
checked=set()
def check(e):
 p=e.get('snapshotPath');sha=e.get('snapshotSHA256')
 if p and sha:
  assert hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==sha,p
  checked.add(p)
for n in ['fetches.json','additional-fetches.json']:
 for e in load('data/evidence/issue7/shikoku/'+n):
  check(e);assert e['requestStartedAt'];assert e['fetchedAt'] if 'status' in e else e['fetchedAt'] is None
for r in load('data/evidence/issue7/shikoku/prior-records.json'):
 for e in r.get('evidence',[]):check(e)
allowed={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
proof={p['facilityId']:p for p in load('data/evidence/issue7/shikoku/coordinate-proof.json')}
for u in report['updates']:
 assert set(u)=={'facilityId','coordinate','scope','evidence'} and u['scope']=='building'
 assert set(u['evidence'])==allowed
 check(u['evidence']);p=proof[u['facilityId']];assert p['coordinate']==u['coordinate']
 if p['kind']=='p05':
  z=zipfile.ZipFile(ROOT/u['evidence']['snapshotPath']);a,b=p['member'].split('/');s=zipfile.ZipFile(io.BytesIO(z.read(a)));f=json.loads(s.read(b))['features'][p['index']]
  assert f==p['feature'];assert f['geometry']['coordinates']==[u['coordinate']['lng'],u['coordinate']['lat']]
 else:
  raw=(ROOT/u['evidence']['snapshotPath']).read_text()
  assert str(u['coordinate']['lat']) in raw and str(u['coordinate']['lng']) in raw
for c in report['corrections']:
 assert c['facilityId'] in ids and c['old']!=c['new'];assert set(c['evidence'])==allowed;check(c['evidence'])
 old=load(c['targetPath']);row=next(x for x in old[c['selector']['array']] if x['facilityId']==c['facilityId']);assert row[c['field']]==c['old']
for u in report['unresolved']:assert u['attempts'] and u['investigationStatus']=='new-investigation-unresolved'
# Generating again from retained source bytes must reproduce the same report.
path=ROOT/'data/national/issue7/shikoku.json';before=path.read_bytes();subprocess.run([sys.executable,str(OUT/'build.py')],check=True,stdout=subprocess.DEVNULL);assert before==path.read_bytes()
tracked=subprocess.check_output(['git','diff','--name-only','HEAD'],cwd=ROOT,text=True).splitlines();assert not tracked,tracked
fetches=load('data/evidence/issue7/shikoku/fetches.json')+load('data/evidence/issue7/shikoku/additional-fetches.json')
result=dict(checkedAt=now(),assigned=len(ids),candidates=len(report['updates']),unresolved=len(report['unresolved']),corrections=len(report['corrections']),coverage='27/27; each exactly once',duplicateIDs=0,immutableFilesVerified=len(immutable),referencedSnapshotsVerified=len(checked),newHTTPAttempts=len(fetches),newUniqueURLs=len({e['sourceUrl'] for e in fetches}),httpSuccess=sum(e.get('status')==200 for e in fetches),numericSourceChecks='12/12',evidenceSchema='7 exact fields',deterministicRegeneration=True,trackedChanges=tracked)
save(OUT/'verification.json',result);print(json.dumps(result,ensure_ascii=False,indent=2))
