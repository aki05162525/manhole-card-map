import json,math,pathlib,hashlib
root=pathlib.Path('/home/akihiro/personal/manhole-card-map')
out=pathlib.Path('/tmp/issue60-human-tokyo')
def load(p):return json.loads((root/p).read_text())
def xy(c,base):
 lat,lon=c; n=2**base['z'];return [(lon+180)/360*n*4096-base['x']*4096,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n*4096-base['y']*4096]
def boundary(c,ring):
 x,y=c;inside=False;dist=float('inf')
 for a,b in zip(ring,ring[1:]+ring[:1]):
  ax,ay=a;bx,by=b;dx,dy=bx-ax,by-ay;den=dx*dx+dy*dy;t=max(0,min(1,((x-ax)*dx+(y-ay)*dy)/den)) if den else 0
  dist=min(dist,math.hypot(x-ax-t*dx,y-ay-t*dy))
  if ((ay>y)!=(by>y)) and x<(bx-ax)*(y-ay)/(by-ay)+ax:inside=not inside
 return inside,dist
coords=[(35.700795,139.507844),(35.737562,139.849580),(35.776457,139.715064),(35.765961,139.328846),(35.776814,139.715871),(35.732470,139.228771),(35.710431,139.805807),(35.738150,139.782850),(35.650895,139.869728),(35.699021,139.622278)]
paths=['west/koganei/comparison','east/maruyoshi-comparison','north/hintmation-comparison','outer/hamura-comparison','north/museum-comparison','outer/flare-comparison','east/connect-comparison','east/mikawashima-comparison','south/reku-plan-derivation','west/ogikubo/comparison']
held=[r for r in load('data/national/issue76/tokyo/assessment.json')['outcomes'] if r['recommendation']=='hold'];results=[]
for i,(r,c,p) in enumerate(zip(held,coords,paths),1):
 path='data/evidence/kanto-prefecture/tokyo/'+p+'.json';j=load(path);old=None;ring=None;base=None;model=None
 if r['sourceLocationPath']:old=next(x['coordinate'] for x in load(r['sourceLocationPath'])['updates'] if x['facilityId']==r['facilityId'])
 if i in [1,10]:
  a=j['candidate'];old=a['inclusion']['coordinate'];ring=a['geometry']['coordinates'][0];base=a['baseTile'];model='saved GSI comparison geometry'
 if i==2:ring=j['numeric']['features'][0]['ring'];base=j['numeric']['baseTile'];model='saved GSI comparison geometry'
 if i==3:ring=j['numericFit']['rectCombined'];base={'z':16,'x':58201,'y':25784};model='schematic-plan mapped rectangle, not surveyed footprint'
 if i==4:ring=j['features'][0]['geometry']['coordinates'][0];base=j['baseTile'];model='saved GSI candidate 2872, booth identity unresolved'
 if i==5:ring=j['numericFit']['museumRectCombined'];base={'z':16,'x':58201,'y':25784};model='schematic-plan mapped rectangle, not surveyed footprint'
 if i==8:ring=j['manualUnionRing'];base=j['numeric']['baseTile'];model='saved GSI comparison union'
 if i==9:
  old=j['manualPointLatLng'];base={'z':18,'x':232921,'y':103252};ring=[xy(a,base) for a in j['mappedWallBoxLatLng']];model='plan bilinear mapped box; known check residual 10m'
 result={'number':i,'facilityId':r['facilityId'],'name':r['name'],'userCoordinate':{'lat':c[0],'lng':c[1]},'userReportedAt':'2026-11-06','referenceCoordinate':old,'referencePath':path,'referenceSHA256':hashlib.sha256((root/path).read_bytes()).hexdigest(),'distanceMethod':'local equirectangular 111195m/degree and cos(latitude); descriptive comparison, not absolute accuracy bound'}
 if old:result['distanceToReferenceMeters']=round(math.hypot((c[0]-old['lat'])*111195,(c[1]-old['lng'])*111195*math.cos(math.radians(c[0]))),3)
 if ring:
  q=xy(c,base);inside,d=boundary(q,ring);scale=40075016.68557849*math.cos(math.radians(c[0]))/(2**base['z']*4096)
  result['geometryComparison']={'model':model,'userPointInside':inside,'distanceToBoundaryMeters':round(d*scale,3),'baseTile':base}
 results.append(result)
(out/'numerical-comparison.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
for r in results:print(r['number'],r['distanceToReferenceMeters'] if 'distanceToReferenceMeters'in r else None,r.get('geometryComparison'))
