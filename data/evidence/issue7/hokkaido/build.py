"""Offline generator. Decisions are explicit reviewer-facing judgements, never auto-accepted matches."""
import json,pathlib,hashlib,zipfile,io,csv,datetime,xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[4];D=ROOT/'data/evidence/issue7/hokkaido'
def read(p):return json.loads((ROOT/p).read_text())
def save(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
ts=read('data/evidence/issue7/hokkaido/targets.json');rs=read('data/evidence/issue7/hokkaido/fetch-records.json');byurl={r['url']:r for r in rs};additional=read('data/evidence/issue7/hokkaido/additional-targets.json')
P05='data/evidence/issue5/chubu/P05-22_GML.zip';PURL='https://nlftp.mlit.go.jp/ksj/gml/data/P05/P05-22/P05-22_GML.zip';z=zipfile.ZipFile(ROOT/P05);zz=zipfile.ZipFile(io.BytesIO(z.read('P05-22_01_GML.zip')));raw=zz.read('P05-22_01.geojson');geo=json.loads(raw)
selected={1:3244,2:5318,6:3244,7:4642,8:3161,13:4625,17:3631,18:3663,21:4655,23:5318,24:5000,25:3161,31:3631,32:4982,33:3039,36:2812,43:3272,45:4655,47:4982,52:5000,58:4982,61:3210,62:3210,67:1603,41:3534,59:3534}
notes={
1:'配布本文は字西町120の役場1階産業振興課と土日祝役場守衛室を同じ役場として列挙。',
2:'配布本文は別海常盤町280の別海町役場、平日上下水道課・土日祝警備員室を同じ欄に列挙。',
7:'配布本文は水木の配布を鹿追町役場2階商工観光課と指定。道の駅裏プレハブの点には流用しない。所在地東町1-15-1が一致。',
8:'配布本文は大町2-2-11の役場1階建設水道課と休日警備室（役場裏玄関入口）を明記。日の出公園の蓋地図を使わない。',
13:'配布本文で平日の役場建設課を上士幌東3線238と明記。227番地の道の駅は別施設。',
17:'配布本文その1は大通6丁目豊富町役場内、平日5番窓口・休日役場裏玄関守衛室（左側面灰色の扉）。裏の定住支援センターは別カード施設として分離。',
18:'配布本文は平日の利尻町役場建設課。役場住所沓形字緑町14-1と一致。休日どんとは別建物。',
21:'第25弾の平日施設課と休日警備員室（庁舎西側入口）を3条南4-26の同じ役場に明記。第28弾とくとくとは別。',
24:'配布本文が東1条3丁目1の役場2階建設課と役場裏口警備員室を列挙。庁舎正面から側面歩道で裏口職員玄関へ行く案内もあり、別棟を推測したものではない。',
32:'第18弾の配布本文が足寄町役場2階建設課上下水道室、土日祝は役場裏警備員室を指定。役場所在地北1条4-48-1とP05が一致。第10弾平日の共栄町処理場へ役場点を流用しない。',
33:'配布本文は火曜の当麻町役場まちづくり推進課。役場の現所在地3条東2-11-1が一致。郷土資料館とは区別。',
36:'現町施設案内は交流プラザみなクルを本町1区と表記しP05住所と一致。カード配布本文・町公開避難施設CSVの字奈井江町74、電話0125-74-5574を同じ建物に接続。避難広場の点を転用せずP05公的集会施設点を採用。',
43:'配布本文は水曜のみ役場建設課上下水道グループ、仲町37番1号と明記。絵本の館とは別地点。',
61:'配布表は平日に南富良野町役場の建設課上下水道係・企画課商工観光係を列挙。現役場所在地幾寅867と一致。浄化センター・休日みなくるには流用しない。',
67:'配布本文はすないる休館日の砂川市役所当直室。現庁舎所在地西7条北2-1-1とP05が一致し、旧庁舎の所在地ではない。'}
notes[41]='P05の天塩町役場・新栄通8と、町公式の役場2階建設課/1階当直室を照合。台帳も新栄通8で同一。配布本文1464-113とフッター1466-113の枝番相違は未訂正で監査に保持するが、いずれも同じ役場を指し別庁舎・移転を示す資料ではないため、建物代表点の採用を妨げるとはしない。'
notes[59]=notes[41]
for dst,src in {6:1,23:2,25:8,31:17,45:21,52:24,47:32,58:32,62:61}.items():notes[dst]=notes[src]
# New findings, stated individually. These replace old blanket holds; they do not alter baseline facts.
reasons={
0:('relocation-or-separate-building','再取得した配布本文は平日第2庁舎2階。P05登別市役所feature1741は千歳町3-1-5で台帳の中央町6-11と不一致。市役所総称の点で第2庁舎を埋めない。','中央町6-11の第2庁舎を指定する公開GISまたは配置図と建物外形'),
3:('coordinate-conflict','今回P05-22から北町200の候補2件を新発見：3238「交流施設ひだまり大通自治会館」[142.41402,44.02707044]、3263「交流施設ひだまり」[142.413803,44.02856]。約166m離れ、現公式配布・施設案内は北町200で双方を一意に選別できない。旧「該当点なし」をそのまま維持した判断ではない。','公式施設パンフレットの配置と建物外形、自治体GISのひだまりレコード'),
4:('missing-primary-building-coordinate','配布本文と処理場条例を再取得。共栄町120-5の処理場名は確認できるが建物座標の明示なし。P05町役場点は別地点。管理棟・処理設備を区別できる数値原典は今回未取得。','処理場管理棟の公式配置図と公開建物外形'),
5:('missing-primary-building-coordinate','札幌配布案内、管理者アクセス、観光案内を再取得。西7丁目のショップ建物を指定する数値マーカーを検出できず、公園全体の表示中心を不採用。','大通西7丁目インフォメーション建物の市GISまたはPLATEAU外形'),
9:('address-conflict','配布案内823-3と施設contactの828-3を再取得し相違を確認。accessの花ロードえにわ817-18への誘導はセンターハウスの数値原典にならない。','はなふるセンターハウスの公的建物外形と施設住所の説明'),
10:('relocation-or-separate-building','現配布案内・町役場施設案内を再取得。はなのわ整備後の建物を旧役場点へ接続する数値原典は取得できず。P05旧役場を現複合施設へ自動承認しない。','はなのわ完成後の公開施設GISまたは建物外形'),
11:('relocation-or-separate-building','現配布案内・2025年新庁舎フロア案内・ロケーション案内を再取得。旧住所中央3-13-15の役場点は中央3-2-1の新庁舎へ流用不可。新建物の公式直接数値マーカーを取得できなかった。','2025年新庁舎の自治体公開GISまたは更新済み建物外形'),
12:('relocation-or-separate-building','現配布案内は北庁舎3F、交通アクセスは市役所全体。再取得資料から北庁舎建物を数値点へ同定できず。','北庁舎をラベル付けした配置図と公開建物外形'),
15:('source-conditions-unverified','配布案内と指定管理者の科学館アクセスを追加取得。施設は確認したが新しい建物数値原典を検出できなかった。旧H25文化施設座標の個別利用条件は新P05規約で上書きしない。','札幌市自身の科学館位置GISまたはPLATEAU建物外形'),
19:('missing-primary-building-coordinate','配布・管理者アクセス・観光案内を再取得。西3丁目観光案内所建物の数値点は検出できず。西7丁目ショップや公園表示中心とは別施設。','西3丁目観光案内所の市GISまたは建物外形'),
20:('relocation-or-separate-building','町配布案内・観光協会たら丸館施設紹介を再取得。既存Google応答の道の駅全体と、たら丸館を分離する独立座標を得られない。向かいのトイレ・駐車場を含む駅全体点は使わない。','たら丸館を示す公式GISまたは建物配置と外形'),
22:('relocation-or-separate-building','市配布ページと市アクセスを再取得。直接q=43.93876130596552,141.64699032117065は留萌プラザの配布節であり分庁舎ではない。市役所本庁点も流用しない。','幸町1-11分庁舎の配置図と公開建物外形'),
27:('missing-primary-building-coordinate','室蘭市配布案内と観光協会の事務局・アクセスを再取得。海岸町1-5-1の事務局に結び付く直接座標を検出できず。駅・交通地点の表示から生成しない。','室蘭観光協会事務局建物の公開GISまたは外形'),
28:('relocation-or-separate-building','市配布案内、運営者tecとaccessを再取得。本館案内所と別館ほっくるは区別されているが、Google応答以外の本館建物点を取得できず。','本館案内所を含む駅建物の公式GISまたは建物外形'),
29:('coordinate-scope-unresolved','旭川市配布案内・施設案内・観光地域サイトを再取得。数値geoはTransitSystemレンタサイクル（旭川駅）のレコード。センター名のiframe queryにも数値があるが東コンコース前貸出位置との関係を確定できず、建物内点と断定しない。','観光物産情報センターが入居する駅建物外形と数値点の位置関係'),
30:('missing-primary-building-coordinate','町配布ページ・町施設ページ・北の道の駅を再取得。施設の一致と227番地/227-1表記は確認したが、既存点はGoogle応答由来。今回は独立した建物座標を得られず、枝番差だけを理由に止めたものではない。','町が直接公開する道の駅建物点または建物外形'),
34:('missing-primary-building-coordinate','市配布案内と観光案内所・MICE施設ページを再取得。表町5-11-5ふれんどビル1階を確認したが、数値建物マーカーは検出できない。','ふれんどビルの公式GISまたは建物外形'),
35:('relocation-or-separate-building','市配布案内と北海道公式観光ページを再取得。Pottoは副港市場1階、観光ページ直接qは副港市場施設全体。複数棟と市場棟の対応が未解決。ページ内の周辺観光施設data-latも対象外。','副港市場市場棟Pottoの配置図と建物外形'),
37:('missing-primary-building-coordinate','北見市配布本文と上下水道局各課案内を再取得。中ノ島1-4-1の局庁舎は確認したが直接建物座標を検出できず。P05常呂総合支所とは別。','中ノ島の上下水道局庁舎を示す市公開GISまたは外形'),
38:('source-conditions-unverified','千歳市配布本文・庁舎案内を再取得。東雲町3-2-5の局庁舎と総務課は確認。Google地図応答の点とは別の数値原典を得られず、公式HTMLに座標を付け替えない。','千歳市水道局庁舎の市公開GISまたは建物外形'),
39:('source-conditions-unverified','町の配布案内・施設ページを再取得。旧H25文化施設点の条件を新P05条件と混同せず、新規の建物位置原典を検索したが取得できなかった。','天塩町自身のスポーツセンター座標または建物外形'),
40:('relocation-or-separate-building','町配布本文に加え運営者の交通・日帰り・貸会議室案内を追加取得。交通案内HTMLにmarker1.setPosition(new google.maps.LatLng(44.876879,141.74413600000003))を新発見。Google応答でなく公式直接数値だが、温泉側受付を含む棟とこのマーカーの対応は未確認。日帰り/宿泊併設の説明だけでは棟を一意に選べず、室内受付精度ではなく建物対応を残課題とする。','夕映の温泉側と宿泊側の配置図・建物外形'),
41:('address-conflict','配布本文と町公式を再取得。1464-113/1466-113の相違が残る。P05 feature3534は新栄通8の役場点で枝番を判別できない。役場名だけで既知の競合を解消したとしない。','庁舎所在地の公的訂正資料または地番付き建物図'),
42:('coordinate-conflict','現配布案内は2022-05-06にかなえーるへ移転。P05 feature2758は新住所浜町50だが座標[140.639078,43.265353]は旧H26浜町40-4[140.63908,43.26535]とほぼ同じ。2021年度建築を示す管理計画と2022開館広報も追加取得したが、新棟内点であることを確認できず。住所更新だけでは数値点更新を保証しない。','かなえーるの配置図と新建物外形によるP05点の内外判定'),
44:('coordinate-scope-unresolved','町配布案内・施設本体とアクセスを再取得。経路到着点を施設内の配布建物へ接続する独立座標根拠がない。工房・スパ等の室内位置は不要だが、到着点が建物に対応することは未確認。','ガーデンスパ建物外形と公式施設配置図'),
46:('relocation-or-separate-building','市配布本文・工房公式・観光協会を再取得。観光協会HTMLのq=43.32069218366,142.37707933331296は施設全体。チーズ/アイス/ピッツァ/体験工房と前庭のどこを表すかは確認できず。','チーズ工房配布建物の施設配置図と建物外形'),
48:('relocation-or-separate-building','町配布本文、施設トップ・アクセスを再取得。資料館・売店・直売所がある施設のGoogle応答以外の棟指定座標を得られず。','D51ステーション配布建物の公式配置図と建物外形'),
49:('source-conditions-unverified','現配布本文と市庁舎所在地案内を再取得。南大通庁舎の名称住所は確認したが、Google応答点の代替となる直接公式数値を検出できなかった。旧共通説明の訂正と位置承認を分離。','南大通上下水道庁舎の市GISまたは建物外形'),
54:('address-conflict','配布案内と協会問い合わせを再取得、よろーな施設案内は今回HTTP503で再試行しない。P05 feature1453の駅前交流プラザよろーなは東1条南7-1-100、台帳と協会は1-10。新発見した候補だが番地競合と建物対応を解決できず。','よろーな建物外形と1-10/1-100の所在地表記説明'),
55:('relocation-or-separate-building','市配布本文・観光協会・北の道の駅を再取得。観光物産センターと直売店/トイレ/百年記念館を区別する数値建物点は見つからず。','観光物産センター棟の施設配置図と公開建物外形'),
57:('coordinate-scope-unresolved','市配布本文とすないる公式を再取得。住所feature経由の旧点に代わる建物名付き数値原典を取得できず。住所中心を建物点と呼び替えない。','すないる建物の市公開GISまたは建物外形'),
63:('relocation-or-separate-building','配布本文と新庁舎工事完了記事を追加取得。2022年6月着工・2024年新庁舎のため、同住所字奈井江11のP05-22 feature2816を現建物点に採用しない。','2024年開庁後の役場GISまたは新庁舎配置図・建物外形'),
64:('address-conflict','配布本文は中央町6-11の本庁舎1階宿直室。P05 feature1741は千歳町3-1-5と別住所。第2庁舎とは別窓口として確認したが、本庁舎の独立数値原典は未取得。','中央町6-11の現本庁舎を示す自治体GISまたは建物外形'),
65:('source-conditions-unverified','小樽市配布本文を再取得し本庁舎1階当直室を確認。水道事業課の庁舎住所案内も追加取得。P05には同名水道局庁舎点がなく、Google応答点の再利用条件を解決する独立資料は今回未取得。','小樽市水道局本庁舎を示す市公開GISまたは外形'),
66:('missing-primary-building-coordinate','現配布本文で新得駅前地域交流センターとくとく1Fショップレジ、本通南1-21-22を確認。P05-22に当施設を同定できず、新しい建物の数値原典は取得できない。町のとくとく施設紹介も追加取得し、建物の機能は確認したが座標は得られなかった。','とくとく完成後の自治体施設GISまたは建物外形')}
for dst,src in {26:10,53:11,50:37,51:49,59:41,60:42}.items():reasons[dst]=reasons[src]
extra_by_index={64:['https://www.city.noboribetsu.lg.jp/docs/2013031800141/'],14:['https://www.harp.lg.jp/opendata/dataset/2235.html'],15:['https://sapporo-src.com/kagakukan/acces.html'],36:['https://www.town.naie.hokkaido.jp/shisetsu/bunka/minakuru/'],56:[r['url'] for r in rs if '/1807' in r['url']],63:['https://www.town.naie.hokkaido.jp/town/seisaku/tyoushaseibi/koujishintyoku/060209_kouji014/']}
for idx,urls in read('data/evidence/issue7/hokkaido/targeted-sources.json').items():extra_by_index.setdefault(int(idx),[]).extend(urls)
for i in [42,60]:extra_by_index[i]=[r['url'] for r in rs if 'cassette_' in r['url']]
updates=[];unresolved=[];audit=[];oldrefs={}
def evidence(r,loc,method):return dict(sourceUrl=r.get('url',PURL),snapshotPath=r['snapshotPath'],snapshotSHA256=r['snapshotSHA256'],sourceLocator=loc,checkedAt='2026-11-05',actorType='ai',verificationMethod=method)
for i,t in enumerate(ts):
 urls=list(dict.fromkeys(t['urls']+additional.get(t['facilityId'],[])+extra_by_index.get(i,[])))
 refs=[byurl[u] for u in urls if u in byurl];attempts=[]
 for r in refs:
  attempts.append({'kind':'new-fetch-and-inspection','url':r['url'],'status':r.get('status'),'fetchedAt':r['fetchedAt'],'snapshotPath':r.get('snapshotPath'),'snapshotSHA256':r.get('snapshotSHA256'),'result':('原本再取得。配布建物名称・住所とHTMLの直接座標/マーカー構文を確認。個別結論はreasonまたはauditの判断に記載。' if r.get('status')==200 else '取得失敗。根拠に採用せず、同じURLの再試行なし。')})
 for e in t['oldEvidence']:
  if 'snapshotPath' in e and 'snapshotSHA256' in e:
   oldrefs[e['snapshotPath']]={'snapshotPath':e['snapshotPath'],'snapshotSHA256':e['snapshotSHA256'],'fetchedAt':e.get('fetchedAt'), 'sourceUrl':e.get('sourceUrl',e.get('url'))}
 attempts.append({'kind':'new-analysis-of-existing-primary','sourceUrl':PURL,'snapshotPath':P05,'snapshotSHA256':sha(ROOT/P05),'result':'全国ZIPの北海道GeoJSONを展開し施設名・住所と照合。原本再取得ではない。個別採否・競合はreason/audit参照。'})
 priorcat=('excessive-indoor-precision-and-source-conditions' if '特に当窓口' in t['oldReason'] else 'source-conditions-unverified' if any(w in t['oldReason'] for w in ['非商用','Google Maps応答']) else 'not-reinvestigated' if '追加proposal' in t['oldReason'] else 'relocation-or-separate-building' if any(w in t['oldReason'] for w in ['別棟','新庁舎','棟','複合']) else 'missing-primary-source')
 a={'priorReasonCategory':priorcat,'facilityId':t['facilityId'],'name':t['name'],'address':t['address'],'priorReason':t['oldReason'],'investigationStatus':'new-investigation','attempts':attempts,'supportingSources':refs}
 if i in selected:
  idx=selected[i];f=geo['features'][idx];lng,lat=f['geometry']['coordinates'];method=notes[i]+' 国土数値情報P05-22の建物外周内検査仕様に基づく建物代表点。原値JGD2011/EPSG:6668（経度,緯度）を保持。2022年4月基準と現公開案内を照合。室内位置や未知の改修不存在の保証ではない。出典：国土交通省国土数値情報（市町村役場等及び公的集会施設2022）を加工。現行第3.0版カタログ・PDL1.0規約を確認。'
  e=evidence({'url':PURL,'snapshotPath':P05,'snapshotSHA256':sha(ROOT/P05)},f'P05-22_01_GML.zip!P05-22_01.geojson#/features/{idx}',method);coord={'lat':lat,'lng':lng};a.update(rawFeature=f,featureIndex=idx,decision=notes[i])
 elif i==64:
  r=byurl['https://www.city.noboribetsu.lg.jp/docs/2013031800141/'];coord={'lat':42.41243118169229,'lng':141.1067676544189};method='市の庁舎交通案内HTMLのmarkerInfos[0] title=北海道登別市役所を原典として使用。center（42.41505619884396,141.1061538）は不使用。現配布本文が中央町6-11の本庁舎1階宿直室と指定する本庁舎建物の点。平日第2庁舎には流用しない。P05の千歳町別住所候補を使わず、市公式が現在の庁舎案内で直接指定するmarkerを採用。背景地図OSMの地物抽出やGoogle応答の抽出ではない。';e=evidence(r,'script[data-map-view-target=setting] JSON markerInfos[0] (not center)',method);a['decision']=method
 elif i==16:
  r=byurl['https://www.e-rumoi.jp/suidou/page26_00039.html'];coord={'lat':43.93876130596552,'lng':141.64699032117065};method='市公式配布本文の留萌プラザ2Fまちなか賑わい広場・開運町3-4-11の節に直結するiframe srcのq数値をそのまま使用。市役所分庁舎や蓋の点ではない。Google地図応答は取得・転用せず、市がHTML本文に直接指定した配布建物マーカーを独立原典とした。建物代表点で室内2階位置は主張しない。';e=evidence(r,'「カード配布について」直後 div.g_map > iframe[src] の q=43.93876130596552,141.64699032117065',method);a['decision']=method
 elif i==14:
  r=next(r for r in rs if '/2235/resource/8288/' in r['url']);rows=list(csv.DictReader((ROOT/r['snapshotPath']).read_text(encoding='utf-8-sig').splitlines()));row=next(x for x in rows if x['ID']=='PF0000000001');coord={'lat':float(row['緯度']),'lng':float(row['経度'])};method='富良野市作成2025-07-17公共施設一覧のPF0000000001「富良野市複合庁舎」弥生町1-1、緯度経度原値。現配布案内は市役所1階総合窓口、新庁舎案内は2022-09-26開庁。旧P05でなく新庁舎建設後の市自身の施設レコードを照合し、庁舎建物代表点として提案。別レコードの総合保健センターとは分離。CSVに測地系明記はないためJGD2011等の保証は付さず、自治体標準オープンデータの緯度経度として使用。住所ジオコードもGoogle応答の付け替えも行っていない。';e=evidence(r,'CSV ID=PF0000000001（データ行1）、名称・所在地_連結表記・緯度・経度',method);a.update(rawRow=row,decision=method)
 elif i==56:
  r=next(r for r in rs if r['url'].endswith('.xlsx'));ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'};book=zipfile.ZipFile(ROOT/r['snapshotPath']);root=ET.fromstring(book.read('xl/worksheets/sheet1.xml'));cells={c.attrib['r']:c.find('m:v',ns).text for c in root.findall('.//m:c',ns) if c.find('m:v',ns) is not None};coord={'lat':float(cells['K12']),'lng':float(cells['L12'])};method='剣淵町が公開する公共施設一覧のID0000000011・剣淵町絵本の館・緑町15番3号・電話0165-34-2624を現配布本文/施設案内と照合。隣接資料館（15番4号、別レコード）を区別した施設名付き建物代表点として提案。Excel K12/L12の緯度経度原数値を使用。測地系明記はないため特定EPSGの保証は付さない。公式アクセスの住所ジオコードや第三者ROOFTOP値は使用していない。';e=evidence(r,'xl/worksheets/sheet1.xml row12 (ID0000000011), K12 latitude / L12 longitude',method);a.update(rawCells={'K12':cells['K12'],'L12':cells['L12']},decision=method)
 else:
  cat,reason,needed=reasons[i];unresolved.append({'facilityId':t['facilityId'],'reasonCategory':cat,'reason':reason,'nextSource':{'url':urls[0] if urls else None,'needed':needed},'investigationStatus':'new-investigation','attempts':attempts});a.update(decision=reason,reasonCategory=cat);audit.append(a);continue
 updates.append({'facilityId':t['facilityId'],'coordinate':coord,'scope':'building','evidence':e});a.update(coordinate=coord,evidence=e);audit.append(a)
save(ROOT/'data/national/issue7/hokkaido.json',{'schema':1,'updates':updates,'unresolved':unresolved,'corrections':[]})
save(D/'candidate-audit.json',audit)
originalmetadata={r['snapshotPath']:r for r in read('data/evidence/issue5/north/original-records.json')}
for path,r in oldrefs.items():
 if r.get('fetchedAt') is None and path in originalmetadata:
  r['fetchedAt']=originalmetadata[path].get('fetchedAt');r['retrievalRecord']='data/evidence/issue5/north/original-records.json';r['savedAt']=originalmetadata[path].get('savedAt')
save(D/'reused-originals.json',list(oldrefs.values())+[{'snapshotPath':P05,'snapshotSHA256':sha(ROOT/P05),'sourceUrl':PURL,'metadataPath':'data/evidence/issue5/chubu/P05-22_GML.zip.source.json','fetchedAt':read('data/evidence/issue5/chubu/P05-22_GML.zip.source.json').get('fetchedAt')}])
save(D/'p05-extraction.json',{'snapshotPath':P05,'snapshotSHA256':sha(ROOT/P05),'member':'P05-22_01_GML.zip!P05-22_01.geojson','memberSHA256':hashlib.sha256(raw).hexdigest(),'crs':geo.get('crs'),'records':[{'featureIndex':i,'feature':geo['features'][i]} for i in sorted(set(selected.values())|{1741,2758,2816,3238,3263,1453,3534})]})
print(f'{len(updates)} updates, {len(unresolved)} unresolved, {len(audit)} total')
