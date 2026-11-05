import json,datetime,hashlib
from pathlib import Path
R=Path('data/evidence/issue7/review-koshin');S=Path('data/evidence/issue7/koshin');source='data/national/issue7/koshin.json'
def read(p):return json.loads(Path(p).read_text())
d=read(source);classes={c['facilityId']:c for c in read(S/'classification.json')};nums={c['facilityId']:c for c in read(R/'numeric-checks.json')}
reasons=[
'配布本文は船津1754の生涯学習館（図書館）を指定し、船津1700の役場と明確に区別。P05山梨966の名称・住所が一致する。',
'市役所施設詳細1776は市役所の配置課として上下水道課を明記。P05127は市役所、134は北別館で別地物。名称と配置課の対応を採り127を建物代表点とする。同住所だけによる北別館への転用ではない。',
'現公式施設ページ13805は下武石742の自治センターを指定し、initlat/initlongが市配信JSでmarker.positionに渡る。42264は2021年3月供用開始と旧自治センター・健康センター解体着手を明記。旧P05 352/397は除外。P05398は同総合センター2Fの公民館で約23m差があるが、現自治センターの公式markerを優先する合理性がある。',
'運営者のあんずホール専用アクセスページが更埴文化会館を同定し、杭瀬下1-64のP05名称と対応。1503の更埴文化会館も同住所で約4m差。旧窓口として保持された施設の建物点を認める。現在の配布本文掲載有無から関係・状態を改変しない。',
'村の現配布案内・役場案内は古見1555-1の役場を指す。P05朝日村役場2889と合理的に一致。',
'市配布案内の総合観光会館を県公式観光詳細3402の上山田温泉2-12-10に対応させ、P05総合観光会館1551と一致。近隣の上山田文化会館1529とは別。',
'町公式244999は小布施1491-2の小布施町役場を明記し平日を建設水道課窓口に割当てる。P053026と一致。',
'町公式12584の第16弾市田柿は休日を下市田2183-1の役場日直室に指定。別カードの図書館や教育委員会の点を転用せずP05役場2403を採る。',
'市公式12271は下水道課を市庁舎2階、図書館を市庁舎となりのこもろプラザ1階と区別。相生町3-3-3のP05小諸市役所673を採る。',
'町公式244999は同じ役場の休日窓口を宿日直室と指定。平日窓口とP053026を共有できる。',
'市公式12271は宿日直室を市庁舎1階と明記。図書館と同住所でも別の施設指定であり、市役所673を平日窓口と共有できる。',
'村公式1400は休日に建物裏側の休日通用門へ来るよう指定。同じ役場2889の建物代表点を共有できる。入口そのものの座標とは主張しない。',
'市公式2041の配布本文が上山田文化会館・上山田温泉三丁目1番地1を明記しP05長野1529と一致。運営者2319は施設名とアクセスを補強するが住所の出典は2041。2319の杭瀬下の共通フッターを当施設住所として読まない。既知の移転・別棟競合は今回の原本に認めず、一律の改修不存在証明は不要。',
'市公式15244は幸町8-1の市役所庁舎4階の水道課を明記。P05岡谷市役所420と一致し旧岡谷市役所の建物を使用していない。',
'町公式12584の第16弾市田柿は平日を下市田2183-1の役場環境水道課に指定。休日窓口と役場2403を共有できる。',
'市公式101437は上下水道課を本庁舎西側・勤労者会館1階と明記。市155791.pdfのPDF51頁（紙面49頁）の勤労者会館住所は県291番地5。P05勤労者会館1606と一致する。本庁舎の県281-2というフッター住所・本庁舎点を使用しない。'
]
corrections=[];reviews=[]
for i,(u,reason) in enumerate(zip(d['updates'],reasons)):
 fid=u['facilityId'];c=classes[fid]
 fix={'facilityId':fid,'targetFile':source,'jsonPointer':f'/updates/{i}/evidence/checkedAt','old':u['evidence']['checkedAt'],'new':'2026-11-05','reason':'cmd/builddata/ledger.go validateEvidence uses time.Parse("2006-01-02"). Production validator probe rejects timestamp and accepts date-only value.'};corrections.append(fix)
 reviews.append({'facilityId':fid,'name':c['name'],'decision':'correction-required','coordinateDecision':'accepted','reason':reason,'coordinate':u['coordinate'],'scope':'building','sourceChecks':[{'sourceUrl':a['sourceUrl'],'snapshotPath':a['snapshotPath'],'snapshotSHA256':a['snapshotSHA256']} for a in c['attempts'] if a.get('snapshotPath')],'numericEvidence':{'path':str(R/'numeric-checks.json'),'facilityId':fid},'evidenceValidation':{'exactSevenFields':True,'originalPass':False,'afterCheckedAtCorrectionPass':True,'probe':str(R/'go-evidence.txt')},'termsDecision':'accepted as attributed P05-derived point; preserve source and processing notices' if 'P05' in u['evidence']['sourceUrl'] else 'accepted as attributed individual municipal coordinate fact; no permission inferred for external republication of entire HTML','requiredCorrections':[fix['jsonPointer']]})
# Correct a concrete source-attribution overstatement without changing the point.
i=12;u=d['updates'][i];old=u['evidence']['verificationMethod'];prefix='今回再取得の市配布本文・運営施設案内で上山田温泉3-1-1の上山田文化会館を照合。';assert old.startswith(prefix)
new=old.replace(prefix,'市配布本文2041.htmlが上山田温泉三丁目1番地1の上山田文化会館を明記し、P05建物点の名称・住所と照合。運営者2319.htmlは施設名とアクセスを補強するが、住所の出典ではない。',1)
corrections.append({'facilityId':u['facilityId'],'targetFile':source,'jsonPointer':f'/updates/{i}/evidence/verificationMethod','old':old,'new':new,'reason':'2319.htmlはアクセス案内。共通フッターは文化課の杭瀬下住所であり上山田文化会館の住所証拠ではない。2041.html本文が正しい住所を直接示す。'})
reviews[i]['requiredCorrections'].append(f'/updates/{i}/evidence/verificationMethod')
for x in d['unresolved']:
 reviews.append({'facilityId':x['facilityId'],'name':classes[x['facilityId']]['name'],'decision':'deferred','reason':x['reason'],'nextSource':x['nextSource'],'reviewScope':'提出された残件理由・原本参照hashの確認。座標候補の提出なし。本独立レビューで追加GIS探索を全深掘りしたという判定ではない。','reasonOrigin':'producer unresolved record, retained with limited review'})
oldcorr=d['corrections'][0];correctionReview={**oldcorr,'decision':'accepted','exactOldVerified':True,'reason':'現市配布本文2041の名称住所とP051529が対応。改修不存在の一律証明を外す訂正はユーザー基準に合致。旧取得失敗記録・当時判定・配布関係を変更しない。'}
readme=S/'README.md';old='今回の閲覧範囲では文書と実装コードの不一致は見つからなかった。Go `Evidence` は実コード `cmd/builddata/ledger.go` の7フィールドと一致する。fetchedAtは取得記録だけに置き、主evidenceへ混入させていない。';assert old in readme.read_text()
corrections.append({'targetFile':str(readme),'exactOld':old,'exactNew':'Go `Evidence` のフィールド名7件は一致するが、全16候補のcheckedAt日時文字列は実装validateEvidenceのYYYY-MM-DD形式に不適合。独立レビューのexact訂正に従い日付形式へ修正する必要がある。fetchedAtは取得記録だけに置く。','reason':'フィールド名一致だけではGo値検証への適合を示せない。元validate.pyはcheckedAtの日付形式を検査していない。'})
ids=[u['facilityId'] for u in d['updates']];allids=[r['facilityId'] for r in reviews];assert len(allids)==len(set(allids))==43;assert set(allids)==set(read('data/work/issue7-baseline/assignments.json')['koshin'])
result={'schema':1,'reviewedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceFile':source,'sourceSHA256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),'scope':'16座標候補の独立採否と旧上山田requiredEvidence訂正1件。残件27件は継続保留の一覧化であり追加全探索ではない。','criteria':'建物代表点で十分。名称住所と施設指定で合理的に対応できれば採用。入口・室内位置や全施設の改修不存在証明は不要。既知移転・別棟競合は個別解消。','summary':{'accepted':0,'correction-required':16,'deferred':27,'coordinateAccepted':16,'acceptedLegacyCorrections':1},'acceptedFacilityIds':[],'coordinateAcceptedFacilityIds':ids,'acceptedAfterRequiredCorrectionsFacilityIds':ids,'reviews':reviews,'requiredCorrections':corrections,'legacyCorrectionReview':[correctionReview],'documentationCodeMismatches':[{'documentation':str(readme),'code':'cmd/builddata/ledger.go:121','finding':'READMEは不一致なしとするが16候補のcheckedAtは日時、Goは日付だけを許可。7キーは合うが全件検証失敗。','resolution':'コードに従い2026-11-05へexact訂正。原本取得時刻fetchedAtは変更しない。'}],'sourceAttributionClarifications':['上山田2319.htmlは施設名・アクセスの補強。3-1-1は2041.html本文の住所であり運営者共通フッターではない。'],'reuse':{'p05':{'catalogSnapshot':str(S/'28d45067bfd5191b2a49.html'),'termsSnapshot':str(S/'8b3d596123345c99c3b6.html'),'decision':'P05の現カタログはオープンデータ、現一般規約はPDL1.0。出典と抽出・軸組替え加工を明記し国の作成物と誤表示しない。HTMLコメント内の旧非商用表示を現条件に混同しない。','attribution':'国土交通省 国土数値情報 市町村役場等及び公的集会施設データ P05-22（2022年4月基準）を施設抽出・緯度経度組替え・現施設照合して作成。'},'ueda':{'termsSnapshot':str(S/'91bce5e371c21c887c3d.html'),'decision':'自治体がHTMLに配信する当施設の個別数値事実を出典付きで利用する範囲で採用。Google本体応答からの抽出ではない。一般著作権記述だけでこの点を一律保留しない。','fullSnapshotRepublication':'この判定は市HTML全文・写真・配置・JSの外部再公開やPDL再許諾を承認しない。公開用パッケージに原本全文を含める判断とは別。'}},'preserved':['配布状態','カード施設関係・旧関係','元成果','manifest','コード','固定baseline','既存原本'],'limits':['保存原本に基づく独立レビュー。新規HTTP再取得や現地測量は実施していない。','27残件の全GIS・PLATEAU・施設台帳を深掘り済みとはしない。','武石HTMLにEPSG明記はない。市がGoogle Maps LatLngに与える緯度経度として扱い、P05のEPSG:6668と混同しない。']}
Path('data/national/issue7/reviews/koshin.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['summary'])
