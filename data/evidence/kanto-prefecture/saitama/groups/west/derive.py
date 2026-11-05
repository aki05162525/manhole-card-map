import json,sys,math,hashlib
from pathlib import Path
sys.path.insert(0,'tools/national')
from research_common import rounded_coordinate,decode_tile
from location_lifecycle import digest
from shapely.geometry import shape
E=Path('data/evidence/kanto-prefecture/saitama/groups/west');W=Path('data/work/kanto-prefecture/saitama/groups/west');N=Path('data/national/kanto-prefecture/saitama/groups/west')
def save(p,v): p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
geometry={}
for name,indices in [('fujimino',[7190,7192,7196,7210]),('tokorozawa',[2993,2983,2997]),('iruma',[2816,2817,4845]),('fujimi',[3087,3088,3089,3097])]:
 c=json.loads((W/f'{name}-combined.json').read_text()); rows=[]
 for i in indices:
  f=c['features'][i];g=shape(f['geometry']);p=g.representative_point();r=rounded_coordinate(f['geometry'],c['baseTile'],list(p.coords)[0]);tile=f['sourceTile'];raw=E/f"{name}-{tile['z']}-{tile['x']}-{tile['y']}.pbf.gz"
  original=decode_tile(raw.read_bytes())['BldA']['features'][f['layerFeatureIndex']]
  assert original['properties']==f['properties']
  scale=40075016.68557849/(2**16*4096)*math.cos(math.radians(r['coordinate']['lat']))
  rows.append({'combinedIndex':i,'feature':f,'baseTile':c['baseTile'],'representativeTileXY':list(p.coords)[0],'calculation':r,'areaApproxSquareMetres':g.area*scale**2,'areaMethod':'local Web Mercator scale corrected by cos(latitude)^2; not surveyed floor area','snapshotPath':str(raw),'snapshotSHA256':sha(raw),'originalPropertiesVerified':True})
 geometry[name]=rows
 save(E/f'{name}-geometry.json',{'schema':1,'source':'GSI optimal_bvmap-v1','attribution':'国土地理院最適化ベクトルタイルをmanhole-card-mapが加工','features':rows,'sourceConditionsRef':'data/evidence/kanto-prefecture/saitama/source-conditions.json','crsApproved':False})
# Explicit research proposals only; shared manifest remains untouched.
inv={x['facilityId']:x for x in json.load(open('data/national/kanto-prefecture/saitama/inventory.json'))['rows']}
assign=json.load(open(N/'assignment.json'))['facilities']; updates=[];bindings=[]
for j,name,idx in [(1,'fujimino',7190),(2,'tokorozawa',2993),(3,'fujimino',7190),(5,'fujimi',3089)]:
 fid=assign[j]['facilityId'];g=next(x for x in geometry[name] if x['combinedIndex']==idx);f=g['feature'];t=f['sourceTile']
 u={'facilityId':fid,'coordinate':g['calculation']['coordinate'],'scope':'building','evidence':{'sourceUrl':'https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles','snapshotPath':g['snapshotPath'],'snapshotSHA256':g['snapshotSHA256'],'sourceLocator':f"z{t['z']}/{t['x']}/{t['y']} BldA features[{f['layerFeatureIndex']}]; {name}-geometry.json; research candidate only",'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'公式配布案内の棟名を公式配置図/案内図の隣接棟・道路と数値外形で照合。Shapely representative_pointをXYZ格子から逆投影し7桁丸め前後の内包を確認。国土地理院最適化ベクトルタイルをmanhole-card-mapが加工。CRS適用と同定の独立レビュー・採用未承認。'}}
 updates.append(u);bindings.append({'facilityId':fid,'identity':{'name':inv[fid]['oldPlace']['name'],'address':inv[fid]['oldPlace']['address']},'adoption':u,'adoptionSHA256':digest(u),'sourceVersion':'optimal_bvmap-v1 2026-07-01 / HTTP Last-Modified 2026-09-17; draft candidate'})
save(N/'locations.json',{'schema':1,'updates':updates});save(N/'location-lifecycle.json',{'schema':1,'bindings':bindings,'events':[],'groups':[]})
save(N/'selection-proposal.json',{'schema':1,'manifestReflected':False,'adoptionApproved':False,'proposedFacilityIds':[u['facilityId'] for u in updates],'note':'独立レビュー前。住所修正と製品CRSを別判断。自動承認なし。'})
print([(u['facilityId'],u['coordinate']) for u in updates])
