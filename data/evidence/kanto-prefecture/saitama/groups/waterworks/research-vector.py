import json,sys,math,time,hashlib
from pathlib import Path
sys.path.insert(0,'tools/national')
from research_common import fetch_cached,adjacent_tiles,decode_tile,combine_tiles,render_svg
from pmtiles.reader import Reader
from PIL import Image,ImageDraw
from shapely.geometry import shape
W=Path('data/work/kanto-prefecture/saitama/groups/waterworks');E=Path('data/evidence/kanto-prefecture/saitama/groups/waterworks')
name,lat,lon=sys.argv[1],float(sys.argv[2]),float(sys.argv[3]);out=E/name;out.mkdir(exist_ok=True);records=[];start=time.time()
def getb(o,n):
 b,r=fetch_cached('https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles',W/'vector-cache','optbv-waterworks-2026-11-05',headers={'Range':f'bytes={o}-{o+n-1}'})
 records.append(r);(out/'ranges.json').write_text(json.dumps(records,indent=2)+'\n')
 if b is None:raise ValueError(r)
 assert len({(r.get('etag'),r.get('lastModified')) for r in records})==1
 return b
reader=Reader(getb);z=16;tile={'z':z,'x':int((lon+180)/360*2**z),'y':int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z)};tiles=[];raws=[]
for t in adjacent_tiles(tile):
 b=reader.get(**t);p=out/f"{t['z']}-{t['x']}-{t['y']}.pbf.gz";p.write_bytes(b);raws.append({'tile':t,'path':str(p),'sha256':hashlib.sha256(b).hexdigest()});d=decode_tile(b);features=[]
 for layer in ['BldA','RdCL','RdEdg','WA','WL']:
  for i,f in enumerate(d.get(layer,{}).get('features',[])):features.append({**f,'layer':layer,'layerFeatureIndex':i})
 tiles.append({'tile':t,'extent':4096,'features':features})
c=combine_tiles(tiles);(W/(name+'-combined.json')).write_text(json.dumps(c));(W/(name+'.svg')).write_text(render_svg(c))
import cairosvg
cairosvg.svg2png(url=str(W/(name+'.svg')),write_to=str(W/(name+'-full.png')),output_width=1800,output_height=1800,background_color='white')
# Separate labeled local crop, with full all-feature render retained.
x=((lon+180)/360*2**z-c['baseTile']['x'])*4096;y=((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z-c['baseTile']['y'])*4096
half=3500;bounds=[x-half,y-half,x+half,y+half];im=Image.new('RGB',(1800,1800),'white');dr=ImageDraw.Draw(im)
def xy(p):return ((p[0]-bounds[0])/(2*half)*1800,(p[1]-bounds[1])/(2*half)*1800)
for i,f in enumerate(c['features']):
 geom=f['geometry'];g=shape(geom);b=g.bounds
 if b[2]<bounds[0] or b[0]>bounds[2] or b[3]<bounds[1] or b[1]>bounds[3]:continue
 polys=[geom['coordinates']] if geom['type']=='Polygon' else geom['coordinates'] if geom['type']=='MultiPolygon' else []
 for poly in polys:dr.polygon([xy(p) for p in poly[0]],fill='#e2eaf2',outline='#456')
 if polys and f['layer']=='BldA':dr.text(xy(g.centroid.coords[0]),str(i),fill='red')
 if geom['type']=='LineString':dr.line([xy(p) for p in geom['coordinates']],fill='#777',width=1)
im.save(W/(name+'-local.png'))
(out/'window.json').write_text(json.dumps({'schema':1,'name':name,'acquisitionCenterOnly':{'lat':lat,'lng':lon},'rawTiles':raws,'fullRenderPath':str(W/(name+'-full.png')),'localRenderPath':str(W/(name+'-local.png')),'localCropTileXYBounds':bounds,'baseTile':c['baseTile'],'featureCount':len(c['features']),'elapsedSeconds':time.time()-start},indent=2)+'\n');print(name,len(c['features']),flush=True)
