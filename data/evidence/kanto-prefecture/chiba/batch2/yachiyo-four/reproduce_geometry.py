"""Offline raw-tile decoding and full/focused SVG reproduction; no fetches."""
import json,sys,re,math
from pathlib import Path
sys.path.insert(0,'tools/national')
from research_common import decode_tile,combine_tiles,render_svg
W=Path(__file__).resolve().parent
rows=json.load(open(W/'tile-inputs.json'))['rows'];tiles=[]
for r in rows:
 d=decode_tile(Path(r['path']).read_bytes());tile=r['tile'];fs=[]
 for name in ['BldA','RdCL']:
  for i,f in enumerate(d.get(name,{}).get('features',[])):
   fs.append({**f,'id':f"{tile['x']}-{tile['y']}-{name}-{i}",'sourceLayer':name,'layerFeatureIndex':i})
 tiles.append({'tile':tile,'extent':4096,'features':fs})
c=combine_tiles(tiles);assert c==json.load(open(W/'combined.json'))
svg=render_svg(c);assert svg==(W/'all.svg').read_text()
east=re.sub(r'viewBox="[^"]+"','viewBox="4400 4700 4600 3200"',svg,count=1).replace('<title>','<rect x="4400" y="4700" width="4600" height="3200" fill="white"/><title>',1)
assert east==(W/'east.svg').read_text()
x=((140.099+180)/360*65536-58271)*4096;y=((1-math.asinh(math.tan(math.radians(35.7225)))/math.pi)/2*65536-25796)*4096
focus=re.sub(r'viewBox="[^"]+"',f'viewBox="{x-1800} {y-1800} 3600 3600"',svg,count=1)
for f in c['features']:
 if f['sourceLayer']!='BldA' or f['geometry']['type']!='Polygon':continue
 r=f['geometry']['coordinates'][0];xx=sum(v[0] for v in r)/len(r);yy=sum(v[1] for v in r)/len(r)
 area=abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(r,r[1:])))/2
 if abs(xx-x)<1800 and abs(yy-y)<1800 and area>12000:focus=focus.replace('</svg>',f'<text x="{xx}" y="{yy}" font-size="40" fill="red">{f["id"].split("-")[-1]}</text></svg>')
assert focus==(W/'focus.svg').read_text()
print('PASS: 9 original tiles reproduce combined geometry and all/east/focus SVG exactly; area threshold affects exploratory labels only')
