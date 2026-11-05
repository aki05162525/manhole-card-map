import urllib.request,json,gzip,hashlib,datetime,pathlib,math
from pmtiles.reader import Reader
from mapbox_vector_tile import decode
from PIL import Image,ImageDraw
D=pathlib.Path('data/work/location-batch2/north-kanto');E=pathlib.Path('data/evidence/location-batch2/north-kanto');url='https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles';records=[]
def get_bytes(offset,length):
 path=D/f'pmtiles-{offset}-{length}.bin'
 if path.exists():return path.read_bytes()
 at=datetime.datetime.now(datetime.timezone.utc).isoformat()
 with urllib.request.urlopen(urllib.request.Request(url,headers={'Range':f'bytes={offset}-{offset+length-1}'}),timeout=40) as r:
  b=r.read();assert r.status==206 and len(b)==length
  records.append(dict(sourceUrl=url,range=f'bytes={offset}-{offset+length-1}',retrievedAt=at,status=r.status,path=str(path),sha256=hashlib.sha256(b).hexdigest(),bytes=len(b),etag=r.headers.get('ETag'),lastModified=r.headers.get('Last-Modified')))
 path.write_bytes(b);(E/'vector-retrievals.json').write_text(json.dumps(records,indent=2)+'\n');return b
r=Reader(get_bytes);header=r.header();(D/'vector-header.json').write_text(json.dumps(header,default=str));(D/'vector-metadata.json').write_text(json.dumps(r.metadata()))
# Coarse investigation window only; not a facility point and never used in contains().
lat,lon=36.17,139.60;z=16;x=int((lon+180)/360*2**z);y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z)
im=Image.new('RGB',(1800,1800),'white');dr=ImageDraw.Draw(im);tiles=[]
for dx in [-1,0,1]:
 for dy in [-1,0,1]:
  tx,ty=x+dx,y+dy;b=r.get(z,tx,ty);name=f'vector-{z}-{tx}-{ty}';(D/(name+'.pbf.gz')).write_bytes(b);d=decode(gzip.decompress(b),default_options={'y_coord_down':True});(D/(name+'.json')).write_text(json.dumps(d));tiles.append(dict(z=z,x=tx,y=ty,path=str(D/(name+'.pbf.gz')),sha256=hashlib.sha256(b).hexdigest()))
  for i,f in enumerate(d['BldA']['features']):
   g=f['geometry'];polys=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
   for poly in polys:
    ps=[((a/4096+dx+1)*600,(c/4096+dy+1)*600) for a,c in poly[0]];dr.polygon(ps,fill='#ffddbb',outline='#555555')
  dr.text(((dx+1)*600,(dy+1)*600),f'{tx}/{ty}',fill='black')
im.save(D/'hanyu-vector-window.png');assert len({a['etag'] for a in records})==1
(E/'vector-window.json').write_text(json.dumps(dict(schema=1,facilityId='facility:kanto-north-c73669beeeb24f667599',purpose='広域の外形比較のみ。粗い探索窓中心は採用座標でも建物同定根拠でもない。contains選択・代表点計算をしない。',tiles=tiles,adoptedCoordinate=None),ensure_ascii=False,indent=2)+'\n')
