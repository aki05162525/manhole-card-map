import json,math,hashlib,subprocess
from pathlib import Path
p=Path('/tmp/issue60-recheck-chiba-nov6');root=Path('/home/akihiro/personal/manhole-card-map')
def read(f):return json.loads((p/f).read_text())
for f,h in read('repo-inputs.json')['files'].items():assert hashlib.sha256((root/f).read_bytes()).hexdigest()==h,f
r=read('assessment.json')['outcomes'];assert {a['number'] for a in r}=={16,18,19,20,21};assert len({a['facilityId'] for a in r})==5
rem=(root/'data/national/issue76/remaining-index-after-human-answers.json').read_text()
assert all(a['facilityId'] in rem for a in r)
c=read('candidates.json');assert c['adoptionApproved'] is False;assert [q['number'] for q in c['updates']]==[16,18,20]
assert all(q['adoptionApproved'] is False for q in c['updates']);a,b=[q for q in c['updates'] if q['number'] in [18,20]];assert a['candidate']['coordinate']==b['candidate']['coordinate']
f=a['source']['frame'];x,y=a['source']['pixel'];n=2**f['z']*256
co=dict(lat=round(math.degrees(math.atan(math.sinh(math.pi*(1-2*(f['y']*256+y)/n)))),7),lng=round((f['x']*256+x)/n*360-180,7));assert co==a['candidate']['coordinate']
assert read('candidate-16.json')['originalCalculationCheck']['inside']
for fn in ['retrievals.json','asset-retrievals.json','raster-retrievals.json']:
 for row in read(fn):
  file=Path(row['path']);file=file if file.is_absolute() else p/file;assert hashlib.sha256(file.read_bytes()).hexdigest()==row['sha256']
status=subprocess.check_output(['git','status','--short'],cwd=root,text=True);(p/'repo-status-final.txt').write_text(status)
files=[f for f in p.iterdir() if f.is_file() and f.name not in ['SHA256SUMS','verification.json']]
(p/'SHA256SUMS').write_text(''.join(hashlib.sha256(f.read_bytes()).hexdigest()+'  '+f.name+'\n' for f in sorted(files)))
(p/'verification.json').write_text(json.dumps(dict(result='pass',assigned=5,candidates=3,held=2,repoStatus=status,checks=['existing input hashes','all assigned IDs in receipt/current remaining scope','candidate count and unapproved flags','same building distinct IDs','No16 inverse projection and containment','GSI raster inverse projection','download hashes','artifact hash manifest'],notRun=['full suites','independent adoption review','historical full decode']),ensure_ascii=False,indent=2)+'\n')
print('PASS: 5 IDs; 3 candidates; 2 holds; input/download hashes; projection; git status:',repr(status))
