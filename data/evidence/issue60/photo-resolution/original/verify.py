from pathlib import Path
import json,hashlib,copy
import numpy as np
from PIL import Image
from reproduce import calc,xyz,pixel,V,W
O=Path(__file__).resolve().parent;S=Path('/tmp/issue60-own-georef-newbuild')
def load(p):return json.loads((O/p).read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def canonical(r):return hashlib.sha256(json.dumps(r,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
checked=0
for file in ['input-hashes.json']:
 for p,h in load(file).items():assert sha(O/p)==h,p;checked+=1
for r in load('inherited-inputs.json'):assert sha(Path(r['source']))==r['sha256']==sha(O/r['path']);checked+=1
for r in load('photo-retrievals.json')+load('terms-retrievals.json'):assert sha(O/r['path'])==r['sha256'];checked+=1
rows=load('candidates.json');hashes=load('candidate-row-hashes.json')
for row,rec in zip(rows,hashes):
 n=str(row['number']);assert row==calc(n);assert canonical(row)==rec['sha256']
 bad=copy.deepcopy(row);bad['coordinate']['lat']+=0.0001;assert canonical(bad)!=rec['sha256']
 assert row['status']=='research_candidate_pending_independent_review' and not row['publicAdoptionApproved']
 assert row['absoluteAccuracyUpperBoundM'] is None
 old=load('inherited/georef-inputs.json')[n]
 assert V[n]['referenceImage'].endswith('-photo-reference.png')
 assert any(q!=old['control'][i][1] for i,(p,q,l) in enumerate(V[n]['control']))
 # Equality of a rounded reading at one feature is possible; provenance is not proved by inequality.
 im=Image.open(O/V[n]['referenceImage'])
 for a,b,l in V[n]['control']+V[n]['check']:
  assert np.linalg.norm(np.array(pixel(n,xyz(n,b)))-b)<0.000001
  # Reassembled source pixels agree with only the selected original photo tiles.
  x,y=map(int,b);w=W[n];tile=O/'raw'/f'{n}-seamlessphoto-18-{w["x0"]+x//256}-{w["y0"]+y//256}.jpg'
  assert im.getpixel((x,y))==Image.open(tile).getpixel((x%256,y%256))
 assert np.isfinite(row['matrix']).all()
# Preserve original bundle; no source changes, including research scripts.
prior=load('prior-bundle-hashes.json')
for p,h in prior.items():assert sha(S/p)==h,p
result=dict(result='pass',candidateCount=2,checkedInputHashes=checked,priorBundleFilesUnchanged=len(prior),reproduction='exact equality',candidateHashes='standard json.dumps ensure_ascii=False sort_keys=True default separators',negativeHashMutationDetected=True,photoTilePixelCheck=True,roundTripTolerancePixels=0.000001,independentReview='not performed',applicationTests='not run; research-only /tmp changes')
(O/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False))
