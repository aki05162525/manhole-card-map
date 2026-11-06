import json,math,pathlib,hashlib
from shapely.geometry import shape,Point
from PIL import Image,ImageDraw
O=pathlib.Path('/tmp/issue60-recheck-third-other'); R=pathlib.Path('/home/akihiro/personal/manhole-card-map')
old=json.load(open('/tmp/issue60-recheck-saitama-nov6/numerical-comparison.json'))
res=[]
for n,lat,lng in [(11,35.25791,139.66216),(30,35.81156,139.63820),(36,36.03975,139.41890)]:
 if n==11:
  p=R/'data/evidence/kanto-prefecture/kanagawa/peninsula/kinugasa-comparison.json'; d=json.load(open(p));t=d['rows'][0]['baseTile'];fs=[r['feature'] for r in d['rows']]; ids=[f['sourceFeatureIndex'] for f in fs]
 else:
  p=pathlib.Path(next(r['geometryPath'] for r in old if r['number']==n));d=json.load(open(p));t=d['baseTile'];fs=d['features'];ids=list(range(len(fs)))
 z=t['z'];scale=2*math.pi*6378137*math.cos(math.radians(lat))/(2**z*4096);q=Point(((lng+180)/360*2**z-t['x'])*4096,((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z-t['y'])*4096)
 def ll(pt):return {'lat':round(math.degrees(math.atan(math.sinh(math.pi*(1-2*(t['y']+pt.y/4096)/2**z)))),7),'lng':round((t['x']+pt.x/4096)/2**z*360-180,7)}
 near=[];im=Image.new('RGB',(1100,1100),'white');dr=ImageDraw.Draw(im);rad=(35 if n==11 else 300)/scale
 def xy(v):return ((v[0]-q.x)/rad*500+550,(v[1]-q.y)/rad*500+550)
 for i,f in zip(ids,fs):
  g=shape(f['geometry']);layer=f.get('layer',f.get('sourceLayer'))
  if g.distance(q)*scale>rad*scale:continue
  c=g.representative_point()
  if layer=='BldA':near.append(dict(index=i,sourceFeatureIndex=f.get('sourceFeatureIndex'),sourceTile=f.get('sourceTile'),geometry=f['geometry'],distanceM=round(g.distance(q)*scale,3),inside=g.contains(q),representative=ll(c),areaM2=round(g.area*scale**2,2),vt_code=f.get('properties',{}).get('vt_code')))
  for part in (g.geoms if hasattr(g,'geoms') else [g]):
   if part.geom_type=='Polygon':dr.polygon([xy(v) for v in part.exterior.coords],fill='#dce8ed' if layer=='BldA' else '#f2f3f4',outline='#aab6bb')
   elif part.geom_type=='LineString':dr.line([xy(v) for v in part.coords],fill='#bbbbbb',width=1)
  if layer=='BldA':dr.text(xy((c.x,c.y)),str(i),fill='#004466')
 dr.ellipse((544,544,556,556),fill='red');dr.text((10,10),f'No {n}; reported point red; north up; radius {rad*scale}m',fill='black');im.save(O/f'{n}-comparison.png')
 near.sort(key=lambda x:x['distanceM']);res.append(dict(number=n,input=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),baseTile=t,reportedCoordinate={'lat':lat,'lng':lng},pointXY=list(q.coords)[0],nearest=near[:15]));print(n,[(r['index'],r['distanceM'],r['representative']) for r in near[:5]])
(O/'calculations.json').write_text(json.dumps(res,ensure_ascii=False,indent=2)+'\n')
