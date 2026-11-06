import json,math,hashlib
from pathlib import Path
from shapely.geometry import shape,Point
R=6378137
root=Path.cwd(); base=root/'data/evidence/kanto-prefecture/saitama/groups'; old=Path('/home/akihiro/.t3/worktrees/manhole-card-map/t3-60b8ee0c/data/work/kanto-prefecture/saitama')
ids=['08db6f2252ed32919222','1a5c86a3e21c20b9dcc2','2bef1ef8fe90f960751c','338d33c309d5e44859e4','365e6c6bea1d082fb583','3f70fe18aa4d98644d5b','4f8550974a31b7d62c39','6193af412ca73d91d288','80e64df38987c39b7386','95b116c7383dbf61b3b4','9c30c84d390ac7961fee','c296841d2a4b31ceb758','cb0d94bb8b91f48a986f','e199c890078d5d73c908','e2961b63ac4d4c596eb9','e80f795026cf0f441105','e9b95c73682cd106b4e8','f45d3f2e581350eedec5','shiraoka-temporary-shoko']
coords=[(36.08630,139.45260),(35.81450,139.64100),(35.99587,139.61802),(35.79145,139.46512),(36.10824,139.62132),(36.13244,139.24571),(35.83650,139.38750),(35.80648,139.61678),(35.81394,139.64169),(36.13968,139.38975),(35.980815,139.411178),(35.982649,139.596614),(36.012165,139.739386),(36.11667,139.19583),(36.03974,139.42163),(35.83577,139.391056),(36.125667,139.597722),(36.1397,139.2958),(36.0179,139.6645)]
rows={r['facilityId']:r for r in json.loads((root/'data/national/kanto-prefecture/saitama/full-outcomes.json').read_text())['rows']}
civic=json.loads((base/'civic/geometry-comparisons.json').read_text())
def read(p):return json.loads(p.read_text())
def lonlat(x,y,t):
 n=2**t['z']; return [(t['x']+x/4096)/n*360-180,math.degrees(math.atan(math.sinh(math.pi*(1-2*(t['y']+y/4096)/n))))]
def getgeoms(n,id):
 if n in [23,29,30]:
  p=base/f'waterworks/{id}-considered-geometries.json';d=read(p);return p,[(f['combinedFeatureIndex'],f['feature']['geometry'],d['baseTile']) for f in d['features']]
 if n in [24,26,32,33,34,38,40]:
  names={24:'ina',26:'kazo-treatment',32:'ishii',33:'ageo',34:'miyashiro',38:'kazo-cityhall',40:'shiraoka'}; d=civic[names[n]];return base/'civic/geometry-comparisons.json',[(f['combinedFeatureIndex'],f['geometry'],d['baseTile']) for f in d['features']]
 if n in [25,28,31,35,36,37]:
  names={25:('tourism','machizou'),28:('west','iruma'),31:('tourism','kumagaya'),35:('tourism','yotteco'),36:('tourism','yoshimi'),37:('west','iruma')};g,s=names[n];p=base/f'{g}/{s}-geometry.json';d=read(p);return p,[(f['combinedIndex'],f['feature']['geometry'],f['baseTile']) for f in d['features']]
 if n in [22,39]:
  name={22:'tenku',39:'kawamoto'}[n];p=old/f'groups/north/{name}-combined.json';d=read(p);indexes={22:[1154],39:[1443,1448,1450]}[n];return p,[(i,d['features'][i]['geometry'],d['baseTile']) for i in indexes]
 return None,[]
results=[]
for n,id,(lat,lng) in zip(range(22,41),ids,coords):
 fid='facility:kanto-north-'+id;r=rows[fid];p,gs=getgeoms(n,id); comps=[]
 for idx,geo,t in gs:
  shp=shape(geo);px=((lng+180)/360*2**t['z']-t['x'])*4096; py=((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**t['z']-t['y'])*4096
  q=Point(px,py);scale=2*math.pi*R*math.cos(math.radians(lat))/(2**t['z']*4096)
  c=shp.representative_point();ll=lonlat(c.x,c.y,t)
  comps.append({'featureIndex':idx,'distanceToPolygonM':round(shp.distance(q)*scale,2),'inside':shp.contains(q),'comparisonRepresentativeCoordinate':{'lat':ll[1],'lng':ll[0]},'representativeDistanceM':round(c.distance(q)*scale,2)})
 results.append({'number':n,'facilityId':fid,'name':r['name'],'userReportedCoordinate':{'lat':lat,'lng':lng},'userReportedAt':'2026-11-06','sourceAssessment':f'data/national/issue76/saitama/assessment.json','priorObservation':r.get('observation',r.get('buildingComparison',str(r.get('performedMethods')))),'priorRemainingWork':r['remainingWork'],'geometryPath':str(p) if p else None,'geometrySHA256':hashlib.sha256(p.read_bytes()).hexdigest() if p else None,'comparisons':comps,'minimumDistanceToComparedPolygonsM':min([c['distanceToPolygonM'] for c in comps],default=None),'adoptionApproved':False})
Path('/tmp/issue60-human-saitama/results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
for r in results:print(r['number'],r['name'],r['minimumDistanceToComparedPolygonsM'],[(c['featureIndex'],c['inside']) for c in r['comparisons']])
