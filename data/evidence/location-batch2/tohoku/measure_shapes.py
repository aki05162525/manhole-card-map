import json,math,gzip
from mapbox_vector_tile import decode
from pathlib import Path
from shapely.geometry import shape
E=Path(__file__).resolve().parent
spec=json.loads((E/'vector-inputs.json').read_text())
out=[]
for name,indices in [('yamada',[125,126,127,128,129]),('hanamaki',[396,398,461,405,402,324]),('oga',[228,279,219,161]),('ishinomaki',[413,414,417])]:
 t=next(t for t in spec['tiles'] if t['name']==name);d={'layers':decode(gzip.decompress((E/t['file']).read_bytes()), default_options={'y_coord_down':True})};z,x,y=[t['tile'][k] for k in ['z','x','y']]
 for i in indices:
  f=d['layers']['BldA']['features'][i];p=shape(f['geometry']);c=p.centroid;lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*(y+c.y/4096)/2**z))));m=2*math.pi*6378137*math.cos(math.radians(lat))/2**z/4096
  out.append({'tileName':name,'featureIndex':i,'properties':f['properties'],'areaApproxM2':round(p.area*m*m,2),'areaMethod':'MVT planar area times local Web Mercator scale squared at centroid latitude; approximate, not cadastral/survey area','centroidTileXY':[round(c.x,3),round(c.y,3)],'bounds':list(p.bounds),'areaToConvexHull':round(p.area/p.convex_hull.area,5),'geometry':f['geometry']})
print(json.dumps({'schema':1,'rows':out},ensure_ascii=False,indent=2))
