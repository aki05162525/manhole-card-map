import json,math,hashlib
from pathlib import Path
p=Path('/tmp/issue60-recheck-chiba-nov6');f=json.loads((p/'hall-fit.json').read_text());a,b,c,d=f['coefficients'];m=40075016.686*math.cos(math.radians(35.42965))/(2**16*4096)
checks=[]
for pix,xy in [([911,520],[3621,3689]),([1140,520],[3509,3439]),([911,635],[3733,3639])]:
 u,v=pix;q=[u*a-v*b+c,u*b+v*a+d];checks.append(dict(planPixel=pix,gsiVertex=xy,transformedXY=q,differenceMeters=math.dist(q,xy)*m))
f['heldOutMiddleBuildingCorners']=checks;f['holdoutCaveat']='既存中庁舎の外形折点3点をfitに不使用で比較。手読取/旧数値総描の影響を含む、独立地上測量ではない。';(p/'hall-fit.json').write_text(json.dumps(f,ensure_ascii=False,indent=2)+'\n')
for n in [18,20]:
 q=p/f'candidate-{n}.json';z=json.loads(q.read_text());z['independentPlanCheck']['heldOutMiddleBuildingCorners']=checks;q.write_text(json.dumps(z,ensure_ascii=False,indent=2)+'\n')
(p/'candidates.json').write_text(json.dumps(dict(adoptionApproved=False,updates=[json.loads((p/f'candidate-{n}.json').read_text()) for n in [16,18,20]]),ensure_ascii=False,indent=2)+'\n')
print(checks)
