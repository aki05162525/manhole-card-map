"""Offline recalculation. No standard-map reference coordinates enter the fit."""
from pathlib import Path
import json,math,hashlib,itertools
import numpy as np
from PIL import Image,ImageDraw
from pyproj import Geod
from shapely.geometry import Point,Polygon,shape
O=Path(__file__).resolve().parent
G=Geod(ellps='GRS80')
def load(p):return json.loads((O/p).read_text())
def save(p,v):(O/p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
W=load('windows.json');V=load('georef-inputs.json')
def xyz(n,p):
 w=W[n];s=256*2**w['z'];x=w['x0']*256+p[0];y=w['y0']*256+p[1]
 return [math.degrees(math.atan(math.sinh(math.pi*(1-2*y/s)))),x/s*360-180]
def pixel(n,ll):
 lat,lon=ll;w=W[n];s=256*2**w['z']
 return [(lon+180)/360*s-w['x0']*256,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*s-w['y0']*256]
def dist(a,b):return abs(G.inv(a[1],a[0],b[1],b[0])[2])
def fit(c,method):
 if method=='affine':return np.linalg.lstsq([[*p,1] for p,q,l in c],[q for p,q,l in c],rcond=None)[0]
 a=[];b=[]
 for (x,y),(u,v),l in c:a.extend([[x,-y,1,0],[y,x,0,1]]);b.extend([u,v])
 s,r,x,y=np.linalg.lstsq(a,b,rcond=None)[0];return np.array([[s,r],[-r,s],[x,y]])
def calc(n):
 v=V[n];m=fit(v['control'],v['method']);mp=lambda p:(np.array([*p,1])@m).tolist();p=mp(v['target']);ll=xyz(n,p);scale=dist(xyz(n,p),xyz(n,[p[0]+1,p[1]]))
 checks=[dict(label=l,sourcePixel=a,photoPixel=b,predictedPhotoPixel=mp(a),discrepancyM=dist(xyz(n,mp(a)),xyz(n,b)),usedForFit=False) for a,b,l in v['check']]
 residuals=[dist(xyz(n,mp(a)),xyz(n,b)) for a,b,l in v['control']]
 # Explicit assumed readout perturbations, not an empirical absolute accuracy bound.
 variants=[]
 for bits in itertools.product([-1,1],repeat=len(v['control'])*2):
  c=[[a,[b[0]+bits[2*i]*3,b[1]+bits[2*i+1]*3],l] for i,(a,b,l) in enumerate(v['control'])]
  t=(np.array([*v['target'],1])@fit(c,v['method'])).tolist();variants.append(dist(ll,xyz(n,t)))
 sv=[]
 for i in range(len(v['control'])):
  for axis in range(2):
   for delta in [-3,3]:
    c=json.loads(json.dumps(v['control']));c[i][0][axis]+=delta
    q=(np.array([*v['target'],1])@fit(c,v['method'])).tolist();sv.append(dist(ll,xyz(n,q)))
 loo=[]
 if v['method']=='affine':
  for i in range(len(v['control'])):
   c=v['control'][:i]+v['control'][i+1:];q=(np.array([*v['target'],1])@fit(c,v['method'])).tolist();loo.append(dist(ll,xyz(n,q)))
 poly=Polygon([mp(q) for q in v['outline']]);margin=poly.exterior.distance(Point(p))*scale
 old={'43':[36.4361106,139.9092221],'45':[36.4057242,139.3307770]}[n]
 spec=load(f'inherited/raw/{n}-spec.geojson');metadata=[f['properties'] for f in spec['features'] if shape(f['geometry']).covers(Point(ll[1],ll[0]))]
 r=dict(number=int(n),facilityId={'43':'facility:kanto-north-ab5de7e90313a0f18ac5','45':'facility:kanto-north-88ee40433ca2bfde9534'}[n],name={'43':'ORIGAMIプラザ','45':'桐生市役所 新本庁舎'}[n],status='research_candidate_pending_independent_review',coordinate={'lat':round(ll[0],7),'lng':round(ll[1],7)},oldCoordinate={'lat':old[0],'lng':old[1]},oldPointDistanceM=dist(ll,old),method=v['method'],matrix=m.tolist(),targetSourcePixel=v['target'],targetPhotoPixel=p,fitResidualsM=residuals,heldOutChecks=checks,photoMetadata=metadata,photoMetresPerPixel=scale,readingSensitivity=dict(photoXYplusMinus3PixelsAllCombinationsMaxShiftM=max(variants),sourceOneCoordinatePlusMinus3PixelsMaxShiftM=max(sv),leaveOneControlOutTargetShiftsM=loo,interpretation='仮定した画素変動への感度。絶対位置誤差の実測上限ではない。'),mappedPlanOutlineLatLon=[xyz(n,mp(q)) for q in v['outline']],targetToMappedPlanOutlineM=margin,outlineMeaning='継承設計図の手読取範囲。現新棟の測量polygonでも精度保証でもない。',numericReference='GSI seamlessphoto z18; independent photo pixel readout',standardMapUsedForFit=False,oldCoordinatesUsedOnlyForDifference=True,absoluteAccuracyUpperBoundM=None,publicAdoptionApproved=False)
 for context,impath in [('source',v['sourceImage']),('photo',v['referenceImage'])]:
  im=Image.open(O/impath).convert('RGB');d=ImageDraw.Draw(im);f=(lambda a:a) if context=='source' else mp
  d.polygon([tuple(f(a)) for a in v['outline']],outline='red',width=2);q=f(v['target']);d.ellipse((q[0]-4,q[1]-4,q[0]+4,q[1]+4),fill='red')
  for tag,points,color in [('C',v['control'],'blue'),('H',v['check'],'green')]:
   for i,(a,b,l) in enumerate(points,1):
    x,y=a if context=='source' else b;d.ellipse((x-5,y-5,x+5,y+5),outline=color,width=2);d.text((x+6,y),tag+str(i),fill=color)
  d.rectangle((0,0,im.width,23),fill='white');d.text((4,4),'GSI photo + municipal plan / processed by manhole-card-map / NOT APPROVED',fill='black');im.save(O/f'{n}-evidence-{context}.png')
 return r
if __name__=='__main__':
 rows=[calc(n) for n in ['43','45']];save('candidates.json',rows)
 save('candidate-row-hashes.json',[{'number':r['number'],'sha256':hashlib.sha256(json.dumps(r,ensure_ascii=False,sort_keys=True).encode()).hexdigest(),'serialization':'json.dumps(row, ensure_ascii=False, sort_keys=True).encode(utf-8); default separators'} for r in rows])
 print(json.dumps([{k:r[k] for k in ['number','coordinate','oldPointDistanceM','fitResidualsM','heldOutChecks','readingSensitivity','targetToMappedPlanOutlineM','photoMetadata']} for r in rows],ensure_ascii=False,indent=2))
