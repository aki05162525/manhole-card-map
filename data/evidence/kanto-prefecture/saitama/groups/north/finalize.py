import json,hashlib
from pathlib import Path
N=Path('data/national/kanto-prefecture/saitama');E=Path('data/evidence/kanto-prefecture/saitama/groups/north')
def read(p):return json.loads(p.read_text())
def save(p,j):p.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
rows=[]
for p in sorted(E.glob('*-reading.json')):
 r=read(p);r['buildingComparisonPerformed']=True;r['evidenceReferences']=[{'path':str(p),'sha256':sha(p)}];r['remainingWork']=r.get('remainingWork',r.get('nextAction'));rows.append(r)
assert len(rows)==7
save(N/'groups/north/outcomes.json',{'schema':1,'rows':rows,'adoptionApproved':False,'manifestModified':False})
updates=read(N/'locations.json')['updates']
for name in ['muji','okabe']:
 g=read(E/f'{name}-geometry.json');r=read(E/f'{name}-reading.json');t=g['source']['sourceTile'];p=E/f"{name}-{t['z']}-{t['x']}-{t['y']}.pbf.gz"
 updates.append({'facilityId':r['facilityId'],'coordinate':g['candidateCoordinate'],'scope':'building','evidence':{'sourceUrl':'https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles','snapshotPath':str(p),'snapshotSHA256':sha(p),'sourceLocator':f"z{t['z']}/{t['x']}/{t['y']} BldA features[{g['source']['layerFeatureIndex']}]; {name}-geometry.json",'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':r['observation']+' 国土地理院最適化ベクトルタイルを加工。逆XYZ投影、7桁丸め前後内包。配布棟代表点候補、採用未承認、独立原本同定/CRSレビュー待ち。'}})
save(N/'groups/north/locations.json',{'schema':1,'updates':updates})
