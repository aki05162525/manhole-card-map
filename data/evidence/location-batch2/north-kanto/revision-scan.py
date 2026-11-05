import runpy,json,gzip,math,pathlib,hashlib
from pmtiles.reader import Reader
from mapbox_vector_tile import decode
from PIL import Image,ImageDraw,ImageFont
D=pathlib.Path('data/work/location-batch2/north-kanto');E=pathlib.Path('data/evidence/location-batch2/north-kanto')
mod=runpy.run_path(str(E/'vector-scan.py'),run_name='scanner');r=Reader(mod['get_bytes']);spec=[]
for name,lat,lon in [('hitachi',36.599,140.651),('hanyu',36.17,139.60),('kumagaya',36.139,139.389),('shiraoka',36.019,139.677),('yaita',36.794,139.917),('tsuchiura',36.083,140.197)]:
 z=16;x=int((lon+180)/360*2**z);y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z);tiles=[];features=[]
 for dx in [-1,0,1]:
  for dy in [-1,0,1]:
   tx,ty=x+dx,y+dy;b=r.get(z,tx,ty);p=D/f'vector-{z}-{tx}-{ty}.pbf.gz';p.write_bytes(b);d=decode(gzip.decompress(b),default_options={'y_coord_down':True});tiles.append(dict(z=z,x=tx,y=ty,path=str(p),sha256=hashlib.sha256(b).hexdigest()))
   for layer in ['WA','WL','RdEdg','RdCL','BldA','Anno']:
    if layer not in d:continue
    assert d[layer]['extent']==4096
    for i,f in enumerate(d[layer]['features']):features.append(dict(layer=layer,tile=[z,tx,ty],index=i,geometry=f['geometry'],properties=f['properties']))
 (D/f'{name}-features.json').write_text(json.dumps(features,ensure_ascii=False));spec.append(dict(name=name,windowCenterTile=[z,x,y],tiles=tiles))
(E/'revision-windows.json').write_text(json.dumps(dict(schema=1,windows=spec,selection='Coarse acquisition windows only; feature identity established separately using official plans and surrounding geometry.'),indent=2)+'\n')
print('fetched',len(spec),'windows')
