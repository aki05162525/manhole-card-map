import json,math,hashlib,pathlib
from shapely.geometry import shape,Point
from PIL import Image,ImageDraw
O=pathlib.Path('/tmp/issue60-recheck-saitama-nov6');W=pathlib.Path('/home/akihiro/.t3/worktrees/manhole-card-map/t3-60b8ee0c/data/work/kanto-prefecture/saitama/groups')
names={22:'north/tenku',23:'waterworks/nanbu',24:'civic/ina',25:'tourism/machizou',27:'../fukaya',29:'waterworks/ugan',30:'waterworks/nanbu',32:'civic/ishii',35:'tourism/yotteco',36:'tourism/yoshimi'}
res=[]
for r in json.load(open(O/'user-report.json')):
 n=r['number'];p=W/(names[n]+'-combined.json');d=json.load(open(p));t=d['baseTile'];lat,lng=r['reportedCoordinate'].values();z=t['z'];scale=2*math.pi*6378137*math.cos(math.radians(lat))/(2**z*4096)
 q=Point(((lng+180)/360*2**z-t['x'])*4096,((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z-t['y'])*4096)
 def ll(pt):return {'lat':math.degrees(math.atan(math.sinh(math.pi*(1-2*(t['y']+pt.y/4096)/2**z)))),'lng':(t['x']+pt.x/4096)/2**z*360-180}
 near=[];im=Image.new('RGB',(1100,1100),'white');dr=ImageDraw.Draw(im);rad=230/scale
 def xy(v):return ((v[0]-q.x)/rad*500+550,(v[1]-q.y)/rad*500+550)
 for i,f in enumerate(d['features']):
  g=shape(f['geometry'])
  if g.distance(q)*scale>230:continue
  layer=f.get('layer');c=g.representative_point()
  if layer=='BldA':
   near.append(dict(featureIndex=i,distanceM=round(g.distance(q)*scale,3),inside=g.contains(q),representative=ll(c),sourceTile=f['sourceTile'],sourceFeatureIndex=f['sourceFeatureIndex'],layerFeatureIndex=f.get('layerFeatureIndex'),areaM2=round(g.area*scale**2,2)))
  gs=list(g.geoms) if hasattr(g,'geoms') else [g]
  for part in gs:
   if part.geom_type=='Polygon':
    pts=[xy(v) for v in part.exterior.coords];dr.polygon(pts,fill='#dce8ed' if layer=='BldA' else '#f2f3f4',outline='#aab6bb')
   elif part.geom_type=='LineString':dr.line([xy(v) for v in part.coords],fill='#bbbbbb',width=1)
  if layer=='BldA':dr.text(xy((c.x,c.y)),str(i),fill='#004466')
 dr.ellipse((544,544,556,556),fill='red');dr.text((10,10),f'No {n} user point red; north up; +/- 230m; GSI stored geometry',fill='black');im.save(O/f'{n}-comparison.png')
 near.sort(key=lambda x:x['distanceM']);res.append(dict(number=n,facilityId=r['facilityId'],coordinate=r['reportedCoordinate'],geometryPath=str(p),geometrySHA256=hashlib.sha256(p.read_bytes()).hexdigest(),baseTile=t,nearest=near[:12]))
 print(n,[(x['featureIndex'],x['distanceM'],x['representative']) for x in near[:4]])
(O/'numerical-comparison.json').write_text(json.dumps(res,ensure_ascii=False,indent=2)+'\n')
