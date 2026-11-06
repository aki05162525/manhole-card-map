import json,hashlib,math
from pathlib import Path
from shapely.geometry import Point,shape
root=Path.cwd();out=Path('/tmp/issue60-round2-saitama');E=root/'data/evidence/kanto-prefecture/saitama/groups';old=Path('/home/akihiro/.t3/worktrees/manhole-card-map/t3-60b8ee0c/data/work/kanto-prefecture/saitama/groups')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def ref(p,pointer=''):return {'path':str(p),'sha256':sha(p),'pointer':pointer}
def project(c,t):return Point(((c['lng']+180)/360*2**t['z']-t['x'])*4096,((1-math.asinh(math.tan(math.radians(c['lat'])))/math.pi)/2*2**t['z']-t['y'])*4096)
prior=read('/tmp/issue60-human-saitama/results.json');full=read(root/'data/national/kanto-prefecture/saitama/full-outcomes.json')['rows'];byid={r['facilityId']:r for r in full};civic=read(E/'civic/geometry-comparisons.json')
confirmation=root/'data/evidence/issue60/human-answers-20261106/direct-map-confirmation.json';answers=root/'data/evidence/issue60/human-answers-20261106/answers.md'
proposed={26:('civic','kazo-treatment',3406),28:('west','iruma',2817),31:('tourism','kumagaya',5026),33:('civic','ageo',4397),34:('civic','miyashiro',2047),37:('west','iruma',2817)}
reasons={26:'公式施設写真と既存4棟比較を継承。利用者が地図上で管理棟を直接指定した位置は3406内で、処理大棟3408・北小棟3399と区別できる。独立一次資料だけによる棟名証明ではなく、直接指定報告を併用する。',28:'約300m西の利用者当初点は棄却する。既存公式案内が守衛室を本庁舎AB棟地下と特定し、37の直接指定がB棟を含む連接外形2817に対応するため、同じAB建物の代表点を共有する案。守衛室入口・室内位置の一致は要求しない。',31:'既存公式構内図の本館西側コンコース北端と、利用者の北側駅舎内ブースを直接指定した点が北側外形5026内で一致。南側の細長いホーム屋根5027を選ばず、北側駅舎の保存内部点を使用する。',33:'利用者が指定した点はL形4397/6977外周上相当だが、L形全体が上下水道庁舎という棟確認で従来の北翼/南翼の不明点を補完。丸め境界点の直接採用は避け、4397の保存内部点を建物代表点として使う。',34:'利用者の事務所棟直接指定は2047内で、北西の細長い2041と分離できる。旧公式施設写真・敷地案内を継承し、南側事務所と北側配水施設の対応を利用者報告で補完。',37:'既存公式階図がB棟2F上下水道経営課を指定し、利用者がB棟として直接指定した点は連接AB外形2817内。外形のA/B行政的区画を独立polygonとして要求せず、対応する建物内の保存代表点を使用する。'}
rows=[];updates=[];measurements=[]
for r in prior:
 n=r['number'];f=byid[r['facilityId']];evidence=[ref(answers,f'number {n}'),ref(confirmation),ref(root/'data/national/kanto-prefecture/saitama/full-outcomes.json',f'/rows/{full.index(f)}')]
 row={'number':n,'facilityId':r['facilityId'],'name':r['name'],'recommendation':'hold','originalUserReportedCoordinate':r['userReportedCoordinate'],'userReportedAt':'2026-11-06','sourceAsOf':'2026-11-05','directMapClickConfirmed':True,'positionSuitability':{'status':'held','evidence':evidence,'uncertaintyBasis':r['assessment'],'buildingAssessment':r['priorObservation']},'nextAction':r['nextAction'],'adoptionApproved':False,'limits':['地図直接指定の方法確認はすべての座標の正しさ・測量精度を保証しない。','現地確認・在庫/配布継続確認なし。既存配布関係・状態は変更しない。']}
 if n in proposed:
  group,name,idx=proposed[n]
  if group=='civic':
   p=E/'civic/geometry-comparisons.json';d=civic[name];g=next(x for x in d['features'] if x['combinedFeatureIndex']==idx);geom=g['geometry'];t=d['baseTile'];c=g['mechanicalCoordinateForComparisonOnly']['coordinate'];source=g;ptr=f'/{name}/features/{d["features"].index(g)}'
  else:
   p=E/f'{group}/{name}-geometry.json';d=read(p);g=next(x for x in d['features'] if x['combinedIndex']==idx);geom=g['feature']['geometry'];t=g['baseTile'];c=g['calculation']['coordinate'];source=g['feature'];ptr=f'/features/{d["features"].index(g)}'
  shp=shape(geom);q=project(c,t);scale=2*math.pi*6378137*math.cos(math.radians(c['lat']))/(2**t['z']*4096);assert shp.contains(q)
  st=source['sourceTile']; raw=E/f'{group}/{name}-{st["z"]}-{st["x"]}-{st["y"]}.pbf.gz';assert raw.exists(),raw
  ev={'sourceUrl':'https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles','snapshotPath':str(raw.relative_to(root)),'snapshotSHA256':sha(raw),'sourceLocator':f'z{st["z"]}/{st["x"]}/{st["y"]} BldA layerFeatureIndex={source["layerFeatureIndex"]}; combined {idx}; {str(p.relative_to(root))}#{ptr}','checkedAt':'2026-11-05','actorType':'ai','verificationMethod':f'国土地理院最適化ベクトルタイルを加工した保存済み内部代表点を再利用。利用者の2026-11-06建物直接指定と既存公式図/写真の棟対応を併用。案内適性の評価は /tmp/issue60-round2-saitama/assessment.json の番号{n}。本採用・独立承認前の提案。'}
  u={'facilityId':r['facilityId'],'coordinate':c,'scope':'building','evidence':ev};updates.append(u)
  row.update(recommendation='propose',candidateCoordinate=c,candidateCoordinateOrigin='existing GSI-derived mechanical interior representative point; user coordinate used for building identification only',selectedFeature=idx,nextAction='固定候補・棟対応と不確かさを独立採用レビューへ。')
  row['positionSuitability'].update(status='acceptable',uncertaintyBasis='共通評価の原典編集/格子/参照系/現況の不確かさを継承し、境界余裕を絶対誤差上限としない。直接指定された建物と既存公式配置が整合し、別棟や道路反対側への誤案内を示す具体的不整合が候補点にない。',buildingAssessment=reasons[n]);row['positionSuitability']['evidence'] += [ref(p,ptr),ref(raw)]
  row['limits'].append('利用者報告を一次資料の独立同定や測量へ読み替えない。')
  if n==28:row['limits'].append('番号28の誤った報告座標は採用せず、公式AB棟指定と番号37に基づく同じ建物の代表点を用いる。守衛室入口そのものの測量ではない。')
  measurements.append({'number':n,'facilityId':r['facilityId'],'coordinate':c,'featureIndex':idx,'geometryRef':ref(p,ptr),'rawTileRef':ref(raw),'strictlyWithin':True,'boundaryMarginM':round(shp.boundary.distance(q)*scale,3),'method':'stored GSI geometry, tile forward projection, local cos(latitude) scale; approximate geometric distance only','notAbsoluteAccuracyBound':True})
 if n==40:
  c={'lat':36.017642,'lng':139.677572};d=civic['shiraoka'];t=d['baseTile'];q=project(c,t);scale=2*math.pi*6378137*math.cos(math.radians(c['lat']))/(2**t['z']*4096)
  distances=[{'featureIndex':g['combinedFeatureIndex'],'distanceToPolygonM':round(shape(g['geometry']).distance(q)*scale,3),'inside':shape(g['geometry']).contains(q)} for g in d['features']]
  ev={'sourceUrl':'https://www.city.shiraoka.lg.jp/material/images/group/1/kasetu_atm.jpg','snapshotPath':'/tmp/issue60-shiraoka-followup/layout.jpg','snapshotSHA256':sha('/tmp/issue60-shiraoka-followup/layout.jpg'),'sourceLocator':'水色の仮設本庁舎。座標値の出典は利用者の2026-11-06地図直接指定であり、この図から測量した値ではない。','checkedAt':'2026-11-06','actorType':'ai','verificationMethod':'利用者指定36.017642,139.677572を公式配置図のはぴす東/旧本庁舎南東/味彩西と照合。市本文で商工観光課の入居を継承確認。Google由来地図指定値をGSI計算点に読み替えない。独立承認前の提案。'}
  updates.append({'facilityId':r['facilityId'],'coordinate':c,'scope':'building','evidence':ev})
  row.update(recommendation='propose',candidateCoordinate=c,candidateCoordinateOrigin='user reported direct map click; original map provider not independently identified/terms not assessed',supersededUserCoordinates=[r['userReportedCoordinate'],{'lat':36.01830,'lng':139.67578}],nextAction='独立採用レビューで案内適性と座標の利用条件を確認。追補原本のrepo保存と参照の正規化は親統合時。')
  row['positionSuitability'].update(status='acceptable',buildingAssessment='新点は旧本庁舎2501の南東・はぴす4563の東・味彩4581の西で、公式図の水色仮設本庁舎と対応する。従前の2つの西側点は撤回され、棟同定済みの新仮設棟へ地理位置を接続できた。',uncertaintyBasis='公式図は模式図で量的測量に使わない。直接指定点と周囲3棟の地理的順序が一致し、旧庁舎・はぴす・味彩のいずれにも内包しない。新棟の数値外形は未収録で内包/境界距離は検証不能。根拠に基づく建物案内として提案し絶対誤差ゼロとは扱わない。')
  row['positionSuitability']['evidence'] += [ref('/tmp/issue60-shiraoka-followup/layout.jpg'),ref('/tmp/issue60-shiraoka-followup/office.html'),ref('/tmp/issue60-shiraoka-followup/retrievals.json'),ref(E/'civic/geometry-comparisons.json','/shiraoka')]
  row['limits'] += ['更新Polygonを必須としないが、外周内包や入口精度は未確認。','提示元がGoogle Maps等の場合の座標利用条件は未評価。公式図の引用/原本再配布条件とは別。利用者提供という理由だけでCC BY等を付与しない。']
  measurements.append({'number':40,'coordinate':c,'comparisonFeatures':distances,'buildingContainment':'not applicable; new footprint absent','relativePositions':'southeast of old hall, east of Hapisu, west of Misai','notAbsoluteAccuracyBound':True})
 rows.append(row)
assessment={'schema':1,'county':'saitama','scope':'human-answer numbers22-40','summary':{'assessed':19,'propose':sum(x['recommendation']=='propose' for x in rows),'hold':sum(x['recommendation']=='hold' for x in rows),'approved':0},'outcomes':rows,'newDocCodeDiscrepancies':[],'reusedVerification':'Issue76 original building/geometry reviews and previous round distance calculations; no full suite or raw tile re-decode'}
(out/'assessment.json').write_text(json.dumps(assessment,ensure_ascii=False,indent=2)+'\n');(out/'candidate-updates.json').write_text(json.dumps({'schema':1,'updates':updates},ensure_ascii=False,indent=2)+'\n');(out/'measurements.json').write_text(json.dumps(measurements,ensure_ascii=False,indent=2)+'\n')
print(assessment['summary']);print([(m['number'],m.get('boundaryMarginM',m.get('comparisonFeatures'))) for m in measurements])
