import json,pathlib,hashlib
D=pathlib.Path('data/evidence/issue7/review-tohoku')
def read(p):return json.loads(pathlib.Path(p).read_text())
def write(p,x):pathlib.Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
p=read('data/national/issue7/tohoku.json');a={r['facilityId']:r for r in read('data/evidence/issue7/tohoku/audit.json')};v=read(D/'validation.json');n={r['facilityId']:r for r in v['numericChecks']}
reasons=[
'市施設案内1371はウイングプラザ2階とプラザホール1階を同一コミュニティプラザの施設として記載。配布案内3988の2階窓口と、P05プラザホールの同住所を合理的に接続できる。階の違いは建物代表点の不適合ではない。',
'町配布案内1265は休日の役場守衛室を明記。庁舎所在地の新南19とP05大河原町役場が一致。',
'配布案内12422の国際村受付・大山1-1、施設案内、公式リンク先1階見取り図を照合。受付と国際村ホールは接続した本館にあり、図右下の独立プリマスハウスとは区別できる。花淵浜/花渕浜は異体表記として同定可能。',
'配布案内8717の国際村受付・大山1-1を別カードのIDとして確認。1階見取り図上のホールと受付は同一本館。前項と同じ建物座標の共有は妥当で、IDや配布関係は統合しない。',
'配布案内4209が町民交流館ペア・パル利府総合案内、新並松4を明記。P05の交流館専用Featureを使用し、同住所の役場総称点との混同を回避している。',
'市配布案内5485は小高区役所市民総合サービス課。施設案内4086は本町二丁目78を明記。問い合わせ先の南分庁舎や駅前の蓋座標を採用していない。',
'市施設案内3029は総合交流センター（夢アリーナたかた）・B&G海洋センターの名称と太田5を掲載。P05総合交流センターを施設名で特定できる。2018年開館資料は補助であり現況同定は現施設案内による。',
'町配布案内002568は役場日直窓口を地下1階、南側駐車場から入館と明記。中居野33の役場建物を採用でき、地下の独立座標は不要。',
'町配布案内3909は三戸町役場建設課、在府小路町43を明記。P05と名称住所が一致。別配布先の道の駅さんのへとは別。',
'上下水道事業の配布案内はtette・中町4-1、運営者利用案内も同住所。P05市民交流センターの中町4-1外は同施設。旧中央公民館や風流のはじめ館の点ではない。',
'町配布案内1265の平日役場上下水道課と新南19のP05役場を対応付けた。同庁舎の休日守衛室と同座標を共有できる。',
'市配布案内1423はYOMUNOSU・中央三丁目58。運営者aboutは情報交流センターYOMUNOSUを観光案内所と図書館の複合施設と明記。P05情報交流センターＹＯＭＵＮＯＳＵと同一。',
'町施設案内1832は南部町立南部公民館・沖田面字沖中51-2、配布案内2052も南部公民館・51番地2。P05は同一自治体コード02445、同施設名、同字で512。名称と所在地の一致からハイフン欠落の表記差と判断する（推論）。原属性512を51-2へ書き換えず保存する。異なる座標や旧所在地を示す根拠はこの候補資料にない。',
'町配布案内002568は役場上下水道課1階、正面玄関から最奥の窓口を指定。P05棚倉町役場・中居野33と一致する。',
'市配布案内および観光協会spot/2861はマリカ東館1階FOODEVER。P05青少年育成センターの原住所が末広町3-1マリカ東館2Fまで明示。同一建物内の階違いとして採用できる。',
'町配布案内1361は城南100、役場2階上下水道課を明記。庁舎案内とも整合し、P05猪苗代町役場の代表点が使える。',
'配布案内7745は会津坂下町役場の正面玄関前ホール総合案内窓口・建設課上下水道班を明記。市中三番甲3662の同役場に対応。既存IDの配布関係は変更しない。',
'町配布案内1361は城南100、役場北東1階職員通用口右の宿日直室を明記。P05役場建物と対応し、独立した入口座標を要求しない。',
'青森市施設HTML1005717内の単一の数値qは緯度40.89153648001732、経度140.86136621184502。ページの施設名、螢谷341-19、1〜5階の本館案内と配布案内1001920が対応する。Googleサービス応答の抽出ではない。測地系はHTMLで明示されず、地図目的地の地理座標として解釈する。入口・測量精度は主張しない。',
'町配布案内1110はまほろばホール受付。町関連施設1090が公民館（まほろばホール）・吉岡南二丁目4番地の14と明記し、運営者アクセスも一致。P05大和町公民館という異称を同建物に結び付けられる。',
'配布案内7745の正面玄関前ホール総合案内窓口は会津坂下町役場内。既存上下水道班IDとの重複座標は許容し、関係整理をこのレビューで行わない。',
'本宮市配布表mhcardは万世212の市役所、休日警備員室、西側ATM裏入口を示す。今回の原数値はP05本宮市役所の独立Featureであり、旧Google応答由来候補に依存しない。',
'村配布案内1036は総合庁舎1階上下水道お客様センター、熊倉字折口原40と明記。P05西郷村役場の名称住所と合理的に対応。毎月第3火曜日という配布条件は変更しない。',
'村配布案内1036は総合庁舎1階警備室、熊倉字折口原40と明記。P05役場建物に対応。年末年始の配布条件や関係は変更しない。',
'町配布案内4209のペア・パル利府総合案内、新並松4を確認。P05利府町民交流館の専用Featureを使い、役場一般点の流用ではない。'
]
assert len(reasons)==len(p['updates'])==25
rows=[]
for u,reason in zip(p['updates'],reasons):
 i=u['facilityId'];r=a[i]
 refs=[]
 for s in r['attempts']:
  if s.get('snapshotPath'):refs.append({k:s[k] for k in ['sourceUrl','snapshotPath','snapshotSHA256']})
 rows.append({'facilityId':i,'name':r['name'],'status':'accepted','reason':reason,'identityAddress':r['address'],'coordinate':u['coordinate'],'scope':'building','numericValidation':n[i],'originalReferences':refs,'goEvidence':'pass (actual Evidence/validateEvidence extraction; checkedAt 2026-11-05; timestamp negative control rejected)','sourceConditions':'p05-2022-individual-cc-by-4.0' if 'rawFeature' in r else 'aomori-single-coordinate-fact','requiredCorrections':[]})
for u in p['unresolved']:
 rows.append({'facilityId':u['facilityId'],'name':a[u['facilityId']]['name'],'status':'deferred','reason':u['reason'],'reviewDepth':'submitted unresolved reason and scope reviewed; no independent exhaustive source investigation or new coordinate adoption','requiredCorrections':[]})
policyrefs=read('data/evidence/issue5/north/policy.json')['policyEvidence'][:3]
for r in policyrefs:assert hashlib.sha256(pathlib.Path(r['snapshotPath']).read_bytes()).hexdigest()==r['snapshotSHA256']
conditions={'p05-2022-individual-cc-by-4.0':{'individualCatalog':policyrefs[0],'individualDesignation':'オープンデータ（CC_BY_4.0）','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','currentGeneralTerms':'https://nlftp.mlit.go.jp/ksj/other/agreement.html','currentTermsSnapshot':'data/evidence/issue7/tohoku/originals/31abe03f6eeb7d50fd3c48461b12d70db73f88c708aad2f428a595ab3ce4b12f.html','interpretation':'2026-03-23施行の一般PDL1.0は個別権利表示がない場合の条件。旧2022個別カタログのCC BY 4.0指定を消さず併記する。現行v3カタログへの接続だけを理由に旧個別指定を上書きしない。','attribution':'国土交通省 国土数値情報「市町村役場等及び公的集会施設データ」2022年（P05-22）。CC BY 4.0（個別2022カタログ）。対象抽出・軸順をキーへ転記して加工。','specification':policyrefs[2],'specificationVersion':'3.0.1, 2026-08; dataset vintage 2022; building-perimeter quality test is dataset specification, not proof of 2026 resurvey'},'aomori-single-coordinate-fact':{'policyUrl':'https://www.city.aomori.aomori.jp/about/1007400.html','policySnapshot':'data/evidence/issue7/tohoku/originals/b76290024a3071595bc5651339ffe901e92963c685a90a874b2b8098b13bb5e3.html','interpretation':'出典付きの単一施設座標の事実採用としてaccepted。一般著作権表示は確認済み。HTML文章・画像・編集著作物全体の公開再配布を許諾したものとは扱わない。GoogleリンクからGoogleデータの再配布許諾を推定しない。','originalHtmlPublication':'not approved by this coordinate review; no open license established','crs':'Municipal HTML has no explicit CRS identifier. Geographic web-map destination interpreted as latitude/longitude, not surveyed precision.'}}
report={'schema':1,'region':'tohoku','reviewedAt':'2026-11-05','inputPath':'data/national/issue7/tohoku.json','inputSHA256':v['sourceProposalSHA256'],'summary':{'assigned':84,'candidateReviewed':25,'accepted':25,'candidateDeferred':0,'correctionRequired':0,'remainingDeferred':59},'acceptedIds':[u['facilityId'] for u in p['updates']],'deferredIds':[u['facilityId'] for u in p['unresolved']],'correctionRequiredIds':[],'decisions':rows,'sourceConditions':conditions,'corrections':[],'correctionFormat':{'targetPath':'repo relative path','jsonPointerOrExactText':'location','old':'exact existing value','new':'exact replacement value'},'documentCodeDiscrepancies':[],'inheritedFindingsNotNewTohokuDiscrepancies':[{'number':1,'finding':'旧北海道README対decide.pyのH25/H26/H22出典制約・CRS不足'},{'number':2,'finding':'旧北海道READMEの複数窓口説明では登別第2庁舎・苫小牧北庁舎の棟同定不足'},{'number':3,'finding':'釧路2窓口に旧共通説明がるもいプラザ由来と読める文を付与'},{'number':4,'finding':'千歳の旧台帳・施設案内の経営管理課対配布案内の総務課'},{'number':5,'finding':'旧P05説明と現行一般PDLの表示差。個別2022 CC BY指定は引き続き保存すべきで、誤りとして消さない'}],'limits':['建物代表点の独立採否。入口・室内座標や全施設の無改修証明を要件にしない。','25候補の原数値と同定根拠を照合。残59件を全件深掘り済みとは扱わない。','配布状態、関係、元成果、manifest、既存共有ファイル、コード、固定baselineは変更しない。','HTML原本全文の公開許諾は座標採否から独立。全原本の公開再配布を承認しない。'],'validationPath':str(D/'validation.json')}
pathlib.Path('data/national/issue7/reviews').mkdir(exist_ok=True)
write('data/national/issue7/reviews/tohoku.json',report)
print(report['summary'])
