import json,math,hashlib
from pathlib import Path
from shapely.geometry import shape,Point
R=Path('/home/akihiro/personal/manhole-card-map'); E=R/'data/evidence/kanto-prefecture'; out=Path('/tmp/issue60-human-other')
pts={11:(35.257915,139.662163),12:(35.257252,139.662781),13:(35.1889,139.6538),14:(35.4338,139.4313),15:(35.8456,140.1197),16:(34.9915,139.8550),17:(35.856399,139.975189),18:(35.4302,139.9549),19:(35.5658,140.3804),20:(35.4302,139.9549),21:(35.7208,140.1005),41:(36.1947,139.7096),42:(36.3578,139.5923),43:(36.4362,139.9094),44:(36.3136,139.8006),45:(36.4061,139.3308),46:None,47:(36.4356,139.2748)}
receipt=json.loads((R/'data/evidence/issue60/human-answers-20261106/receipt.json').read_text())
def load(p):return json.loads(Path(p).read_text())
def dist(a,b):return 6371008.8*2*math.asin(math.sqrt(math.sin(math.radians(a[0]-b[0])/2)**2+math.cos(math.radians(a[0]))*math.cos(math.radians(b[0]))*math.sin(math.radians(a[1]-b[1])/2)**2))
def geomcompare(p,latlng,base=None):
 d=load(p);base=base or d['baseTile']; fs=d.get('features',d.get('comparedFeatures',d.get('rows',[])));lat,lng=latlng;n=2**base['z'];extent=d.get('extent',4096); x=((lng+180)/360*n-base['x'])*extent;y=((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n-base['y'])*extent;pt=Point(x,y);scale=2*math.pi*6378137/n/extent*math.cos(math.radians(lat));rows=[]
 for f0 in fs:
  f=f0.get('feature',f0)
  if f.get('geometry',{}).get('type') not in ('Polygon','MultiPolygon'):continue
  g=shape(f['geometry']);rows.append({'id':f.get('id'), 'index':f.get('combinedIndex',f.get('sourceFeatureIndex',f.get('layerFeatureIndex'))),'vt_code':f.get('properties',{}).get('vt_code'),'contains':g.covers(pt),'distanceToGeometryMeters':round(pt.distance(g)*scale,3),'distanceToCentroidMeters':round(pt.distance(g.centroid)*scale,3)})
 return {'source':str(p.relative_to(R)), 'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'baseTile':base,'pointXY':[x,y],'nearestComparedFeatures':sorted(rows,key=lambda r:r['distanceToGeometryMeters'])[:5]}
files={11:('kanagawa/peninsula/kinugasa-comparison.json',{'z':16,'x':58191,'y':25900}),12:('kanagawa/peninsula/kinugasa-office-followup-comparison.json',{'z':16,'x':58191,'y':25900}),13:('kanagawa/north/miura-followup/nearby-geometries.json',{'z':16,'x':58190,'y':25915}),18:('chiba/batch2/civic-five/cityhall-rejected-footprints.json',None),19:('chiba/batch2/visitor-five/togane/combined.json',None),20:('chiba/batch2/civic-five/cityhall-rejected-footprints.json',None),21:('chiba/batch2/yachiyo-four/combined.json',None),42:('tochigi/batch2/group-east/sano-vector/comparison-features.json',{'z':16,'x':58178,'y':25653}),45:('gunma/east/kiryu-geometry.json',None),47:('gunma/east/midori-geometry.json',None)}
rows=[]
for a in receipt['answers']:
 n=a['number']
 if n not in pts:continue
 ap,pointer=a['assessmentRef'].split('#');ass=load(R/ap)['outcomes'][int(pointer.split('/')[-1])];r={'number':n,'facilityId':a['facilityId'],'county':a['county'],'name':a['heading'],'reportedCoordinate':None if pts[n] is None else dict(zip(['lat','lng'],pts[n])),'assessmentRef':a['assessmentRef'],'priorAssessment':ass['positionSuitability']['buildingAssessment']}
 if ass.get('sourceLocationPath'):
  cand=next(x for x in load(R/ass['sourceLocationPath'])['updates'] if x['facilityId']==a['facilityId']);p=cand['coordinate'];r['existingCandidate']=p;r['candidateSource']=ass['sourceLocationPath'];r['distanceToExistingCandidateMeters']=round(dist(pts[n],(p['lat'],p['lng'])),3)
 if n in files:r['geometryComparison']=geomcompare(E/files[n][0],pts[n],files[n][1])
 rows.append(r)
(out/'numeric-comparison.json').write_text(json.dumps({'method':'Haversine candidate distances; saved geometry read-only comparison, XYZ/WebMercator grid with local cos(latitude) scale. Distances are not absolute accuracy bounds. No original decode repeated.','rows':rows},ensure_ascii=False,indent=2)+'\n')
for r in rows:print(r['number'],r.get('distanceToExistingCandidateMeters'),r.get('geometryComparison',{}).get('nearestComparedFeatures',[])[:2])
