import json,hashlib,re
from pathlib import Path
ROOT=Path('data/evidence/national/review-chubu-west-locations')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def rowsha(r):return hashlib.sha256(json.dumps(r,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
source='data/national/location-updates/chubu-west.json'
u=read(source)['updates']; raw=read(ROOT/'extracted-evidence.json'); parent=read('/tmp/national-parent-assembled.json');places={p['id']:p for p in parent['places']}
notes=[
'本庁舎の施設名・花岡町2-18と数値qが一致。同建物内の2階窓口として採用。階の正確な位置は対象外。',
'公式施設紹介の岩村町263-2と埋込レコードの岩村まち並みふれあいの舘・観光協会岩村支部が一致。',
'公式えなてらす紹介・大井町286番地25と埋込のタウンプラザ恵那／恵那市観光協会が一致。名称の違いは同住所の案内所入居建物として説明可能。',
'公式公共施設一覧の森町役場・森2101-1・3階建ての行。同住所の旧プール管理棟や森92-1の北館とは別レコード。',
'公式案内と埋込の寄って宮・宮町1-1が一致。浅間大社全体でなく案内所名を指定。',
'森町役場本体の行であり、日直の室内位置までは承認しない。同建物代表点として採用。',
'公式markerはカクキュー八丁味噌（八丁味噌の郷）全体。原本は本社屋・味噌蔵・史料館・売店等を列挙し、配布建物の指定がない。さらに現住所は八丁町69で台帳の八帖町字往還通69と異なる。',
'水の歴史資料館という名前付きPOIとアクセス住所が一致。公式は地図上で東山配水場と表示される場合も位置は正しいと明記。月が丘／月ケ丘の表記差は同番地として扱い、現表記訂正案を別記。',
'公式行は道の駅ふじおやま全体の座標。観光案内所の存在は説明されるが、駐車場等を含む敷地内で案内所入居建物を同定する座標根拠がない。',
'公式ページの三島駅南口案内所・一番町16-1と同名埋込POIが一致。別住所の協会事務所と区別。',
'埋込ラベルは千福7-1 すそのセントラルパーク内という住所・敷地表記のみ。観光協会の名を持つPOIではなく、当該事務所建物との対応を証明しない。',
'園内の書院専用marker（id=2）であり、金鳳亭・庭園等とは別座標。対象書院の建物代表点として採用。',
'公式のさぼう遊学館地図リンクから保存されたHTTP 200転送先の同名施設目的地へ連鎖。南濃町奥条無番地が一致。',
'公式の清水駅前観光案内所というdata-marker-titleとlat/lngが同一要素。本文のアトラス清水駅前1階・辻1丁目1-3-103とも一致。',
'公式案内に名城水処理センター1階と明記され、科学館自身の名前付きPOIが指定される。処理場全体の点ではない。',
'運営者は駅舎併設観光施設を説明するが、レコードは郡上八幡駅（鉄道駅）全体。ホーム・駅構内と駅舎内案内所の建物を区別する追加根拠が不足。',
'県公開WiFi一覧のWiFi_9は伊豆長岡駅前観光案内所・南條780-3。別の伊豆の国市観光協会（古奈255）、伊豆長岡駅（南條773-2）と区別された施設行。建物代表点のみ。',
'埋込レコードは16-1 Miyukichoという住所のみ、種別Building。市役所施設名付きPOIでなく、本庁舎という特定建物の根拠に昇格できない。',
'名前付きPOIは道の駅全体。公式本文はくつろぎ広場、温泉、朝市、中庭等の複数施設を説明。配布建物の特定がなくbuildingとして保留。',
'公式配布案内がみのかも観光案内所へ明示リンクし、通常転送先の同名施設目的地座標を保存。本文の美濃太田駅南口1階とも一致。',
'県公共施設一覧の富士総合庁舎・本市場字前田441-1外・6階建ての行。台帳が指定する富士市役所の別所在地ではなく、入居先県庁舎として採用。',
'公式配布ページのリンクは富士山樹空の森全体。配布場所の名・住所は一致するが、公園内の特定交流センター建物の地点と確定できない。配布停止状態とは独立した位置保留。',
'高山市本庁舎の施設名・花岡町2-18・qが一致。当直室を同建物代表点として採用、別棟への流用なし。',
'旧庁舎記念館の施設ページ、島谷520-1と数値qが一致。旧庁舎建物の代表点。',
'公式WiFi施設一覧の静岡市上下水道局庁舎・七間町15-1という名前付き行。守衛室の正確な位置でなく庁舎建物の代表点として採用。',
'公式陶都創造館の施設案内・本町5-9-1・qと、台帳のPRセンター入居建物が一致。1階の室内地点は承認範囲外。',
'公式富士宮駅前観光案内所・中央町16-1と同名埋込POIが一致。寄って宮とは別施設。',
'埋込は夕陽ケ丘6という住所のみ、種別建造物。施設名付きPOIというsourceLocator／verificationMethodの説明は成立しない。建物の施設同定が未解決。',
'公式marker名は図書館交流プラザLibraで康生通西4丁目71に一致。台帳指定のセンター入居建物の代表点として採用。',
'公式数値qは道の駅ひだ朝日村全体。売店・レストラン・駐車場の案内はあるが配布対象建物と点の対応が確認できず保留。',
'公式施設名付きmarkerとルートdestinationがワカガエルステーションを指定。渚町2018-8・親水公園レインボーデッキ内の案内所として一致。公園全体を代用しない。',
'七間町15-1の上下水道局庁舎の公式施設行。6階窓口の位置ではなく同庁舎代表点として採用。',
'自治体配布案内のしらすのまどぐち・片岡2499-2と同名POIが一致。小山城駐車場全体でなく案内所を指定。',
'本文は第一庁舎1階警備員室と特定するが、埋込レコード名は熱海市役所全体。複数庁舎のうち第一庁舎建物を指す裏付けが不足。中央町1-1が一致するだけでは確定しない。',
'原本initEmbed[21][3][0]は住所だけのレコードで[21][3][12]は建造物。施設名・観光協会POIの記載なし。公式の掲載住所が同じでも住所featureを配布建物へ承認しない。住所代表点か実建物形状に基づく点かも保存応答からは確定できない。',
'公式運営者の現住所は八丁町52番地。台帳の八帖町字往還通52は訂正が必要。埋込名はまるや八丁味噌 本社であるが、配布窓口入居建物との対応も明示されないため現行行をそのまま承認しない。',
'公式アクセスとPOIはいずれも道の駅美並全体。本文は物産館・レストラン・休憩室を区別するが、物産館建物を特定した座標はない。物産館へのbuilding承認不可。',
'埋込名は今泉ポンプ場 岳南排水路管理組合。公式配布場所は庁舎2階事務室。ポンプ場敷地内の庁舎を特定する根拠が不足し、敷地POIを事務所建物へ流用しない。',
'公式記念館の施設名・船町2-26-1と数値qが一致。記念館建物の代表点として採用し、別施設の住吉燈台等に流用しない。',
'公式博物館・文学館ページの若王子500と同名埋込POIが一致。蓮華寺池公園全体でなく館の代表点。',
'公式配布案内のリンクはあじさいエコパーク全体。浄化センター内の配布建物・管理棟の指定がなく、敷地の目的地を建物地点として採用しない。',
'公式博物館アクセスの下切町5丁目1と同名POIが一致。博物館建物の代表点のみ、屋外展示や受付の精密位置を含まない。',
'公式園内marker id=2が家康館を明示し岡崎城・公園と区別。建物点として採用。台帳康生町561と公園運営者フッター561-1は記載粒度の差があり、フッターだけから館住所のexact変更はしない。将来休館は別途関係訂正案。',
'運営者アクセスの鮫島118-10とイオンタウン富士南POIが一致。モール建物の代表点として採用し、2階インフォメーション室内位置とはしない。'
]
assert len(notes)==44
deferred={6,8,15,18,21,29,33,36,37,40};correction={10,17,27,34,35}
rows=[];proposals=[];hashes={}
def evcheck(e):
 assert sha(e['snapshotPath'])==e['snapshotSHA256'];hashes[e['snapshotPath']]=e['snapshotSHA256']
for i,(x,r) in enumerate(zip(u,raw)):
 state='deferred' if i in deferred else 'correction-required' if i in correction else 'accepted'
 evcheck(x['evidence']); supports=[]
 for z in r['supporting']:
  evcheck(z['source']);assert z['linkedFromPrimary'];supports.append(z)
 p=places[x['facilityId']];evcheck(p['evidence'])
 rows.append({'facilityId':x['facilityId'],'name':r['name'],'address':r['address'],'decision':state,'scope':'building' if state=='accepted' else 'not-approved','coordinate':x['coordinate'],'sourceUpdateIndex':i,'sourceUpdateSHA256':rowsha(x),'reason':notes[i],'primaryEvidence':x['evidence'],'supportingEvidence':supports,'parentPlaceEvidence':p['evidence'],'limitations':'室内受付・階の精密位置、現地確認、配布関係の新規確定を含まない。' if state=='accepted' else '追加の建物同定原典を得るまで承認リストに入れない。'})
 if state!='accepted':
  proposals.append({'kind':'exclude-location-update','targetFile':source,'selector':{'facilityId':x['facilityId']},'old':x,'new':None,'operation':'remove-from-approved-selection-only','reason':notes[i],'warning':'nullは座標値への置換ではなく採用対象からの除外を意味する。元追補を変更する指示ではない。代替座標は未確定。'})
# Exact field alternatives only; parent applies if separately reviewed.
for i,new in [(6,'愛知県岡崎市八丁町69'),(7,'愛知県名古屋市千種区月ケ丘1-1-44'),(35,'愛知県岡崎市八丁町52番地')]:
 p=places[u[i]['facilityId']]
 proposals.append({'kind':'place-address-correction','selector':{'id':p['id']},'field':'address','old':p['address'],'new':new,'reason':'保存済み公式施設ページの現在の表記に一致させる。座標の建物scope承認とは別判断。','evidence':u[i]['evidence']})
closure=read('data/evidence/national/locations-chubu-west/review-notes.json')[0];evcheck(closure['evidence'])
fid=u[42]['facilityId'];rel=next(x for x in parent['relations'] if x['placeId']==fid);evcheck(rel['evidence'])
newrel=dict(rel);newrel['reviewUntil']='2027-01-11';newrel['condition']='2027年1月12日～3月19日は空調設備改修工事により家康館休館。期間中のカード配布・代替窓口は未確認のため、休館開始前に公式情報を再確認する。'
proposals.append({'kind':'replace-relation','selector':{'cardId':rel['cardId'],'placeId':fid},'old':rel,'new':newrel,'reason':'休館開始日から要確認とする。現在activeを維持し、休館だけでカード配布停止・代替配布・3月20日の再開を推測しない。','supportingEvidence':closure['evidence']})
candidates=read('data/evidence/national/locations-chubu-west/location-candidates.json')['candidates'];assert len(candidates)==16
candidateRows=[]
for c in candidates:
 evcheck(c['evidence']);assert c['distributionState']=='unconfirmed';assert c['legacyPlaceId'] not in {x['facilityId'] for x in u}
 candidateRows.append({'legacyPlaceId':c['legacyPlaceId'],'name':c['name'],'decision':'deferred','scope':'no-ledger-adoption','reason':'配布関係未確認。位置候補の存在を根拠に施設台帳採用・通常ピン化をしない。今回44updatesの建物承認とは別枠。','evidence':c['evidence']})
inputPaths=[source,'data/evidence/national/locations-chubu-west/provenance.json','data/evidence/national/locations-chubu-west/location-candidates.json','data/evidence/national/locations-chubu-west/review-notes.json','/tmp/national-parent-assembled.json','data/evidence/national/locations-chubu-west/README.md','data/evidence/national/locations-chubu-west/validate.py','data/evidence/national/locations-chubu-west/decisions.py','cmd/builddata/ledger.go','docs/distribution-design.md']
report={'schema':1,'region':'chubu-west','checkedAt':'2026-11-05','actorType':'ai','reviewType':'independent-saved-primary-location-review','inputSHA256':{p:sha(p) for p in inputPaths},'summary':{s:sum(r['decision']==s for r in rows) for s in ['accepted','deferred','correction-required']},'decisionIds':{s:[r['facilityId'] for r in rows if r['decision']==s] for s in ['accepted','deferred','correction-required']},'scopePolicy':'acceptedだけが建物代表点の採用可。所在地一致、公式iframe参照、数値存在だけでは建物同定に不十分。deferredは建物scope未証明、correction-requiredは住所featureの誤説明または住所訂正を伴う。','reviews':rows,'locationCandidates':candidateRows,'correctionProposals':proposals,'closureReview':{'facilityId':fid,'cardId':rel['cardId'],'startDate':closure['startDate'],'endDate':closure['endDate'],'evidence':closure['evidence'],'existingReviewUntil':rel.get('reviewUntil'),'existingReviewUntilPresent':'reviewUntil' in rel,'sufficient':False,'recommendReviewUntil':'2027-01-11','currentStatus':'active','distributionImpact':'館への来訪に影響。告知は館の休館のみでカード配布停止や代替窓口を明記しない。期間中の通常配布を保証できず、事前再確認が必要。','codeBehavior':'cmd/builddata/ledger.go:333は基準日 > reviewUntilでneeds-review/unknownを維持する。2027-01-11なら1月12日から失効。静的出力は再生成が必要。','otherExistingDeadline':'裾野市観光協会22-220-A001は既存reviewUntil=2026-11-13で11月14～15日配布休止の前日まで。これは十分なので関係訂正不要。'},'documentCodeDiscrepancies':[{'document':'data/evidence/national/locations-chubu-west/README.md 採用根拠2、およびvalidation.json checks','claim':'名前・住所付き施設レコードのみ使用、住所代表点不使用、全採用点は建物代表点','implementation':'decisions.pyのEMBEDは中泉・Miyukich・夕陽等の住所部分文字列で選択し、validate.pyはその部分文字列と座標一致のみ検査。施設名や建物scopeを検査しない。','finding':'磐田・沼津・神岡・裾野の住所ラベル、道の駅等の広域施設も合格するため、検証成功は説明された施設名付き建物同定を保証しない。今回の非採用行で補正し、元ファイルは未変更。'}],'dataDiscrepancies':[{'facilityId':u[i]['facilityId'],'description':s} for i,s in [(6,'現原本は八丁町69、台帳は八帖町字往還通69。exact案あり。'),(7,'現原本は月ケ丘1-1-44、台帳は月が丘1-1-44。表記訂正案あり。'),(35,'現原本は八丁町52番地、台帳は八帖町字往還通52。exact案あり。'),(42,'台帳康生町561と公園運営者フッター561-1の差。対象館専用の住所訂正根拠としては不足するため現住所の強制置換は提案しない。')]],'verification':{'updatesReviewed':len(rows),'uniqueIds':len({r['facilityId'] for r in rows}),'locationOnlyCandidatesDeferred':len(candidateRows),'hashVerifiedSnapshots':len(hashes),'officialToSupportingLinksVerified':sum(len(r['supporting']) for r in raw),'additionalFetches':0,'reasonNoAdditionalFetch':'保存原本で採用条件充足／未充足を判定可能。保留を無理に解消するための外部検索・制限回避は行わない。','evidenceIndex':str(ROOT/'extracted-evidence.json'),'sha256Index':str(ROOT/'snapshot-hashes.json'),'canonicalUpdateHash':'sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode())','allInputSnapshotsHashesMatch':True}}
Path('data/national/reviews/chubu-west-locations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(ROOT/'snapshot-hashes.json').write_text(json.dumps(hashes,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'summary':report['summary'],'snapshots':len(hashes),'links':report['verification']['officialToSupportingLinksVerified']},ensure_ascii=False))
