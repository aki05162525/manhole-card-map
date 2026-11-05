import sys,json,hashlib,shutil,math,datetime
from pathlib import Path
from shapely.geometry import shape,mapping,Point
from shapely.ops import unary_union
sys.path.insert(0,'tools/national');from research_common import decode_tile,rounded_coordinate
from location_lifecycle import digest
sys.path.insert(0,'data/work/kanto-ibaraki/round2/south');from helper import timing
D=Path('data/work/kanto-ibaraki/round2/south');E=Path('data/evidence/kanto-prefecture/ibaraki/round2/south');N=Path('data/national/kanto-prefecture/ibaraki/round2/south');N.mkdir(parents=True,exist_ok=True)
def save(p,j):p.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
ledger=json.loads(Path('/tmp/ibaraki-ledger.json').read_text());hist=json.loads(Path('data/evidence/kanto-prefecture/ibaraki/history.json').read_text())
specs=[('bivi','02882996672a826c585c',58274,25716,114),('ushiku','1fd6ee704dfe58bb5411',58281,25739,275),('ryugasaki','fb8539f44aa2bc8487c0',58279,25750,393),('antlers','a0cee7df87e79f814924',58377,25745,2)]
updates=[];bindings=[];old=[];hs=[]
for name,suffix,x,y,idx in specs:
 fid='facility:kanto-north-'+suffix;timing(fid,'start-numeric-validation')
 p=next(p for p in ledger['places'] if p['id']==fid);assert p.get('coordinate') is None
 old.append({'facilityId':fid,'place':p,'relations':[r for r in ledger['relations'] if fid in json.dumps(r)]})
 history=next(f for f in hist['facilities'] if f['facilityId']==fid)
 for ref in history['resolvedHistory']:
  q=Path(ref['ref'].split('#')[0]);assert h(q)==ref['sha256']
 for ref in history['verifiedOriginals']:assert h(Path(ref['snapshotPath']))==ref['snapshotSHA256']
 hs.append(history)
 c=json.loads((D/name/'map-combined.json').read_text());tile={'z':16,'x':x,'y':y};f=next(f for f in c['features'] if f['layer']=='BldA' and f['sourceTile']==tile and f['originalIndex']==idx)
 geom=shape(f['geometry']);parts=[f];union=geom
 if name=='antlers':
  other=next(f for f in c['features'] if f['layer']=='BldA' and f['sourceTile']=={'z':16,'x':58376,'y':25745} and f['originalIndex']==72)
  parts.append(other);union=unary_union([geom,shape(other['geometry'])]);point=Point(4360,4990);method='south wing internal representative point; avoid courtyard and detached annex; full footprint reconstructed with overlapping neighboring tile fragment'
 else:point=geom.centroid;method='polygon area centroid'
 assert geom.is_valid and union.is_valid and geom.contains(point) and union.contains(point)
 base=c['baseTile'];r=rounded_coordinate(mapping(geom),base,list(point.coords)[0]);assert r['mechanicalChecksPassed'];rp=Point(r['roundedTileXY']);assert geom.contains(rp)
 scale=40075016.68557849*math.cos(math.radians(r['coordinate']['lat']))/(65536*4096)
 w=json.loads((E/name/'vector-window.json').read_text())
 for t in w['tiles']:
  raw=Path(t['path']);assert h(raw)==t['sha256'];dest=E/name/raw.name;shutil.copyfile(raw,dest);t['retainedPath']=str(dest)
 save(E/name/'vector-window.json',w)
 for fn in ['map-detail.png','map-window.png']:shutil.copyfile(D/name/fn,E/name/fn)
 selected=E/name/f'16-{x}-{y}.pbf.gz';rawfeature=decode_tile(selected.read_bytes())['BldA']['features'][idx]
 # prove selected combined geometry only differs from raw by known tile offset
 from shapely.affinity import translate
 assert geom.equals(translate(shape(rawfeature['geometry']),xoff=(x-base['x'])*4096,yoff=(y-base['y'])*4096))
 geo={'facilityId':fid,'selectedTile':tile,'featureIndex':idx,'baseTile':base,'extent':4096,'rawFeature':rawfeature,'combinedGeometry':mapping(geom),'fullBuildingGeometry':mapping(union),'parts':[{'tile':f['sourceTile'],'featureIndex':f['originalIndex'],'geometry':f['geometry']} for f in parts],'pointXY':list(point.coords)[0],'method':method,'selectedAreaTileUnits':geom.area,'fullAreaTileUnits':union.area,'approximateFullAreaM2':union.area*scale**2,'approximateRoundedBoundaryClearanceM':union.boundary.distance(rp)*scale,'bounds':union.bounds,'tileBoundaryTouched':f['tileBoundaryTouched'],'outerWindowBoundaryTouched':f['outerBoundaryTouched'],'tileClippingAssessment':('two overlapping clipped fragments explicitly unioned; neither fragment alone claims complete footprint' if name=='antlers' else 'complete selected polygon within tile, all neighboring tiles retrieved and drawn'),'rounding':r,'measurementPrecision':'7 decimal storage is not survey accuracy; approximate area uses local Web Mercator latitude scale','independentReview':'pending; no adoption approval'}
 save(E/name/'geometry.json',geo)
 ev={'sourceUrl':w['source'],'snapshotPath':str(selected),'snapshotSHA256':h(selected),'sourceLocator':f'z16/{x}/{y} BldA feature[{idx}]; {E/name}/geometry.json; GSI optimal 2026-07-01版。国土地理院最適化ベクトルタイルを加工。','checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'現配布先と公式棟図を9タイル道路・隣棟配置へ照合。建物内部代表点を逆投影し小数7桁丸め後も内包。入口・室内測量ではない。製品固有CRSは既存source-conditions.jsonの根拠と限界を継承。独立レビュー未実施・採用未承認。'}
 u={'facilityId':fid,'coordinate':r['coordinate'],'scope':'building','evidence':ev};updates.append(u);bindings.append({'facilityId':fid,'identity':{'name':p['name'],'address':p['address']},'adoption':u,'adoptionSHA256':digest(u),'sourceVersion':'GSI optimal PMTiles 2026-07-01; proposed only, independent review pending'})
 timing(fid,'stop-numeric-validation');print(name,r['coordinate'],'area m2',round(union.area*scale**2,1),'clearance m',round(union.boundary.distance(rp)*scale,2))
save(N/'locations-proposed.json',{'schema':1,'updates':updates});save(N/'location-lifecycle-proposed.json',{'schema':1,'bindings':bindings,'events':[],'groups':[]});save(N/'selection-proposed.json',{'schema':1,'selectedFacilityIds':[u['facilityId'] for u in updates],'manifestApplied':False,'adoptionApproved':False,'independentReview':'pending'})
save(E/'old-values.json',{'ledgerPath':'/tmp/ibaraki-ledger.json','ledgerSHA256':h(Path('/tmp/ibaraki-ledger.json')),'placesAndRelations':old});save(E/'inherited-history.json',{'schema':1,'facilities':hs,'humanQueueMatchedIds':[],'humanQuestion':'none; no prior answers repeated'})
