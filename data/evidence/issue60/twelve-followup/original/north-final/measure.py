import json,math,hashlib
from pathlib import Path
from shapely.geometry import shape,Point
O=Path('/tmp/issue60-recheck-north-final-nov6');R=Path.cwd();E=R/'data/evidence/kanto-prefecture'
pts={38:(36.13250,139.60800),39:(36.14138,139.29735),41:(36.19655,139.70990),42:(36.35740,139.58300),43:(36.43624,139.90943),44:(36.31361,139.80414),45:(36.40533,139.33047)}
inputs=[];rows=[]
def read(p):
 p=Path(p);inputs.append({'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()});return json.loads(p.read_text())
def calc(n,features,base):
 lat,lon=pts[n];z=base['z'];px=((lon+180)/360*2**z-base['x'])*4096;py=((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z-base['y'])*4096;pt=Point(px,py);scale=2*math.pi*6378137*math.cos(math.radians(lat))/(2**z*4096);out=[]
 for idx,f in features:
  g=shape(f['geometry']);c=g.representative_point();clon=(base['x']+c.x/4096)/2**z*360-180;clat=math.degrees(math.atan(math.sinh(math.pi*(1-2*(base['y']+c.y/4096)/2**z))))
  out.append({'featureIndex':idx,'baseTile':base,'coordinate':{'lat':round(clat,7),'lng':round(clon,7)},'userInside':g.covers(pt),'userDistanceToGeometryM':round(g.distance(pt)*scale,2),'distanceToRepresentativeM':round(c.distance(pt)*scale,2),'candidateBoundaryMarginM':round(c.distance(g.boundary)*scale,2),'geometry':f['geometry']})
 rows.append({'number':n,'comparisons':out})
d=read(E/'saitama/groups/civic/geometry-comparisons.json')['kazo-cityhall'];calc(38,[(f['combinedFeatureIndex'],f) for f in d['features']],d['baseTile'])
p=Path('/home/akihiro/.t3/worktrees/manhole-card-map/t3-60b8ee0c/data/work/kanto-prefecture/saitama/groups/north/kawamoto-combined.json');d=read(p);calc(39,[(i,d['features'][i]) for i in [1443,1448,1450]],d['baseTile'])
d=read(E/'tochigi/batch2/group-south/shikisaikan-numeric-check.json');calc(44,[(352,d['feature'])],{'z':16,'x':58217,'y':25663})
d=read(E/'gunma/east/kiryu-geometry.json');calc(45,[(f['combinedIndex'],f) for f in d['comparedFeatures'] if f['geometry']['type']=='Polygon'],d['baseTile'])
(O/'numerical-comparison.json').write_text(json.dumps({'method':'Saved decoded geometry only. XYZ y-down extent4096 inverse spherical Mercator; representative_point; local cos latitude distances. Not horizontal accuracy bounds.','rows':rows},ensure_ascii=False,indent=2))
(O/'geometry-input-hashes.json').write_text(json.dumps(inputs,indent=2))
for r in rows:print(r['number'],[(x['featureIndex'],x['coordinate'],x['userDistanceToGeometryM'],x['candidateBoundaryMarginM']) for x in r['comparisons']])
