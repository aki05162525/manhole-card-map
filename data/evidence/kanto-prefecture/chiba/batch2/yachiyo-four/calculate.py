import hashlib,json,math,sys
from pathlib import Path
sys.path.insert(0,'tools/national')
from research_common import rounded_coordinate
W=Path(__file__).resolve().parent
c=json.loads((W/'combined.json').read_text());f=next(f for f in c['features'] if f['id']=='58272-25797-BldA-116');r=f['geometry']['coordinates'][0]
cross=[a[0]*b[1]-b[0]*a[1] for a,b in zip(r,r[1:])];a2=sum(cross)
point=[sum((a[k]+b[k])*v for a,b,v in zip(r,r[1:],cross))/(3*a2) for k in (0,1)]
out=rounded_coordinate(f['geometry'],c['baseTile'],point)
assert out['mechanicalChecksPassed'];assert not f['tileBoundaryTouched'];assert not f['outerBoundaryTouched']
scale=40075016.68557849*math.cos(math.radians(out['coordinate']['lat']))/(65536*4096)
out.update({'feature':f,'combinedBaseTile':c['baseTile'],'centroidTileXY':point,'areaTileUnits2':abs(a2)/2,'approxAreaM2':abs(a2)/2*scale**2,'areaMethod':'local spherical Mercator ground scale at centroid; approximate, not surveyed','combinedSHA256':hashlib.sha256((W/'combined.json').read_bytes()).hexdigest(),'identityStatus':'research inference: retained west block of enlarged present water office; east extension absent from BldA','adoptionApproved':False})
(W/'calculation.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps(out,ensure_ascii=False))
# Render all acquired geometries within a defined crop, preserving whole all.svg separately.
import re
s=(W/'all.svg').read_text();s=re.sub(r'viewBox="[^"]+"','viewBox="4500 4800 2200 2200"',s,count=1);s=s.replace('<title>','<rect x="4500" y="4800" width="2200" height="2200" fill="white"/><title>',1)
for ff in c['features']:
 if ff['id'] in ['58272-25797-BldA-116','58272-25797-BldA-121','58272-25797-BldA-153','58272-25797-BldA-159','58272-25797-BldA-163','58272-25797-BldA-174']:
  rr=ff['geometry']['coordinates'][0];xx=sum(p[0] for p in rr)/len(rr);yy=sum(p[1] for p in rr)/len(rr);s=s.replace('</svg>',f'<text x="{xx}" y="{yy}" font-size="32" fill="red">{ff["id"]}</text></svg>')
s=s.replace('</svg>',f'<circle cx="{point[0]}" cy="{point[1]}" r="12" fill="blue"/></svg>');(W/'current-comparison.svg').write_text(s)
