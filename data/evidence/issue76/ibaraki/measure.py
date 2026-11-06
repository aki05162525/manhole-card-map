"""Read-only scoped measurements. Run at repository root; emits JSON to stdout.
Requires shapely and mapbox-vector-tile, as existing research_common.decode_tile.
No network, candidate regeneration, selection writes, or full-suite invocation.
"""
import hashlib,json,math,re,sys
from pathlib import Path
sys.path.insert(0,str(Path('tools/national').resolve()))
from research_common import decode_tile
from shapely.geometry import shape,Point
from shapely.affinity import translate
from shapely.ops import unary_union

def digest(x):return hashlib.sha256(json.dumps(x,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
def resolve(ref):
 p,_,pointer=ref.partition('#');x=json.loads(Path(p).read_text())
 for k in pointer.strip('/').split('/') if pointer else []:x=x[int(k)] if isinstance(x,list) else x[k]
 return x

def measure(county):
 inp=json.loads(Path(f'data/evidence/issue76/{county}/measurement-inputs.json').read_text());out=[];cache={}
 for row in inp['inputs']:
  source=resolve(row['sourceLocationPath']+'#'+row['sourceLocationPointer'])
  assert digest(source)==row['sourceLocationSHA256'] and source['coordinate']==row['coordinate']
  fp=row['geometryRef'].split('#')[0]
  assert hashlib.sha256(Path(fp).read_bytes()).hexdigest()==row['geometryFileSHA256']
  poly=shape(resolve(row['geometryRef']));b=row['baseTile'];co=row['coordinate'];n=2**b['z'];lat=math.radians(co['lat'])
  pt=Point(((co['lng']+180)/360*n-b['x'])*4096,((1-math.asinh(math.tan(lat))/math.pi)/2*n-b['y'])*4096)
  assert poly.is_valid and poly.contains(pt),(row['facilityId'],'selected geometry does not contain unchanged proposal')
  assert pt.distance(Point(resolve(row['calculationRef'])['roundedTileXY']))<1e-5
  scale=2*math.pi*6378137*math.cos(lat)/(n*4096)
  buildings=[];roads=[];hashes={}
  directory=row['tileDirectory']
  if directory not in cache:
   layers=[]
   for p in sorted(Path(directory).glob('*.pbf*')):
    nums=re.findall(r'\d+',p.name.split('.pbf')[0]);tx,ty=map(int,nums[-2:]);raw=p.read_bytes();sha=hashlib.sha256(raw).hexdigest()
    layers.append((p,tx,ty,sha,decode_tile(raw)))
   cache[directory]=layers
  seen=set()
  for p,tx,ty,sha,layers in cache[directory]:
   center_x=int((co['lng']+180)/360*n); center_y=int((1-math.asinh(math.tan(lat))/math.pi)/2*n)
   if abs(tx-center_x)>1 or abs(ty-center_y)>1:continue
   if (tx,ty,sha) in seen:continue
   seen.add((tx,ty,sha))
   hashes[str(p)]=sha
   for layer in ['BldA','RdEdg','RdCL']:
    for i,f in enumerate(layers.get(layer,{}).get('features',[])):
     g=translate(shape(f['geometry']),xoff=(tx-b['x'])*4096,yoff=(ty-b['y'])*4096)
     if g.is_empty or not g.is_valid:continue
     item=(g,{'path':str(p),'layer':layer,'featureIndex':i,'sha256':sha})
     if layer=='BldA':buildings.append(item)
     else:roads.append(item)
  # Exclude intersecting/touching geometries: same-building fragments/attached parts.
  # Thus nearestDisjointBuilding is not a claim to enumerate every separate building.
  disjoint=[(g,ref) for g,ref in buildings if g.disjoint(poly)]
  def nearest(items):
   if not items:return None
   g,ref=min(items,key=lambda x:pt.distance(x[0]))
   return {'pointDistanceMeters':round(pt.distance(g)*scale,3),'footprintSeparationMeters':round(poly.distance(g)*scale,3),'source':ref}
  # Prefer road edges; centerline only if edges absent in recorded window.
  edges=[x for x in roads if x[1]['layer']=='RdEdg']
  out.append({'facilityId':row['facilityId'],'geometryRef':row['geometryRef'],'boundaryMarginMeters':round(pt.distance(poly.boundary)*scale,3),'nearestDisjointBuilding':nearest(disjoint),'nearestRoadGeometry':nearest(edges or roads),'tileCount':len(hashes),'tileSHA256':hashes})
 return {'schema':1,'county':county,'method':'unchanged rounded candidate -> z16 extent4096 XYZ; Shapely Euclidean shortest distance × 2π6378137 cos(candidate latitude)/(2^16×4096). Saved selected polygon/union, holes included. Building/road measurements use retained raw tiles in candidate source directory, translated to the same grid.','limitations':['距離は当該数値地物への局所近似値であり現地誤差上限ではない。','外形境界は屋根/地図外形。接触・重複する棟/断片は隣棟探索から除外し、接続建物の区分は既存棟同定を継承する。','RdEdgがない窓ではRdCL中心線を返す。道路幅・入口・経路安全の保証には用いない。','原資料精度や系統差を格子間隔/丸め誤差から推定しない。'],'rows':out}
if __name__=='__main__':
 print(json.dumps(measure(sys.argv[1]),ensure_ascii=False,indent=2))
