from pathlib import Path
import json,hashlib,zipfile,subprocess,sys,datetime,math
O=Path(__file__).resolve().parent;R=Path('/home/akihiro/personal/manhole-card-map')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
rows=json.loads((O/'candidates.json').read_text());nums=[27,35,42,43,45];assert [r['number'] for r in rows]==nums
receipt=json.loads((R/'data/evidence/issue60/human-answers-20261106/receipt.json').read_text());idx=json.loads((R/'data/national/issue76/remaining-index-after-twelve.json').read_text());ids={r['number']:r['facilityId'] for r in receipt['answers']};indextext=json.dumps(idx)
for r in rows:
 assert r['facilityId']==ids[r['number']] and r['facilityId'] in indextext
 assert r['status']=='research_candidate_not_approved' and r['googleCoordinateUsedInDerivation'] is False
 assert 35<r['coordinate']['lat']<37 and 139<r['coordinate']['lng']<141
verified=0
for p in O.glob('*retrieval*.json'):
 obj=json.loads(p.read_text());obj=obj if isinstance(obj,list) else [obj]
 for r in obj:
  path=r.get('path') or r.get('reusedPath')
  if path and 'sha256' in r:assert sha(path)==r['sha256'],(p,path);verified+=1
for r in json.loads((O/'inherited-inputs.json').read_text()):assert sha(r['path'])==r['sha256'];verified+=1
z=zipfile.ZipFile(O/'raw/27-photo17.zip');b=z.read(next(n for n in z.namelist() if n.endswith('2203.tif')));assert hashlib.sha256(b).hexdigest()==sha(O/'raw/27-2203.tif')
z=zipfile.ZipFile(O/'raw/27-worldfiles.zip');assert z.read(next(n for n in z.namelist() if n.endswith('2203.tfw')))==(O/'raw/27-2203.tfw').read_bytes()
before=sha(O/'candidates.json');subprocess.run([sys.executable,str(O/'reproduce.py')],stdout=subprocess.DEVNULL,check=True);assert sha(O/'candidates.json')==before
windows=json.loads((O/'windows.json').read_text())
for r in rows:
 n=str(r['number']);w=windows[n];ll=r['coordinate'];sz=256*2**w['z'];px=(ll['lng']+180)/360*sz-w['x0']*256;py=(1-math.asinh(math.tan(math.radians(ll['lat'])))/math.pi)/2*sz-w['y0']*256;assert math.dist((px,py),r['targetReferencePixel'])<.05
out=dict(numbers=nums,facilityIdsMatched=True,latestIndexMatched=True,rawAndInheritedHashesVerified=verified,zipExtractionMatches=True,candidateReproductionSHA256=before,roundedCoordinateInverseWithinPixels=.05,approvals=0,fullSuiteRun=False,independentReviewRun=False,checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
(O/'verification.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
