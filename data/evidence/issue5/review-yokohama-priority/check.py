import pathlib,json,gzip,hashlib,xml.etree.ElementTree as E,zipfile,subprocess,re,datetime
import pyproj,shapely
from shapely.geometry import Polygon,Point
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
D=pathlib.Path('data/evidence/issue5/yokohama-priority'); O=D.parent/'review-yokohama-priority'
sha=lambda b:hashlib.sha256(b).hexdigest()
candidate=pathlib.Path('data/national/issue5/yokohama-priority.json'); u=json.loads(candidate.read_text())['updates'][0]
checks=[]
for rec in json.loads((D/'fetch-records.json').read_text())+json.loads((D/'reused-sources.json').read_text()):
 raw=pathlib.Path(rec['snapshotPath']).read_bytes(); assert sha(raw)==rec['snapshotSHA256']
 c={'path':rec['snapshotPath'],'sha256':sha(raw),'ok':True}
 if 'uncompressedResponseSHA256' in rec:
  c['uncompressedSHA256']=sha(gzip.decompress(raw)); assert c['uncompressedSHA256']==rec['uncompressedResponseSHA256']
 checks.append(c)
G='{http://www.opengis.net/gml}'; B='{http://www.opengis.net/citygml/building/2.0}'
f=pyproj.Transformer.from_crs(6668,6677,always_xy=True); inv=pyproj.Transformer.from_crs(6677,6668,always_xy=True)
roots=[E.fromstring(gzip.decompress((D/p).read_bytes())) for p in ['53391459.gml.gz','53391469.gml.gz']]
b=next(b for r in roots for b in r.findall('.//'+B+'Building') if b.attrib.get(G+'id')=='bldg_1754b772-2d39-48d3-9eb2-c5f0d933215a')
def xyz(el):
 v=list(map(float,el.text.split())); assert len(v)%3==0
 return list(zip(v[::3],v[1::3],v[2::3]))
fp=b.find('.//'+B+'lod0FootPrint'); assert len(fp.findall('.//'+G+'posList'))==1 and not fp.findall('.//'+G+'interior')
v=xyz(fp.find('.//'+G+'posList')); xy=[f.transform(lon,lat) for lat,lon,z in v]; p=Polygon(xy); assert p.is_valid and v[0]==v[-1]
x0,y0=xy[0]; q=[(x-x0,y-y0) for x,y in xy]; cr=[a*d-c*b for (a,b),(c,d) in zip(q,q[1:])]; a2=sum(cr)
cx=x0+sum((q[k][0]+q[k+1][0])*a for k,a in enumerate(cr))/(3*a2); cy=y0+sum((q[k][1]+q[k+1][1])*a for k,a in enumerate(cr))/(3*a2)
assert Point(cx,cy).distance(p.centroid)<1e-7
lon,lat=inv.transform(cx,cy); assert u['coordinate']=={'lat':round(lat,7),'lng':round(lon,7)}
point=Point(*f.transform(u['coordinate']['lng'],u['coordinate']['lat'])); assert p.contains(point)
fig,ax=plt.subplots(figsize=(9,11))
for r in roots:
 for other in r.findall('.//'+B+'Building'):
  for el in other.findall('.//'+B+'lod0FootPrint//'+G+'posList'):
   coords=[f.transform(lo,la) for la,lo,z in xyz(el)]; ax.plot([x-cx for x,y in coords],[y-cy for x,y in coords],color='#aab2bb',lw=.8)
ax.fill([x-cx for x,y in xy],[y-cy for x,y in xy],color='orange',alpha=.5,label='120521 LOD0')
high=[]; lod2=[]
for el in b.findall('.//'+B+'lod2MultiSurface//'+G+'posList'):
 vs=xyz(el); lod2.extend(vs)
 if min(z for la,lo,z in vs)>100:
  high.extend(vs); zxy=[f.transform(lo,la) for la,lo,z in vs]; ax.plot([x-cx for x,y in zxy],[y-cy for x,y in zxy],color='red',lw=1)
ax.scatter([point.x-cx],[point.y-cy],color='black',s=25,label='rounded centroid')
ax.set(xlim=(-240,240),ylim=(-230,330),xlabel='Easting from centroid (m)',ylabel='Northing from centroid (m)',title='GML geometry: target orange; LOD2 >100m red; north up')
ax.set_aspect('equal'); ax.legend(); ax.grid(alpha=.2); fig.savefig(O/'gml-context.png',dpi=150); plt.close(fig)
attrs={e.tag.split('}')[-1]:e.text for e in b.iter() if e.text and len(e)==0 and not e.tag.endswith(('posList','lowerCorner','upperCorner'))}
lod1=[z for el in b.findall('.//'+B+'lod1Solid//'+G+'posList') for la,lo,z in xyz(el)]
with zipfile.ZipFile(D/'metadata.zip') as z:
 meta=z.read('metadata\\udx_14100_city_2024_op.xml'); assert b'Licensed under CC BY 4.0' in meta
 (O/'metadata-extracted.xml').write_bytes(meta)
with zipfile.ZipFile(D/'codelists.zip') as z:
 matches={n:z.read(n).decode() for n in z.namelist() if 'PublicSurvey' in n}
 (O/'survey-codelists.json').write_text(json.dumps(matches,ensure_ascii=False,indent=2))
# Run source validation verbatim except redirect its output and disable bytecode writes; no candidate writes.
s=(D/'validate.py').read_text(); s=s.replace("(D/'validation.json').write_text", "(pathlib.Path('data/evidence/issue5/review-yokohama-priority')/'candidate-validator-result.json').write_text")
exec(compile(s,str(D/'validate.py'),'exec'),{'__file__':str((D/'validate.py').resolve())})
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'candidateSHA256':sha(candidate.read_bytes()),'hashChecks':checks,'crs':{str(n):{'name':pyproj.CRS(n).name,'axes':[{'name':a.name,'direction':a.direction} for a in pyproj.CRS(n).axis_info]} for n in [6697,6668,6677]},'gmlEnvelope':roots[0].find('.//'+G+'Envelope').attrib,'attributes':attrs,'originalVertices':v,'areaM2':abs(a2)/2,'centroid':{'lat':lat,'lng':lon},'rounded':u['coordinate'],'inside':True,'boundaryDistanceM':p.boundary.distance(point),'lod1AltitudeRange':[min(lod1),max(lod1)],'lod2AltitudeRange':[min(z for la,lo,z in lod2),max(z for la,lo,z in lod2)],'highPartLatitudeRange':[min(la for la,lo,z in high),max(la for la,lo,z in high)],'versions':{'pyproj':pyproj.__version__,'proj':pyproj.proj_version_str,'shapely':shapely.__version__},'validatorNote':'Executed original validate.py in memory with only output path redirected; original sources unchanged'}
(O/'checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['hashChecks','attributes','originalVertices']},ensure_ascii=False,indent=2))
# Build Go probe from the real current Evidence declaration and validator.
s=pathlib.Path('cmd/builddata/ledger.go').read_text(); struct=s[s.index('type Evidence struct {'):s.index('type LedgerCoordinate')]; fun=s[s.index('func validateEvidence('):s.index('func validStatus(')]
probe='package main\nimport("bytes";"encoding/json";"fmt";"os";"net/url";"strings";"time";"crypto/sha256")\n'+struct+fun+'''\nfunc hash(b []byte) string { return fmt.Sprintf("%x",sha256.Sum256(b)) }
func main(){raw,err:=os.ReadFile("data/national/issue5/yokohama-priority.json");if err!=nil{panic(err)};var c struct{ Updates []struct{Evidence json.RawMessage} };if err=json.Unmarshal(raw,&c);err!=nil{panic(err)};for _,u:=range c.Updates{d:=json.NewDecoder(bytes.NewReader(u.Evidence));d.DisallowUnknownFields();var e Evidence;if err=d.Decode(&e);err!=nil{panic(err)};if err=validateEvidence(e);err!=nil{panic(err)}};fmt.Println("PASS: actual Go Evidence strict decode and validateEvidence")}
'''
(O/'evidence-probe.go').write_text(probe)
r=subprocess.run(['go','run',str(O/'evidence-probe.go')],text=True,capture_output=True);(O/'go-evidence.txt').write_text(r.stdout+r.stderr); assert r.returncode==0,r.stderr
