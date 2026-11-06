"""Read-only, scoped geometry evidence. Run from repository root:
uv run --with mapbox-vector-tile==2.2.0 python data/evidence/issue76/tokyo/measure.py COUNTY
Prints JSON only; never changes research inputs. Dependencies include Shapely.
"""
import sys,json,math,re,gzip,hashlib
from pathlib import Path
from collections import defaultdict
import mapbox_vector_tile
from shapely.geometry import shape,Point
from shapely.affinity import translate
from shapely.ops import unary_union
c=sys.argv[1]
source={'tokyo':'integration/footprint-locations-proposal.json','kanagawa':'locations-all-proposed.json','chiba':'batch2/locations-proposed.json'}[c]
source='data/national/kanto-prefecture/'+c+'/'+source
rows=json.loads(Path(source).read_text())['updates']
tiles=defaultdict(list)
for f in sorted(Path('data/evidence/kanto-prefecture',c).rglob('*.pbf.gz')):
 m=re.search(r'(?:^|[-/])(16)-(\d{5})-(\d{5})\.pbf\.gz$',str(f))
 if m:tiles[(int(m[2]),int(m[3]))].append(f)
if c=='chiba':
 for r in json.loads(Path('data/evidence/kanto-prefecture/chiba/batch2/shiroi/shiroi-tile-reuse.json').read_text()):
  f=Path(r['snapshotPath']);assert hashlib.sha256(f.read_bytes()).hexdigest()==r['sha256']
  tiles[r['tile']['x'],r['tile']['y']].append(f)
cache={}
def get(x,y):
 if (x,y) in cache:return cache[x,y]
 fs=tiles[x,y];assert fs,(x,y)
 hashes={hashlib.sha256(f.read_bytes()).hexdigest() for f in fs}
 assert len(hashes)==1,('different versions',fs)
 f=fs[0]; d=mapbox_vector_tile.decode(gzip.decompress(f.read_bytes()),default_options={'y_coord_down':True})
 features=[]
 for layer in ['BldA','RdCL']:
  if layer not in d:continue
  assert d[layer]['extent']==4096
  for i,r in enumerate(d[layer]['features']):
   g=translate(shape(r['geometry']),xoff=x*4096,yoff=y*4096)
   if not g.is_valid:continue
   features.append((g,layer,{'path':str(f),'sha256':next(iter(hashes)),'layer':layer,'featureIndex':i,'tile':[16,x,y],'vt_code':r['properties'].get('vt_code')}))
 cache[x,y]=features;return features
out=[]
for r in rows:
 lat,lng=r['coordinate']['lat'],r['coordinate']['lng']; latr=math.radians(lat)
 px=(lng+180)/360*2**16*4096;py=(1-math.asinh(math.tan(latr))/math.pi)/2*2**16*4096
 point=Point(px,py);tx,ty=int(px//4096),int(py//4096)
 fs=[];used=[];missing=[]
 for x in range(tx-1,tx+2):
  for y in range(ty-1,ty+2):
   if tiles[x,y]:fs+=get(x,y);used.append([16,x,y])
   else:missing.append([16,x,y])
 fs=[(g,l,ref) for g,l,ref in fs if g.bounds[0]<px+2000 and g.bounds[2]>px-2000 and g.bounds[1]<py+2000 and g.bounds[3]>py-2000]
 containing=[(g,ref) for g,l,ref in fs if l=='BldA' and g.contains(point)]
 if not containing:
  out.append({'facilityId':r['facilityId'],'status':'no-containing-footprint','tilesMissing':missing});continue
 target=unary_union([g for g,ref in containing]);scale=2*math.pi*6378137*math.cos(latr)/(2**16*4096)
 # Only explicitly inherited same-building tile fragments may extend the target.
 extra={
 'facility:kanto-south-8eb0c39e8de39e13a0bf':{(58208,25819,156),(58209,25819,5)},
 'facility:kanto-south-d3e8ff1b9fe8cdfa07d3':{(58140,25831,39),(58139,25831,761)},
 'facility:kanto-south-5724e90e3e451f22eeef':{(58264,25781,112),(58264,25782,20)},
 'facility:kanto-south-caac2827c5303ba03047':{(58264,25781,112),(58264,25782,20)},
 }.get(r['facilityId'],set())
 selected=[(g,ref) for g,ref in containing]
 for g,l,ref in fs:
  if l=='BldA' and (ref['tile'][1],ref['tile'][2],ref['featureIndex']) in extra and ref not in [v for _,v in selected]:selected.append((g,ref))
 target=unary_union([g for g,_ in selected])
 selected_keys={(tuple(ref['tile']),ref['featureIndex']) for _,ref in selected}
 overlaps=[ref for g,l,ref in fs if l=='BldA' and (tuple(ref['tile']),ref['featureIndex']) not in selected_keys and g.intersection(target).area>1]
 others=[(g,ref) for g,l,ref in fs if l=='BldA' and g.intersection(target).area<=1]
 roads=[(g,ref) for g,l,ref in fs if l=='RdCL']
 def nearest(seq):
  if not seq:return None
  g,ref=min(seq,key=lambda q:point.distance(q[0]));return {'pointDistanceMeters':round(point.distance(g)*scale,3),'footprintSeparationMeters':round(target.distance(g)*scale,3),'source':ref}
 portion=None
 if r['facilityId'].endswith('integration-adachi-tourism-association'):
  pth='data/evidence/kanto-prefecture/tokyo/adachi-comparison.json';d=json.loads(Path(pth).read_text());b=d['baseTile']
  part=translate(shape(d['southProjection']['geometry']),xoff=b['x']*4096,yoff=b['y']*4096)
  portion={'boundaryMarginMeters':round(point.distance(part.boundary)*scale,3),'source':pth+'#/southProjection/geometry','limitation':'Selected south projection, not surveyed boundary of the entire south wing.'}
 out.append({'facilityId':r['facilityId'],'selectedPortion':portion,'coordinate':r['coordinate'],'boundaryMarginMeters':round(point.distance(target.boundary)*scale,3),'areaSquareMeters':round(target.area*scale**2,2),'containingSourceFeatures':[ref for g,ref in containing],'unionSourceFeatures':[ref for _,ref in selected],'overlappingUnselectedFeatures':overlaps,'nearestOtherFootprint':nearest(others),'nearestRoadCenterline':nearest(roads),'tilesUsed':used,'tilesMissing':missing})
print(json.dumps({'schema':1,'county':c,'sourceLocationPath':source,'method':'Rounded proposed lat/lng -> XYZ z16 extent4096. Decode saved PBF with y down; union point-containing BldA plus explicitly inherited same-building tile fragments; overlapping unselected geometries are listed separately and excluded from nearest non-overlapping footprint; minimum Euclidean boundary/geometry distance times 2*pi*6378137*cos(latitude)/(2^16*4096). RdCL is centerline, not road edge. Other footprints include unnamed roofs/annexes, not necessarily different facilities. No accuracy radius inferred.','licence':'国土地理院最適化ベクトルタイルを加工、PDL1.0。既存2026-07-01版取得記録継承。','limitations':['Geometry distances measure separation in this product, not absolute geodetic accuracy.','Selected geometry may represent roof/connected pieces; use identified parts in source comparisons. Never expand to all overlapping neighbors.','Adjacent 3x3 saved tiles and geometries with bounds intersecting +/-2000 tile units around point only; missing tiles explicitly listed.','No rereading of municipal originals or new building-identity approval.','Invalid source geometries are excluded from distance calculations; distances describe valid recorded geometries only.'],'rows':out},ensure_ascii=False,indent=2))
