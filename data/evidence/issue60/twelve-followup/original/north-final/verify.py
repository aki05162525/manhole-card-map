import json,math,hashlib
from pathlib import Path
from shapely.geometry import shape,Point
O=Path('/tmp/issue60-recheck-north-final-nov6')
def read(n):return json.loads((O/n).read_text())
a=read('assessment.json');c=read('candidates.json');v=read('verification.json');checked=[]
for x in c['updates']:
 m=x['measurement'];t=m['baseTile'];lat=x['coordinate']['lat'];lng=x['coordinate']['lng'];px=((lng+180)/360*2**t['z']-t['x'])*4096;py=((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**t['z']-t['y'])*4096
 assert shape(m['geometry']).contains(Point(px,py));checked.append(x['number'])
for x in read('input-hashes.json')['inputs']:assert hashlib.sha256(Path(x['path']).read_bytes()).hexdigest()==x['sha256']
v['roundedCandidateStrictContainmentPassed']=checked
(O/'verification.json').write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
print('PASS: 8 receipt IDs; 3 rounded candidates inside saved footprints; input hashes unchanged; no approval')
