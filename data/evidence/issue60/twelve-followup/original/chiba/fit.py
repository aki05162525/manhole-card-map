import numpy as np,json,math
from pathlib import Path
p=Path('/tmp/issue60-recheck-chiba-nov6')
a=np.array([[350,345],[620,345],[620,460],[350,460]],float)
b=np.array([[3696,4391],[3569,4106],[3688,4052],[3814,4338]],float)
# orientation-preserving similarity: x=u*a-v*b+c ; y=u*b+v*a+d
A=[];B=[]
for (u,v),(x,y) in zip(a,b):A.extend([[u,-v,1,0],[v,u,0,1]]);B.extend([x,y])
k=np.linalg.lstsq(A,B,rcond=None)[0]
def apply(pt):u,v=pt;aa,bb,c,d=k;return np.array([u*aa-v*bb+c,u*bb+v*aa+d])
def coord(q):x,y=q; n=2**16*4096;return [math.degrees(math.atan(math.sinh(math.pi*(1-2*(25862*4096+y)/n)))),(58245*4096+x)/n*360-180]
for pt in [[750,670],[1030,600],[1174,535],[911,520],[350,345]]:print(pt,apply(pt),coord(apply(pt)))
r=dict(method='similarity using retained health center outer corners only; manual pixel positions',planPixels=a.tolist(),gsiXY=b.tolist(),coefficients=k.tolist(),fitResidualUnits=(np.array([apply(q) for q in a])-b).tolist(),candidateXY=apply([750,670]).tolist(),candidateCoordinate=coord(apply([750,670])),targetPlanPixel=[750,670]);(p/'hall-fit.json').write_text(json.dumps(r,indent=2))
