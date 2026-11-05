import json,math,sys
from pathlib import Path
from shapely.geometry import shape
from PIL import Image,ImageDraw
name=sys.argv[1];lat,lon=map(float,sys.argv[2:4]);D=Path('data/work/kanto-prefecture/saitama/groups/west');j=json.loads((D/(name+'-combined.json')).read_text());e=j['extent'];base=j['baseTile']; z=base['z']
x=((lon+180)/360*2**z-base['x'])*e;y=((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z-base['y'])*e
bounds=(x-1500,y-1500,x+1500,y+1500);im=Image.new('RGB',(1500,1500),'white');dr=ImageDraw.Draw(im)
def xy(p):return ((p[0]-bounds[0])/2,(p[1]-bounds[1])/2)
for i,f in enumerate(j['features']):
 g=shape(f['geometry']);b=g.bounds
 if b[2]<bounds[0] or b[0]>bounds[2] or b[3]<bounds[1] or b[1]>bounds[3]:continue
 if f['geometry']['type']=='Polygon':
  dr.polygon([xy(p) for p in f['geometry']['coordinates'][0]],fill='#d5e5ef',outline='#455');dr.text(xy(g.centroid.coords[0]),str(i),fill='red')
  if f['layer']=='BldA' and g.area>8000:print(i,f['sourceTile'],f['layerFeatureIndex'],g.area,list(g.centroid.coords),f['tileBoundaryTouched'])
 elif f['geometry']['type']=='LineString':dr.line([xy(p) for p in f['geometry']['coordinates']],fill='#888',width=1)
im.save(str(D/(name+'-local.png')));print('crop',bounds,'base',base)
