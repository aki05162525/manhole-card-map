"""Offline output from explicitly reviewed decisions and individual unresolved findings."""
import json,pathlib,hashlib,datetime,urllib.parse,re
ROOT=pathlib.Path(__file__).parent
OUT=pathlib.Path('data/national/location-updates/north-hokkaido.json')
targets=json.load(open(ROOT/'targets.json')); decisions=json.load(open(ROOT/'decisions.json')); manifest=json.load(open(ROOT/'manifest.json')); byurl={e['url']:e for e in manifest}
# These findings apply only to the listed facilities, including separate indoor counters.
findings=[
('わっさむ町食', ['https://www.town.wassamu.hokkaido.jp/industrial-development/commerce-tourism/attractions/wassamu-foodandtouristinformation/','https://www.town.wassamu.hokkaido.jp/affairs/city-building/guest-house-hidamari/'], '町公式施設案内で交流施設ひだまり内・字北町200番地を確認。施設紹介とアクセスガイドに当施設の数値マーカーを見いだせず、公的施設DBにも当該名称・住所の対応点なし。役場の点は別施設のため使わない。'),
('足寄下水終末', ['https://www.town.ashoro.hokkaido.jp/d1w_reiki/H343901010016/print.html','https://www.town.ashoro.hokkaido.jp/kurashi/kurashi-tetsuzuki/jogesuido/page_7.html'], '条例で足寄下水終末処理場・共栄町120番地の5を確認。公式の処理場位置案内はPDF画像へのリンクで、採用可能な数値の目的地点を確認できない。町役場・他の処理施設点は不採用。'),
('大通公園', ['https://odori-park.jp/access/','https://www.sapporo.travel/info/about/informationcenter/?lang=ja'], '公園管理者と公式観光案内で西7丁目インフォメーション／西3丁目観光案内所をそれぞれ確認。アクセス地図は公園全体のll表示中心で個別窓口のマーカー座標ではない。公園代表点も不採用。'),
('花の拠点', ['https://hanafuru.jp/access.html','https://hanafuru.jp/contact.html'], '施設公式はセンターハウスを南島松828-3と記載するが台帳／水道配布案内は823-3。公式同士の住所不一致のため保留。アクセス経路の目的地は花ロードえにわ817-18であり、センターハウスへ流用しない。住所訂正は親レビュー対象。'),
('東神楽町役場', ['https://www.town.higashikagura.lg.jp/c2_kurashi/shisetsu/yakuba/','https://www.town.higashikagura.lg.jp/docs/365.html','http://www.town.higashikagura.lg.jp/docs/678.html'], '現公式は複合施設はなのわを案内。公的旧データには同住所の役場点43.696303,142.451571があるが、複合施設整備後の該当棟との照合が不十分。アクセスiframeは町域のfeatureで役場施設点ではなく不採用。'),
('稚内市役所', ['https://www.city.wakkanai.hokkaido.jp/floor.html','https://www.city.wakkanai.hokkaido.jp/sangyo/kanko/wfc/location.html','https://www.city.wakkanai.hokkaido.jp/access.html'], '2025年建築の新庁舎を公式で確認。旧役場CSVは中央3-13-15、現台帳は中央3-2-1で不一致。新庁舎の室内図・広域アクセスでは当該建物の数値点を確定できず、旧地点を流用しない。ロケーション地図の個別featureは今回未抽出。'),
('留萌市役所', ['https://www.e-rumoi.jp/shisei/rum_00025.html','https://www.e-rumoi.jp/suidou/page26_00039.html'], '市アクセス経路の到着地43.940931,141.636995は市役所本庁の代表点。対象は分庁舎1階の上下水道課で、同敷地の別棟を特定できない。配布案内のq=43.93876130596552,141.64699032117065はるもいプラザ側なので流用不可。'),
('室蘭観光協会', ['https://muro-kanko.com/kyoukai.html','https://muro-kanko.com/access.html'], '協会事務局の海岸町1-5-1を確認。アクセスページには複数の交通地点を扱う地図スクリプトがあるが、協会の建物名・住所と結び付く座標を取得原本から確定できない。市街地・駅代表点を不採用。'),
('道の駅かみしほろ', ['https://www.kamishihoro.jp/place/00000251','https://hokkaido-michinoeki.jp/michinoeki/23227/'], '公式施設案内の地図featureは道の駅かみしほろ、43.2248833,143.2909196、住所は上士幌東3線227-1。台帳は227番地。施設は一致するが現住所の枝番照合・台帳訂正は親レビューに委ね、今回は更新を保留。原本地図応答はmanifestに保存済み。'),
('苫小牧観光案内所', ['https://www.tomakomai-kanko.jp/aboutus.html','https://tomako-mice.jp/locations/tourist-info/'], '施設個別案内に表町5-11-5ふれんどビル1階を確認。取得本文に建物の数値マーカーがない。市役所は別施設。市配布案内のMy Mapsは個別施設featureを今回抽出できず保留。'),
('北見市上下水道局', ['https://www.city.kitami.lg.jp/detail.php?content=8097'], '局の各課・アクセス案内で中ノ島町1丁目4番1号を確認。駅から徒歩の説明と所在地はあるが、当庁舎を指す数値のマーカーを確認できない。常呂総合支所の点とは別。'),
('古平町総合', ['https://www.town.furubira.lg.jp/tourism/detail.php?id=86','https://www.town.furubira.lg.jp/life/detail.php?id=134'], '現公式配布案内のかなえーるは浜町50。北海道役場CSV・施設DBの古平町役場は旧住所浜町40-4で不一致。町への広域アクセスに新複合施設の数値目的地点を確認できないため旧施設点を不採用。'),
('なよろ観光', ['https://nayoro-kankou.com/top/inquiries/','https://yoro-na.com/about/'], '協会問い合わせ先とよろーな公式施設説明で東1条南7丁目1番地10を照合。取得した施設説明・問い合わせ原本に数値の施設点がなく、駅代表点からは確定しない。'),
('絵本の館', ['https://ehon-yakata.com/info/access/','https://www.town.kembuchi.hokkaido.jp/siteseeing/facility/'], '施設公式アクセスの地図はsimplemapでdata-lat/data-lngが空。緑町15番3号の住所ジオコードで表示する実装のため不採用。町公共施設マップも数値施設点を確認できない。'),
('砂川市まちなか', ['https://sunairu.jp/','https://maps.app.goo.gl/FLoLRWuCvfnMRbLF8'], '施設公式短縮リンクは西1条北2丁目1-20の住所featureへ遷移。43.4929982,141.9072378は取得できたが、施設名付きPOIではなく住所の目的地で建物点としての同定が足りず不採用。'),
]
updates=[]; unresolved=[]; review=[]
for d in decisions:
 e=byurl[d['sourceUrl']]
 p=next(p for p in targets if p['id']==d['facilityId'])
 updates.append({'facilityId':d['facilityId'],'coordinate':{'lat':d['lat'],'lng':d['lng']},'evidence':{'sourceUrl':d['sourceUrl'],'snapshotPath':e['snapshotPath'],'snapshotSHA256':e['snapshotSHA256'],'sourceLocator':d['locator'],'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':d['finding']+' 建物・施設の代表点であり、室内窓口の精密位置ではない。AIによる原典照合で現地・人確認ではない。現施設の名称・住所根拠: '+p['evidence']['sourceUrl']+' （原地域snapshot '+p['evidence']['snapshotPath']+' SHA256 '+p['evidence']['snapshotSHA256']+'）。'}})
 review.append(dict(d,legacyIds=p['legacyIds']))
used={x['facilityId'] for x in updates}
for p in targets:
 if p['id'] in used:continue
 matches=[x for x in findings if x[0] in p['name']];assert len(matches)==1,p['name']
 _,urls,reason=matches[0];attempts=[]
 for u in dict.fromkeys([p['evidence']['sourceUrl']]+urls):
  e=byurl[u];attempts.append({'url':u,'result':f"HTTP {e['status']}; "+reason})
 unresolved.append({'facilityId':p['id'],'attempts':attempts,'reason':reason})
 review.append({'facilityId':p['id'],'name':p['name'],'address':p['address'],'legacyIds':p['legacyIds'],'finding':reason,'sourceUrls':urls})
result={'schema':1,'region':'north','updates':sorted(updates,key=lambda x:x['facilityId']),'unresolved':sorted(unresolved,key=lambda x:x['facilityId'])}
OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
(ROOT/'facility-review.json').write_text(json.dumps(sorted(review,key=lambda x:x['facilityId']),ensure_ascii=False,indent=2)+'\n')
print('updates',len(updates),'unresolved',len(unresolved),'targets',len(targets))
