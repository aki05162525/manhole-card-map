import json,pathlib
from PIL import Image,ImageDraw
from shapely.geometry import shape
O=pathlib.Path('/tmp/issue60-recheck-third-other');old=json.load(open('/tmp/issue60-recheck-saitama-nov6/numerical-comparison.json'));frames=json.load(open(O/'aerial-frames.json'))
for n,idx in [(30,[492,494,998,2212,2503]),(36,[1255,1257,1258,1259,1265])]:
 p=next(r['geometryPath'] for r in old if r['number']==n);d=json.load(open(p));t=d['baseTile'];fr=frames[str(n)];im=Image.open(O/f'{n}-aerial.png');dr=ImageDraw.Draw(im)
 def xy(v):return ((t['x']+v[0]/4096)*4*256-fr['x']*256,(t['y']+v[1]/4096)*4*256-fr['y']*256)
 for i in idx:
  f=d['features'][i];g=shape(f['geometry']);c=g.representative_point()
  for part in (g.geoms if hasattr(g,'geoms') else [g]):dr.line([xy(v) for v in part.exterior.coords],fill='red',width=2)
  dr.text(xy(c.coords[0]),str(i),fill='yellow',stroke_width=1,stroke_fill='black')
 im.save(O/f'{n}-overlay.png')
