from pathlib import Path
import json, math,hashlib
import numpy as np
from PIL import Image,ImageDraw
from shapely.geometry import Point, Polygon,shape
O=Path(__file__).parent
meta=json.load(open(O/'mosaic-metadata.json'))
def ll(no,xy):
 m=meta[str(no)];x,y=xy;s=256*2**m['z'];return {'lat':round(math.degrees(math.atan(math.sinh(math.pi*(1-2*(m['tileY0']*256+y)/s)))),7),'lng':round((m['tileX0']*256+x)/s*360-180,7)}
def mpp(no,xy):return 2*math.pi*6378137*math.cos(math.radians(ll(no,xy)['lat']))/(256*2**18)
def fit(src,dst):return np.linalg.lstsq(np.c_[src,np.ones(len(src))],np.array(dst),rcond=None)[0]
def run(no,src,dst,target,holdouts,polygon=None):
 A=fit(src,dst);p=np.r_[target,1]@A
 result={'number':no,'method':'manual affine official plan pixels to GSI photo pixels, then XYZ inverse Mercator','controls':[{'planPixel':s,'photoPixel':d}for s,d in zip(src,dst)],'matrix':A.tolist(),'planTarget':target,'photoPixel':p.tolist(),'coordinate':ll(no,p),'fitResidualMeters':(np.linalg.norm(np.c_[src,np.ones(len(src))]@A-dst,axis=1)*mpp(no,p)).tolist(),'holdouts':[]}
 for label,s,d in holdouts:
  projected=np.r_[s,1]@A;result['holdouts'].append({'label':label,'planPixel':s,'observedPhotoPixel':d,'projectedPhotoPixel':projected.tolist(),'differenceMeters':float(np.linalg.norm(projected-d)*mpp(no,p))})
 if polygon:
  poly=np.c_[polygon,np.ones(len(polygon))]@A;result['projectedTargetOutlinePixels']=poly.tolist();result['insideProjectedOutline']=Polygon(poly).covers(Point(p));result['distanceToProjectedOutlineMeters']=Polygon(poly).boundary.distance(Point(p))*mpp(no,p)
 return result
Image.open(O/'raw/41-floor-archive.png').resize((1888,1334)).save(O/'41-plan.png')
results=[]
# No40 layout original 1713x1440, 3 non-collinear centers. Holdouts are never included in fit.
results.append(run(40,[[625,956],[1295,855],[1270,510]],[[81,335],[455,278],[436,109]],[1013,983],[('komorebi building center',[550,595],[30,139]),('circular pond center',[1194,777],[404,229])],[[845,933],[1089,842],[1165,1032],[952,1113]]))
# No14 plan is rotated; derive correspondence from culture center building, not user coordinate.
# Three separated roof centers; fourth roof and two street intersections withheld.
results.append(run(14,[[600,605],[273,388],[422,610]],[[211,173],[299,251],[252,231]],[775,193],[('library roof center',[320,699],[209,293]),('north road junction',[1006,260],[249,15]),('south road junction',[139,260],[373,293])]))
# Area chosen directly within visible southern lot, independent of the plan's off-frame label center.
results.append({'number':14,'method':'direct photo area representative after official plan identifies south100 lot','photoPixel':[352,190],'coordinate':ll(14,[352,190]),'areaOutlinePixels':[[303,144],[360,112],[409,226],[354,253]],'boundaryMarginMeters':Polygon([[303,144],[360,112],[409,226],[354,253]]).boundary.distance(Point(352,190))*mpp(14,[352,190]),'candidateStatus':'review_required'})
# No7 schematic bridge interpolation along elevated railway, not address API.
a=np.array([133,294]);b=np.array([647,402]);t=(721-535)/(955-535);p=a+t*(b-a)
results.append({'number':7,'method':'linear interpolation E03 label between Genmori and Koume bridge rail intersections','planAnchors':[[535,205],[955,205]],'photoAnchors':[a.tolist(),b.tolist()],'planTarget':[721,205],'photoPixel':p.tolist(),'coordinate':ll(7,p),'fraction':t,'limitation':'operator map explicitly schematic; no independent interior-bay holdout; not adoption-ready'})
# No13 dimensional layout: two hypotheses for gate anchor. 14.56m dimension y520..718.
# The 2021 image cannot expose the ground-level gate behind the platform roof.
s=.5*((14.56/(718-520))+(12.92/(379-205)))
axis=np.array([[1,1],[-1,1]])/math.sqrt(2)
delta=(np.array([538,648])-np.array([344,888]))@axis*s/mpp(13,[350,520])
results.append({'number':13,'method':'dimensioned 2025 plaza layout, 14.56m and 12.92m independent scale estimates, rotate rail direction NE/SW; two gate-anchor hypotheses','planGate':[344,888],'planTrailerCenter':[538,648],'metersPerPlanPixel':s,'scaleEstimates':[14.56/(718-520),12.92/(379-205)],'photoOffset':delta.tolist(),'anchorHypotheses':[{'gatePhotoPixel':p,'trailerPhotoPixel':(np.array(p)+delta).tolist(),'coordinate':ll(13,np.array(p)+delta)}for p in [[333,523],[318,552]]],'limitation':'roof protrusion123 can mark access neighborhood but not gate position; hypotheses unresolved, numeric results are trials only'})
# No41 JR original image coordinates below refer to resized 1888x1334 image, checked dimensions before use.
# Native 3556x2514 is resized to 1888x1334 for explicit manual coordinates. Outside mouths inferred from station ground outline/photo, not platform centroid.
results.append(run(41,[[1269,889],[1162,889],[1269,985]],[[309,422],[319,466],[391,402]],[1205,976],[('east mouth south edge',[1162,985],[405,446])]))
for r in results:
 n=r['number'];r['adoptionApproved']=False;r['absoluteAccuracyMeters']=None
 if 'photoPixel'in r:
  p=r['photoPixel'];im=Image.open(O/f'{n}-seamlessphoto.png');d=ImageDraw.Draw(im);x,y=p;d.ellipse((x-5,y-5,x+5,y+5),outline='red',width=2)
  for q in r.get('controls',[]):
   x,y=q['photoPixel'];d.rectangle((x-3,y-3,x+3,y+3),outline='blue',width=2)
  for q in r.get('holdouts',[]):
   x,y=q['observedPhotoPixel'];d.rectangle((x-3,y-3,x+3,y+3),outline='lime',width=2)
  im.save(O/f'{n}-derived-{len([x for x in results[:results.index(r)] if x["number"]==n])}.png')
(O/'calculations.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps([{'number':r['number'],'coordinate':r.get('coordinate'),'holdouts':r.get('holdouts'),'trial':r.get('anchorHypotheses')}for r in results],ensure_ascii=False,indent=2))
