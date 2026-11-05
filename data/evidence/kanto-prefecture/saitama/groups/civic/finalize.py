import sys,json,hashlib,math,shutil,time,subprocess
from pathlib import Path
sys.path.insert(0,'tools/national')
from research_common import rounded_coordinate
from shapely.geometry import shape
from shapely.ops import unary_union
E=Path('data/evidence/kanto-prefecture/saitama/groups/civic');N=Path('data/national/kanto-prefecture/saitama/groups/civic');W=Path('data/work/kanto-prefecture/saitama/groups/civic')
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
a=json.loads((N/'assignment.json').read_text())['facilities'];inv=json.loads(Path('data/national/kanto-prefecture/saitama/inventory.json').read_text());print(inv.keys())
names=['ina','kazo-treatment','samachika','ishii','ageo','miyashiro','kazo-cityhall','shiraoka']
indices=[[1067,2650,2700],[3399,3403,3406,3408],[1422,2192,2189,2203,1416],[1302,1464,1467,1468,1469,1477],[4397,6977,7412],[2041,2047],[3145,3146,3143],[2500,2501,4563,2560,4579,4581]]
rs=json.loads((E/'retrievals.json').read_text());geom={};bindings=[]
for row,name,ixs in zip(a,names,indices):
 c=json.loads((W/(name+'-combined.json')).read_text());facts=[]
 for i in ixs:
  f=c['features'][i];g=shape(f['geometry']);xy=g.representative_point().coords[0];num=rounded_coordinate(f['geometry'],c['baseTile'],xy);lat=num['coordinate']['lat'];ground=(40075016.68557849/(2**16*4096)*math.cos(math.radians(lat)))**2
  facts.append({'combinedFeatureIndex':i,**f,'areaTileUnitsSquared':g.area,'approxGroundAreaM2':g.area*ground,'areaMethod':'spherical Web Mercator local latitude scale, comparison only; not surveyed floor area','mechanicalCoordinateForComparisonOnly':num})
 window=json.loads((E/(name+'-vector-window.json')).read_text());raws=[]
 for t in window['tiles']:
  tile=t.get('tile',t);p=E/f"{name}-{tile['z']}-{tile['x']}-{tile['y']}.pbf.gz";raws.append({'path':str(p),'sha256':sha(p),'bytes':p.stat().st_size,'tile':tile})
 window.update(rawTiles=raws,fullNineTileRender=str(E/(name+'-full.png')),labelledLocalRender=str(E/(name+'-local.png')),orientation='north up; decode y_coord_down=True',renderScope='full 3x3 tile mosaic inspected; local crop supplementary, polygon holes may not be painted in local crop; raw geometry authoritative',adoptionApproved=False)
 save(E/(name+'-vector-window.json'),window)
 for suffix in ['.png','-local.png']:
  src=W/(name+suffix);dst=E/(name+('-full.png' if suffix=='.png' else suffix));shutil.copyfile(src,dst)
 geom[name]={'facilityId':row['facilityId'],'baseTile':c['baseTile'],'extent':4096,'features':facts,'windowRef':str(E/(name+'-vector-window.json'))}
 old=next(v for v in inv['rows'] if v['facilityId']==row['facilityId']);bindings.append(old)
save(E/'geometry-comparisons.json',geom);save(N/'old-bindings.json',{'schema':1,'inventoryRef':'data/national/kanto-prefecture/saitama/inventory.json','inventorySHA256':sha(Path('data/national/kanto-prefecture/saitama/inventory.json')),'rows':bindings})
# Only the community-center building is proposed for current-location review.
f=geom['samachika']['features'][1];coord=f['mechanicalCoordinateForComparisonOnly']['coordinate'];t=f['sourceTile'];raw=E/f"samachika-{t['z']}-{t['x']}-{t['y']}.pbf.gz"
location={'facilityId':a[2]['facilityId'],'coordinate':coord,'scope':'building','evidence':{'sourceUrl':'https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles','snapshotPath':str(raw),'snapshotSHA256':sha(raw),'sourceLocator':'z16/58160/25737 BldA features[19], vt_code=3101, vt_lvorder=0; north continuation z16/58160/25736 features[39]. geometry-comparisons.json#/samachika. Unapproved candidate.','checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'町公式配布案内の下八ツ林923コミュニティセンター2階を、2024年10月21日作成の公式会場図全1頁に示す町民会館と体育館の間の棟と照合。GSI数値外形の同じ中央棟を北隣図書館・東側公園/道路・南側駐車場と比較。南タイル部分の内点をXYZ格子から逆投影し小数7桁丸め前後内包確認。入口や室内点ではない。国土地理院最適化ベクトルタイルを加工。採用・製品CRS/条件の独立レビュー未承認。'}}
save(N/'locations.json',{'schema':1,'updates':[location]})
save(N/'selection.json',{'schema':1,'manifestIntegrated':False,'adoptionApproved':False,'proposedFacilityIds':[a[2]['facilityId']],'locationsPath':str(N/'locations.json'),'locationsSHA256':sha(N/'locations.json'),'requiredReview':['current community-center identity and rename continuity','source-specific CRS and reuse conditions','tile-fragment correspondence and numerical point'],'oldBindingsRef':str(N/'old-bindings.json')})
