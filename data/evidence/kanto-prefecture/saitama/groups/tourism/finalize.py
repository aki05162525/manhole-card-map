import json,sys,math,hashlib
from pathlib import Path
sys.path.insert(0,'tools/national')
from research_common import rounded_coordinate,decode_tile
from location_lifecycle import digest
from shapely.geometry import shape,Point
E=Path('data/evidence/kanto-prefecture/saitama/groups/tourism');W=Path('data/work/kanto-prefecture/saitama/groups/tourism');N=Path('data/national/kanto-prefecture/saitama/groups/tourism')
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
obs=json.load(open(N/'observations.json'))[:6]
obs[2]['candidateFeature']=1476;obs[2]['status']='candidate-pending-independent-review'
obs[2]['buildingComparison']=obs[2]['buildingComparison'].replace('カード窓口の棟名bindingは未確定。','カード窓口の棟名bindingは利用者回答により管理本館。回答は原本による独立確認/座標承認とは区別。')
obs[2]['remainingWork']='管理本館という利用者回答を受領。数値外形/製品CRSの独立レビューと採用判断。'
obs[2]['userReport']={'via':'parent /root','statement':'はい、管理本館で受け取る理解で合っています。下水道課事務室（執務室・受付）は管理本館に入居、正門・駐車場側の来庁者受付棟。数値対応先を管理本館で整理して問題ありません','scope':'棟名の利用者報告、座標の独立承認ではない','checkedAt':'2026-11-05'}
obs[3]['remainingWork']+=' 現市施設案内2-112と配布案内2-115-1の住所表記差も別判断。'
obs += [dict(facilityId='facility:kanto-north-e2961b63ac4d4c596eb9',name='吉見百穴',geometryName='yoshimi',candidateFeature=None,comparisonFeatures=[1255,1257,1258,1259,1265],distribution='町カード案内は吉見百穴8:30～17時、棟名なし。現2026-03-24施設変更告知は2026-04-01から8:45～16:50（入場16:30）。カード配布時刻を自動変更しない。',plan='町施設写真guide_hyakuana1～6全画像は洞穴/地下道/苔で受付棟なし。令和6資産一覧322頁を全テキスト検索し物理131頁の百穴管理事務所120.20㎡、北吉見327、2004年建築を確認（全頁画像未読）。町パブコメ結果ページは保存計画名のみ、配置図リンクなし。観光ロケページも取得。',buildingComparison='9タイル全域/局所描画と原数値を照合。南北道路東側の1255/1257小棟、1258屈曲棟、1259四角棟、南1265大型文化財センター候補を区別。公式写真は洞穴のみで管理事務所の道路/隣棟対応がなく、面積120.20㎡だけでは選択しない。住所324と資産327は敷地/建物違いの可能性を記録し旧値を勝手に修正しない。',status='distribution-building-binding-unresolved',remainingWork='親へ入口券売所（管理事務所）か一問送信済み。回答に加えて管理事務所の外観/配置原典と数値棟の対応が必要。'),dict(facilityId='facility:kanto-north-ed37026123185dfcdd90',name='越谷市観光協会（レイクタウン水辺のまちづくり館）',geometryName='koshigaya',candidateFeature=2226,comparisonFeatures=[2226,2544,2557,1457],distribution='現市カード配布案内は水辺のまちづくり館内観光協会、レイクタウン4-1-4、9～17時。公式観光協会現在ページも取得。',plan='市町名地番案内図全1頁目視、北上矢印/0～300m縮尺あり、水辺のまちづくり館を池南東岸の曲線歩道内側に引出線で指定。2009開館を市沿革で確認。国交省同地区事例ページと写真7/8/9全画像、写真9で独立平屋の連続勾配屋根・池側ガラス面を確認。現寸法付き平面図は検索したが未取得。',buildingComparison='9タイル全域と局所描画で池南東岸、南の東西幹線道北、東のアウトレット大型棟群西、曲線歩道沿いの独立細長い湾曲棟が一致。BldA2226と2544がタイル境界を跨ぐ同一棟のfragment。両fragmentを比較し、西側fragment2226の内部点を候補とする。全棟面積は重複bufferをunionし別記。地図中心MapFan点は取得窓選択のみ。',status='candidate-pending-independent-review',remainingWork='方位/道路/独立棟対応と製品CRS・fragment結合の独立レビュー。建築面積原典未取得、数値面積を建築面積と同一視しない。')]
obs[6]['status']='building-correspondence-unresolved'
obs[6]['userReport']={'via':'parent /root','reportedAt':'2026-11-06','statement':'入口正門の入園券売場（管理事務所窓口）、埋蔵文化財センター/売店ではない。ゲート脇券売受付カウンター。カードのみなら有料エリアへの入場不要との説明。','scope':'利用者の棟名回答。原本直接明示/位置承認とは別。無料入場一般保証として台帳へ変更しない。'}
obs[6]['plan']+=' 回答後、個別施設計画kobetusisetukeikaku.pdf全69頁テキスト検索、物理5/29/55頁の管理事務所120.20㎡・木造・2003年度とトイレ45/34.15㎡を読解。画像全頁は未読。公式サイトの案内図/配置図検索は結果なし。'
obs[6]['buildingComparison']+=' 利用者回答で管理事務所券売窓口と棟用途は解消。数値面積1255=66.46㎡、1257=149.45㎡、1258=174.24㎡、1259=206.82㎡、1265=712.28㎡を再比較。屋根面積と床面積差があり、120.20㎡に最も近い1257という理由だけでは確定できない。ゲートの位置自体を示す原典が未取得。'
obs[6]['remainingWork']='回答受領済み、同じ棟用途を再質問しない。券売棟の外観/正門配置を数値1257等と結ぶ原典が必要。人手待ちではなく建物対応未解消。'
save(N/'observations.json',obs)
geometry={}
for o in obs:
 name=o['geometryName'];c=json.load(open(W/f'{name}-combined.json'));rows=[]
 for i in o['comparisonFeatures']:
  f=c['features'][i];g=shape(f['geometry']);p=Point(6955,7200) if name=='hanno' and i==4004 else g.representative_point();assert g.contains(p)
  r=rounded_coordinate(f['geometry'],c['baseTile'],list(p.coords)[0]);tile=f['sourceTile'];raw=E/f"{name}-{tile['z']}-{tile['x']}-{tile['y']}.pbf.gz";original=decode_tile(raw.read_bytes())['BldA']['features'][f['layerFeatureIndex']];assert original['properties']==f['properties']
  scale=40075016.68557849/(2**16*4096)*math.cos(math.radians(r['coordinate']['lat']))
  rows.append({'combinedIndex':i,'feature':f,'baseTile':c['baseTile'],'representativeTileXY':list(p.coords)[0],'calculation':r,'isLocationCandidate':i==o['candidateFeature'],'areaApproxSquareMetres':g.area*scale**2,'areaMethod':'local Mercator cos(latitude)^2 corrected roof/footprint area, not surveyed building/floor area','snapshotPath':str(raw),'snapshotSHA256':sha(raw),'originalPropertiesVerified':True,'validGeometry':g.is_valid})
 geometry[name]=rows
 doc={'schema':1,'source':'GSI optimal_bvmap-v1','attribution':'国土地理院最適化ベクトルタイルをmanhole-card-mapが加工','features':rows,'crsApproved':False,'sourceConditionsRef':'data/evidence/kanto-prefecture/saitama/common-followup/source-interpretation.json'}
 if name=='koshigaya':
  from shapely.ops import unary_union
  union=unary_union([shape(c['features'][i]['geometry']) for i in [2226,2544]])
  doc['fullBuildingUnion']={'indices':[2226,2544],'valid':union.is_valid,'type':union.geom_type,'areaApproxSquareMetres':union.area*scale**2,'note':'buffer overlap dissolved; point lies strictly inside source fragment2226; no whole-building centroid substitution'}
 save(E/f'{name}-geometry.json',doc)
inv={x['facilityId']:x for x in json.load(open('data/national/kanto-prefecture/saitama/inventory.json'))['rows']};hist={x['facilityId']:x for x in json.load(open('data/evidence/kanto-prefecture/saitama/history.json'))['rows']};rr=json.load(open(E/'retrievals.json'));updates=[];bindings=[];outcomes=[]
for o in obs:
 fid=o['facilityId'];name=o['geometryName'];old=inv[fid];coordinate=None
 if o['candidateFeature'] is not None:
  g=next(x for x in geometry[name] if x['combinedIndex']==o['candidateFeature']);f=g['feature'];t=f['sourceTile'];coordinate=g['calculation']['coordinate']
  u={'facilityId':fid,'coordinate':coordinate,'scope':'building','evidence':{'sourceUrl':'https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles','snapshotPath':g['snapshotPath'],'snapshotSHA256':g['snapshotSHA256'],'sourceLocator':f"z{t['z']}/{t['x']}/{t['y']} BldA features[{f['layerFeatureIndex']}]; {name}-geometry.json; unapproved candidate",'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'公式案内/棟図/写真の道路と隣接棟をGSI数値外形と照合。日高の配布棟は利用者回答で別記。内部点をXYZ逆投影し7桁丸め後内包検証。国土地理院最適化ベクトルタイルをmanhole-card-mapが加工。同定・CRS・採用の独立承認前。'}}
  updates.append(u);bindings.append({'facilityId':fid,'identity':{'name':old['oldPlace']['name'],'address':old['oldPlace']['address']},'adoption':u,'adoptionSHA256':digest(u),'sourceVersion':'optimal_bvmap-v1 HTTP metadata retained in vector-retrievals; unapproved'})
 refs=[E/'retrievals.json',E/f'{name}-geometry.json',E/f'{name}-vector-window.json',E/f'{name}-vector-retrievals.json']
 outcomes.append({**o,'checkedAt':'2026-11-05','performedMethods':['現配布公式本文取得読解','既往全履歴/人手回答継承','公式原典の本文/画像の明記範囲読解','GSI9タイルの道路/隣接棟/水域と数値建物外形比較','原数値properties/hash/面積/代表点丸め内包検証'],'sources':[r for r in rr if r.get('facilityId')==fid],'history':hist[fid],'oldPlace':old['oldPlace'],'oldRelations':old['oldRelations'],'oldPlaceSHA256':digest(old['oldPlace']),'oldRelationsSHA256':digest(old['oldRelations']),'evidenceReferences':[{'path':str(p),'sha256':sha(p)} for p in refs],'buildingComparisonPerformed':True,'candidateCoordinate':coordinate,'stopReason':o['remainingWork'],'nextAction':o['remainingWork'],'adoptionApproved':False,'manifestReflected':False,'operation':'現案内あり。休止/終了への変更案なし。','stock':'原本記載時点の情報。ライブ在庫未確認、位置採用とは別判断。'})
save(N/'locations.json',{'schema':1,'updates':updates});save(N/'location-lifecycle.json',{'schema':1,'bindings':bindings,'events':[],'groups':[]});save(N/'selection-proposal.json',{'schema':1,'adoptionApproved':False,'manifestReflected':False,'proposedFacilityIds':[x['facilityId'] for x in updates]});save(N/'outcomes.json',{'schema':1,'asOf':'2026-11-05','rows':outcomes,'docCodeDiscrepancies':[],'timingScope':'timing.json actual research intervals, compaction/coordination may intervene; shared synthesis/validation not retroactively apportioned'})
print('8 investigated outcomes;',len(updates),'unapproved proposals')
