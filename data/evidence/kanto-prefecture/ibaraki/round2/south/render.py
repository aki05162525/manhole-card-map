import json,math,sys
from PIL import Image,ImageDraw
from shapely.geometry import shape
from pathlib import Path
D=Path('data/work/kanto-ibaraki/round2/south')/sys.argv[1];c=json.loads((D/'map-combined.json').read_text());base=c['baseTile'];ex=4096
x=((float(sys.argv[3])+180)/360*65536-base['x'])*ex;y=((1-math.asinh(math.tan(math.radians(float(sys.argv[2]))))/math.pi)/2*65536-base['y'])*ex
for name,bounds,size in [('window',c['bounds'],1800),('detail',[x-2400,y-2400,x+2400,y+2400],1600)]:
 im=Image.new('RGB',(size,size),'white');dr=ImageDraw.Draw(im);l,t,r,b=bounds
 def xy(p):return ((p[0]-l)/(r-l)*size,(p[1]-t)/(b-t)*size)
 for f in c['features']:
  g=shape(f['geometry']);co=f['geometry']['coordinates'];polys=[co] if g.geom_type=='Polygon' else co if g.geom_type=='MultiPolygon' else []
  for rings in polys:
   for k,ring in enumerate(rings):dr.polygon([xy(p) for p in ring],fill=('white' if k else '#d7e5ed'),outline='#777777')
  if not polys:
   for line in ([co] if g.geom_type=='LineString' else co):dr.line([xy(p) for p in line],fill='#999999',width=1)
  if f['layer']=='BldA' and g.area>4000 and g.intersects(__import__('shapely').geometry.box(*bounds)):
   dr.text(xy(g.centroid.coords[0]),str(f['originalIndex']),fill='red')
 for v in [4096,8192]:
  dr.line([xy((v,t)),xy((v,b))],fill='blue',width=2);dr.line([xy((l,v)),xy((r,v))],fill='blue',width=2)
 dr.text((10,10),'N up; blue = tile boundary; entire geometry rendered; labels BldA source index',fill='black');im.save(D/f'map-{name}.png')
