import json,math,hashlib,copy
from pathlib import Path
from shapely.geometry import shape,Point
R=Path('/home/akihiro/personal/manhole-card-map');O=Path('/tmp/issue60-round2-other');O.mkdir(exist_ok=True)
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def canon(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
prior=read('/tmp/issue60-human-other/results.json');confirmation='data/evidence/issue60/human-answers-20261106/direct-map-confirmation.json';recv='data/evidence/issue60/human-answers-20261106/receipt.json';raw='data/evidence/issue60/human-answers-20261106/answers.md'
# Select new midori footprint explicitly; don't reuse the former unionGeometry 3182.
mp='data/evidence/kanto-prefecture/gunma/east/midori-geometry.json';md=read(R/mp);ft=next(f for f in md['comparedFeatures'] if f['combinedIndex']==3219);g=shape(ft['geometry']);pt=g.representative_point();b=md['baseTile'];N=2**b['z'];ext=md['extent']
def inv(x,y):return {'lat':math.degrees(math.atan(math.sinh(math.pi*(1-2*(b['y']+y/ext)/N)))),'lng':(b['x']+x/ext)/N*360-180}
coord={k:round(v,7) for k,v in inv(pt.x,pt.y).items()};lat,lng=coord['lat'],coord['lng'];xy=Point(((lng+180)/360*N-b['x'])*ext,((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*N-b['y'])*ext);scale=2*math.pi*6378137/N/ext*math.cos(math.radians(lat));assert g.contains(xy)
calc={'schema':1,'sourcePath':mp,'sourceSHA256':sha(R/mp),'selector':'comparedFeatures[combinedIndex=3219]','sourceFeatureIndex':ft['sourceFeatureIndex'],'sourceTile':ft['sourceTile'],'baseTile':b,'extent':ext,'geometry':ft['geometry'],'method':'representative_point in stored tile grid; XYZ inverse; round7; no datum shift','coordinate':coord,'roundedWithin':True,'boundaryMarginMeters':xy.distance(g.boundary)*scale,'reportedPointWithin':True,'oldRejectedFeature':3182,'adoptionApproved':False,'limits':['saved geometry reused; raw decode inherited from prior review','reported point supports this feature but is not an independent survey','municipal/operator original supports facility and street block, not a labelled footprint']}
(O/'midori-calculation.json').write_text(json.dumps(calc,ensure_ascii=False,indent=2)+'\n')
updates=[];outcomes=[];assessments={};fixed={raw:sha(R/raw),confirmation:sha(R/confirmation),recv:sha(R/recv),'data/evidence/issue60/human-answers-20261106/tamamura-followup.json':sha(R/'data/evidence/issue60/human-answers-20261106/tamamura-followup.json')}
for old in prior['rows']:
 n=old['number'];fid=old['facilityId'];county=old['county'];ap,pointer=old['assessmentRef'].split('#');prev=read(R/ap)['outcomes'][int(pointer.split('/')[-1])];ev=[raw,confirmation,old['assessmentRef'],*prev['positionSuitability']['evidence']];finding=old['finding'];recommend='hold';candidate=None;limits=['人の地図指定は確認済み。現地測量や独立したGoogle位置精度保証ではない。','既存の配布状態・在庫・関係・原調査は変更しない。']
 if n in (15,17,47):
  recommend='propose';src=prev['sourceLocationPath'];candidate=copy.deepcopy(next(x for x in read(R/src)['updates'] if x['facilityId']==fid));fixed[src]=sha(R/src)
  if n==15:
   finding='相島新田1への最終訂正と旧漉場受付の直接指定を受領。新点35.854828,140.121201は既存候補から12.52m、敷地内の建物間で115外形から8.81mであり受付そのものの測量点として用いない。新回答の棟名を既往の公式方位図/旧漉場事務所用途/2026訪問記録と結合し、同定済み115の既存内部代表点で案内できると提案。中峠と旧2点は撤回履歴。'
   limits+=['新点は115内部ではなく県観光案内の既存探索点と同値。直接指定という報告をそのまま精密受付位置へ読み替えない。','棟名と受付の結合には利用者報告・二次訪問記録を併用。市本文が現在のカード受付棟を明記したとはしない。']
  elif n==17:
   finding='直接指定点と532既存点は0.86mで一致。現配布本文の庁舎3階、完成写真・敷地の道路位相、北側集合住宅530/531・502との区別を継承。面積差14.6%は屋根/建築面積・計画時点の差が未説明だが、別棟を含む具体兆候はなく、対象庁舎の内部代表点として案内可能と提案。人の直接指定を独立精度測量とは扱わない。'
   limits+=['設計面積1405㎡と地図外形1609.75㎡の差14.6%は未解決。正式平面図未取得を明記。','回答の地上3階に対し原設計/完成写真の5階という記録差がある。窓口3階と建物階数は区別。']
  else:
   finding='直接指定点は旧3182の約29m南にある3219内部。公式募集地図の交差点南街区という既往反証、現店舗住所・配布本文・利用者の主店舗棟指定を併用し、3219を新たな棟候補とする。旧3182は不採用。自販機設置予定位置そのものを建物点にせず、3219外形の内部代表点を新計算した。'
   candidate['coordinate']=coord;candidate['evidence'].update(snapshotPath=mp,snapshotSHA256=sha(R/mp),sourceLocator='midori-geometry.json comparedFeatures[combinedIndex=3219], sourceTile16/58122/25636 BldA sourceFeatureIndex310; 旧unionGeometry3182は使用しない。国土地理院最適化ベクトルタイルを加工。',checkedAt='2026-11-06',verificationMethod='未承認追補候補。2026-11-06利用者による地図直接指定と現店舗報告を、既往公式募集要項の南街区・現配布原文・保存比較外形3219に結合。旧3182は棄却。saved geometryのrepresentative_point、XYZ逆投影、小数7桁丸め後内包を今回限定計算。datum名を一律保留条件にしない。絶対精度保証なし、独立採用レビュー待ち。')
   ev+=['data/evidence/issue76/gunma/inherited-midori-review-response.md',mp]
   limits+=['旧独立レビューは3182を保留としており、3219を承認したものではない。新棟同定の独立採用レビューが必要。','運営者noteの取得写真2枚はカードと顔出しパネル。3219屋根全周の一次写真照合完了とは扱わない。','地図クリックは入口等からのずれを含み得るが同外形内部で、隣棟との選択に用いる補完情報。']
  updates.append(candidate)
 else:
  finding+=' 地図上でクリックしたという方法回答は受領済みで、出所未回答を今後の保留理由にはしない。'
  if n in [11,12,16,19,44,45]:finding+='具体的な位置/隣棟との不一致が残るため、方法回答だけでは解除しない。'
  if n==13:finding+='高架下という対象範囲と点の整合は追加の局所配置比較が残る。新Polygon取得そのものを要求しない。'
  if n==14:finding+='公式駐車場PDF1頁を追加画像読解し、本館の反対側で南北2区画と道路を隔てる配置を確認。点が南区画であることの数値重畳は未完了で、対象外形欠如だけを理由にはしない。'
  if n in [18,20]:finding+='新南庁舎を含む公式計画と地図指定点の位置合わせは未完了。旧外形の外という理由だけでは却下しないが、独立レビューへ渡す建物対応検証はこの追補で完了していない。'
  if n==21:finding+='旧596-19を指定したという報告は受領したが、同住所の旧窓口の歴史的棟との対応は未解消。'
  if n==41:finding+='地上案内所と高架駅構造の点位置を公式写真/配置へ結ぶ局所比較は未完了。'
  if n==42:finding+='校舎南面の東寄りの小屋根と今回点の配置差を解消できていない。'
  if n==43:finding+='直接点が期待街区に近いことは支持材料だが、約2.3mの探索中心一致を独立した建物点検証とみなさない。今回新棟の位置合わせは未完了。'
  if n==46:finding='追補で本体点36.299371,139.101291を受領したが、利用者も本体を対象として明記。現在仮設の位置は動線からの推論に留まり、仮設未確定の保留を維持。';ev.append('data/evidence/issue60/human-answers-20261106/tamamura-followup.json')
 row={'number':n,'facilityId':fid,'county':county,'name':old['name'],'recommendation':recommend,'positionSuitability':{'status':'acceptable' if recommend=='propose' else 'held','buildingAssessment':finding,'uncertaintyBasis':'共通Issue76の製品評価・棟ごとの既存原典比較を継承。利用者の地図クリックによる建物指定を補完し、Google報告座標自体を自動入力しない。既存GSI点を優先し、新みどり点のみ保存外形3219から算出。格子・境界余裕・丸めを絶対精度としない。','evidence':list(dict.fromkeys(ev))},'candidate':candidate,'limitations':limits,'supersedesAssessmentRef':old['assessmentRef'],'supersedesAssessmentSHA256':sha(R/ap),'adoptionApproved':False}
 outcomes.append(row)
 for ref in ev:
  pp=ref.split('#')[0]
  if (R/pp).is_file():fixed[pp]=sha(R/pp)
(O/'locations-proposed.json').write_text(json.dumps({'schema':1,'status':'unapproved-human-followup-proposals','updates':updates},ensure_ascii=False,indent=2)+'\n')
assessment={'schema':1,'asOf':'2026-11-05','assessmentDate':'2026-11-06','scopeNumbers':[r['number'] for r in outcomes],'commonSHA256':'4624a179b682670e776eae22c94f45f6820a87825e7e41b2def49daaf159a7b6','summary':{'total':18,'propose':len(updates),'hold':18-len(updates)},'outcomes':outcomes,'adoptionApproved':False}
(O/'assessment.json').write_text(json.dumps(assessment,ensure_ascii=False,indent=2)+'\n');(O/'input-hashes.json').write_text(json.dumps({'files':fixed,'assessmentOutcomesSHA256':canon(outcomes),'candidateRowsSHA256':{r['facilityId']:canon(r) for r in updates}},ensure_ascii=False,indent=2)+'\n')
(O/'report.md').write_text('# 方法確認後の限定再評価\n\n全18件：提案3（旧井上家15・柏17・みどり47）、保留15。独立承認ではない。旧井上家・柏は既存GSI座標を維持。みどりは旧3182を棄却し3219から内部点を算出。\n\n地図クリックの方法回答を全件へ反映し、「取得方法不明」を保留理由から除いた。実位置矛盾は残す。新外形必須・室内点必須という条件は置かない。残る新棟/高架/屋外位置は、今回の局所位置合わせ未完了を資料不足や原典不存在へ言い換えない。\n\n共通評価・既存棟同定と原計算を継承。今回の追加は人の方法/訂正の照合とみどり3219の限定座標・内包計算。全suite・全タイルdecode・現地確認なし。repo編集なし。\n\n新規コード不一致なし。柏の報告3階建と既往5階、旧井上家の撤回所在地/座標、ORIGAMI東隣と公式南隣、旧みどり3182と新3219の差をassessmentで明記。\n')
print(json.dumps(assessment['summary']));print('midori',coord,calc['boundaryMarginMeters'])
