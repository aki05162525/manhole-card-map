import json,gzip,math,hashlib
from pathlib import Path
from mapbox_vector_tile import decode
from shapely.geometry import shape,Point
from PIL import Image,ImageDraw
from pyproj import Geod
W=Path('data/work/location-batch2/kinki-east/revision');spec=json.loads(Path('data/evidence/location-batch2/kinki-east/vector-acquisition.json').read_text());geod=Geod(ellps='GRS80')
def geo(x,y,ext,tx,ty):return ((tx+x/ext)/65536*360-180,math.degrees(math.atan(math.sinh(math.pi*(1-2*(ty+y/ext)/65536)))))
for site in spec['sites']:
 name=site['name'];lng,lat=site['searchOnlyCenter'];half={'suzuka':125,'miyazu':190,'kyotamba':380,'rakusai':650}[name];size=1600;scale=size/(2*half);mpt=2*math.pi*6378137*math.cos(math.radians(lat))/65536
 fx=(lng+180)/360*65536;fy=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*65536
 im=Image.new('RGB',(size,size),'white');d=ImageDraw.Draw(im);rows=[]
 for t in site['tiles']:
  raw=Path(t['rawPath']).read_bytes();assert hashlib.sha256(raw).hexdigest()==t['sha256'];layers=decode(gzip.decompress(raw),default_options={'y_coord_down':True});ext=layers.get('BldA',{'extent':4096})['extent'];tx=t['x'];ty=t['y']
  def xy(x,y):return (((tx+x/ext)-fx)*mpt*scale+size/2,((ty+y/ext)-fy)*mpt*scale+size/2)
  for layer in ['RdCL','RailCL']:
   for f in layers.get(layer,{}).get('features',[]):
    g=shape(f['geometry'])
    for part in getattr(g,'geoms',[g]):
     if part.geom_type=='LineString':d.line([xy(*p) for p in part.coords],fill='#cccccc',width=2)
  for idx,f in enumerate(layers.get('BldA',{}).get('features',[])):
   g=shape(f['geometry']);c=g.centroid;cx,cy=xy(c.x,c.y)
   if not(0<cx<size and 0<cy<size):continue
   fid=hashlib.sha256(json.dumps(f['geometry'],sort_keys=True).encode()).hexdigest()[:8];area=0
   for part in getattr(g,'geoms',[g]):
    pts=[geo(x,y,ext,tx,ty) for x,y in part.exterior.coords];a=abs(geod.polygon_area_perimeter([p[0] for p in pts],[p[1] for p in pts])[0]);area+=a
    d.polygon([xy(x,y) for x,y in part.exterior.coords],fill='#dae4ef',outline='black')
    for ring in part.interiors:
     pts=[geo(x,y,ext,tx,ty) for x,y in ring.coords];area-=abs(geod.polygon_area_perimeter([p[0] for p in pts],[p[1] for p in pts])[0]);d.polygon([xy(x,y) for x,y in ring.coords],fill='white',outline='black')
   coord=geo(c.x,c.y,ext,tx,ty)
   rows.append({'key':fid,'tile':t,'index':idx,'properties':f['properties'],'geometry':f['geometry'],'extent':ext,'geodesicAreaM2':round(area,2),'centroidLngLat':coord,'centroidInside':g.contains(c),'searchPointInside':g.contains(Point((fx-tx)*ext,(fy-ty)*ext))})
   if area>65:d.text((cx-20,cy-6),f'{fid[:4]} {area:.0f}',fill='black')
 d.line((size/2-10,size/2,size/2+10,size/2),fill='red',width=3);d.line((size/2,size/2-10,size/2,size/2+10),fill='red',width=3);d.text((10,10),f'{name}: N up; {2*half}m wide; red = search only; GSI optimal vector (processed)',fill='black');im.save(W/(name+'-vector.png'));(W/(name+'-features.json')).write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n');print(name,len(rows))
