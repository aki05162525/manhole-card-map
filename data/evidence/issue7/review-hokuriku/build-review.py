import json,hashlib
from pathlib import Path
B=Path('data/evidence/issue7/review-hokuriku'); target=Path('data/national/issue7/reviews/hokuriku.json')
x=json.loads(Path('data/national/issue7/hokuriku.json').read_text()); identities=json.loads(Path('data/evidence/issue7/hokuriku/identity-review.json').read_text())
reasons=[
'組合配布PDFが舟橋会館事務室・舟橋村海老江147を明記。村の会館施設案内も同住所。P05舟橋会館featureと合理的に同じ建物と同定できる。休日窓口という配布条件は座標採否と分離。',
'市配布案内と2026年9月更新の公民館施設案内はともに羽ヶ榎104-25（配布案内の羽ケ榎は表記差）。P05荒川地区公民館の名称住所と一致。既知の別棟への流用を示す証拠はなく、一律の改修不存在証明は不要。',
'町配布原本は本庁舎の上下水道課、末吉千古1番地1を指定。P05志賀町役場と一致。休日の役場内管理人室と同建物代表点を採用できる。',
'町配布原本は休日配布先を「志賀町役場内の管理人室」と明記。平日窓口と同じ本庁舎の点で十分であり、管理人室の室内座標は不要。',
'配布原本の出雲崎町役場建設課窓口と役場アクセスは川西140。P05出雲崎町役場と対応する。天領の里時代館とは別IDとして扱う。',
'町の宇出津公民館詳細はコンセールのと（宇出津公民館）・宇出津ト29-2、別の町施設紹介は館内に公民館とたびスタが併設されると明記。配布原本のたびスタも同住所。P05公民館点を同じ建物代表点として採用可能。',
'市配布原本は上下水道局庁舎3階経営管理課・大手3-13-1。局案内も同住所・同階を示し、保存HTMLの写真altが企業局庁舎外観の写真と明示する。P05企業局庁舎の名称住所に対応。大手3-10-1の市役所本庁舎と区別した。画像そのものを測量・目視同定したとの主張ではない。',
'市施設詳細は東公園への2022年移築を説明し、蔵春閣・諏訪町1丁目9番20号を明記。現行配布原本も同施設・同住所。市HTMLの地図リンクhrefの数値qは当該施設の目的地で、旧東京建物や地図viewportではない。CRS名はHTMLに明示されず、WGS84変換済みとは扱わない。'
]
rows=[]
for u,identity,reason in zip(x['updates'],identities,reasons):
 assert u['facilityId']==identity['facilityId']
 rows.append(dict(facilityId=u['facilityId'],status='accepted',reviewDepth='independent-original-review',reason=reason,coordinate=u['coordinate'],scope='building',evidence=u['evidence'],identitySources=identity['sources'],numericEvidenceCheck='data/evidence/issue7/review-hokuriku/numeric-and-evidence-checks.json',termsDecision='P05' if u['evidence']['snapshotPath'].endswith('.zip') else 'municipal-factual-point'))
for u in x['unresolved']:
 reason='今回の8候補に数値提案がないため本レビューでは座標採用しない。以下は提出者の未解決理由の記録であり、独立した全深掘り済み判定ではない。'
 if u['facilityId']=='facility:chubu-east-b7d939284218814b6bba':
  reason+=' 配布終了・閉館・現在の現存証明不足だけで旧施設IDへの座標付与を否定してはならない。P05の旧建物対応は将来の別レビュー対象であり、今回未検証。'
 rows.append(dict(facilityId=u['facilityId'],status='deferred',reviewDepth='inventory-only-not-exhaustive',reason=reason,submittedReason=u['reason'],submittedEvidenceReferences=u['attempts'],coordinateDecision='not-approved-in-this-review'))
c=x['corrections'][0]
correction=dict(c,status='accepted',reason='市原本のキターレ所在地は糸魚川市大町2丁目2－19。指定pointerのexact oldも一致。住所部分の訂正を承認する。市リンクにmode=searchがあることは確認したが、表示中心のみであるという残りの旧断定まで再承認するものではない。座標は引き続きdeferred。')
occurrences=[]
def walk(v,path,pointer=''):
 if isinstance(v,dict):
  for k,val in v.items():walk(val,path,pointer+'/'+k.replace('~','~0').replace('/','~1'))
 elif isinstance(v,list):
  for i,val in enumerate(v):walk(val,path,pointer+'/'+str(i))
 elif isinstance(v,str) and c['old'] in v:
  occurrences.append(dict(path=path,pointer=pointer,old=v,new=v.replace('河井町4-66-1','糸魚川市大町2-2-19'),handling='reference-occurrence; historical embedded research is not silently rewritten'))
for p in ['data/national/issue5/chubu.json','data/national/location-updates/chubu-east-north.json']:walk(json.loads(Path(p).read_text()),p)
report=dict(schema=1,review='issue7-hokuriku-independent',input='data/national/issue7/hokuriku.json',inputSHA256=hashlib.sha256(Path('data/national/issue7/hokuriku.json').read_bytes()).hexdigest(),checkedAt='2026-11-05',instructions={'AGENTS':'User-supplied AGENTS instructions applied; no AGENTS.md found at repository root, searched ancestor paths or within data.','acceptance':'配布施設の建物代表点で十分。合理的な名称住所・建物対応を採用し、入口・室内位置や全施設一律の改修不存在証明は要求しない。既知の移転・別棟・競合は個別に評価。'},summary={'coordinateCandidatesAccepted':8,'coordinateCandidatesDeferred':0,'coordinateCandidatesCorrectionRequired':0,'otherIdsDeferredWithoutExhaustiveReview':32,'reasonCorrectionsAccepted':1},acceptedFacilityIds=[u['facilityId'] for u in x['updates']],deferredFacilityIds=[u['facilityId'] for u in x['unresolved']],correctionRequiredFacilityIds=[],results=rows,corrections=[correction],relatedHistoricalOccurrences=occurrences,terms={
'P05':{'decision':'accepted','individualDesignation':'現取得P05カタログの表示は適用する利用規約に基づく（オープンデータ）。使用許諾リンクは一般規約#agree-01。コメント内の旧非商用記述を現行表示条件と扱わない。','generalTerms':'2026-03-23施行PDL1.0。個別条件があるデータは個別指定優先だが、今回のP05表示にCC BY 4.0一部制限や非商用の個別指定はない。他データの例外をP05へ転用しない。','attribution':'出典：国土交通省「国土数値情報 市町村役場等及び公的集会施設データ」P05-22、https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-v3_0.html を加工して作成。加工：レコード抽出、現行建物との名称住所照合、経緯度の順序変更。国が作成した追補ではない。','factualUseVsFullOriginal':'対象点抽出を承認する。ZIP再配布も条件順守が必要で、自治体HTML・写真等の全文再公開許諾に波及しない。'},
'municipal-factual-point':{'decision':'accepted','reason':'新発田市の一般著作権ページは文章・写真・イラストとページ編集著作物の保護を記載。市が施設ページに明示する単一の位置の事実抽出と全文転載を区別する。このレビューでGoogle地図応答・画像・タイルは取得していない。','fullOriginalExternalRepublication':'not-approved-by-this-coordinate-review; 保存HTML全文や写真の外部公開・再許諾は別の扱い。一般著作権案内を根拠に座標を一律保留しない。'},'sources':'data/evidence/issue7/review-hokuriku/terms-fetches.json'},validation='data/evidence/issue7/review-hokuriku/validation.json',documentCodeDiscrepancies=[],otherFindings=[{'kind':'incorrect-address-in-research','detail':'キターレの旧理由に輪島市の住所が混入。承認したexact old/newと歴史的コピーの全出現箇所を保存。'}, {'kind':'historical-policy-difference','detail':'荒川の旧レビューが要求した一律の改修・継続使用証明は今回のユーザー条件では不要。'}, {'kind':'terms-description-context','detail':'docs/national-assembly.mdの過去レビュー要約はP05の個別CC BY指定に言及するが、今回取得したカタログは一般規約参照のオープンデータ表示。過去取得時の表示を否定せず今回の原本に従う。これはコードとの不一致ではない。'}],limits=['独立原本レビューは8候補とキターレ住所訂正。40 IDを列挙したが32残件の全深掘り完了を主張しない。','Go Evidence実装の7フィールドとvalidateEvidence条件を照合し同等の入力検証を実行。Goビルドは実行していない。','P05の建物外周内検査は製品仕様上の品質要件。各点の現地測量や建物外形重ね合わせを実施したという意味ではない。','配布状態、旧relations、住所台帳、manifest、元成果、既存原本、固定baselineは変更しない。'])
assert len(rows)==40 and len({r['facilityId'] for r in rows})==40
assert not target.exists(),'Do not overwrite existing review'
target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('Saved',target,'accepted',len(report['acceptedFacilityIds']),'deferred',len(report['deferredFacilityIds']),'correction',len(report['corrections']),'historical occurrences',len(occurrences))
