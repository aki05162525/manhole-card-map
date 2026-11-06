import json,math
from pathlib import Path
from shapely.geometry import shape,Point
out=Path('/tmp/issue60-recheck-chiba-nov6'); root=Path('/home/akihiro/personal/manhole-card-map')
res={}
for key,path,lat,lon in [('togane','visitor-five/togane/combined.json',35.57715,140.38405),('hall','civic-five/cityhall-reused-combined.json',35.42935,139.95445),('tateyama','visitor-five/tateyama/combined.json',34.98972,139.85485)]:
 d=json.loads((root/'data/evidence/kanto-prefecture/chiba/batch2'/path).read_text()); z=d['baseTile']['z']; bx=d['baseTile']['x'];by=d['baseTile']['y']; scale=2**z*4096
 x=(lon+180)/360*scale-bx*4096;y=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*scale-by*4096; p=Point(x,y);m=40075016.686*math.cos(math.radians(lat))/scale
 def coord(x,y):return [math.degrees(math.atan(math.sinh(math.pi*(1-2*(by*4096+y)/scale)))),(bx*4096+x)/scale*360-180]
 near=sorted([(shape(f['geometry']).distance(p)*m,f) for f in d['features'] if f['sourceLayer']=='BldA'],key=lambda x:x[0])[:8]
 rows=[]
 for dist,f in near:
  g=shape(f['geometry']); c=g.representative_point();rows.append(dict(id=f['id'],distanceMeters=dist,coordinate=coord(c.x,c.y),area=g.area*m*m,bounds=g.bounds,geometry=f['geometry']))
 res[key]=dict(userXY=[x,y],baseTile=d['baseTile'],source=str(root/'data/evidence/kanto-prefecture/chiba/batch2'/path),nearest=rows)
 print(key,'USER XY',x,y,[(r['id'],round(r['distanceMeters'],1),r['coordinate'],round(r['area'])) for r in rows])
(out/'numeric-comparison.json').write_text(json.dumps(res,indent=2))
