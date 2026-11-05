import sys,json,math,gzip,hashlib
from pathlib import Path
sys.path.insert(0,'tools/national')
from research_common import fetch_cached,adjacent_tiles,decode_tile,combine_tiles,render_svg
from pmtiles.reader import Reader
name=sys.argv[1]; D=Path('data/work/kanto-ibaraki/round2/south')/name; E=Path('data/evidence/kanto-prefecture/ibaraki/round2/south')/name; D.mkdir(parents=True,exist_ok=True); E.mkdir(parents=True,exist_ok=True); rs=[]
u='https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles'
def get_bytes(off,n):
 raw,r=fetch_cached(u,D/'cache','issue65-2026-11-05',{'Range':f'bytes={off}-{off+n-1}'})
 rs.append(r);(E/'vector-retrievals.json').write_text(json.dumps(rs,indent=2)+'\n')
 if raw is None:raise RuntimeError(r)
 assert len({(x.get('etag'),x.get('lastModified')) for x in rs})==1
 return raw
r=Reader(get_bytes);print(r.header());print(r.metadata())
z=16;lat=float(sys.argv[2]);lon=float(sys.argv[3])
center=dict(z=z,x=int((lon+180)/360*2**z),y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z));tiles=[];records=[]
for t in adjacent_tiles(center):
 b=r.get(t['z'],t['x'],t['y']); p=D/f"{t['z']}-{t['x']}-{t['y']}.pbf.gz";p.write_bytes(b);d=decode_tile(b);fs=[]
 for layer in ['BldA','RdEdg','RdCL','WA','WL']:
  for i,f in enumerate(d.get(layer,{}).get('features',[])):
   if f['geometry']['type'] in ['Polygon','MultiPolygon','LineString','MultiLineString']:fs.append(dict(f,id=f'{layer}/{i}',layer=layer,originalIndex=i))
 tiles.append(dict(tile=t,extent=4096,features=fs));records.append(dict(tile=t,path=str(p),sha256=hashlib.sha256(b).hexdigest()))
c=combine_tiles(tiles);(D/'map-combined.json').write_text(json.dumps(c));(D/'map-all.svg').write_text(render_svg(c));(E/'vector-window.json').write_text(json.dumps(dict(center=center,tiles=records,source=u,selection='coarse search window only; not a candidate point'),indent=2)+'\n')
