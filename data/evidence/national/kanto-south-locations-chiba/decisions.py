# AI-reviewed facility identity and numeric source selections. No network calls.
D={}
def add(i,url,lat,lng,locator,scope='building'):
 D[i]={'url':url,'lat':lat,'lng':lng,'locator':locator,'scope':scope}
add(0,'https://maruchiba.jp/barrierfree/spot/detail_10051.html',35.714712,139.932941,'千葉県立現代産業科学館／市川市鬼高1-1-3。iframe place q と経路目的地。')
add(3,'https://wwwp.pref.chiba.lg.jp/pbbfmap/facility/4088',35.61815574417165,140.06481806240333,'BOTANICA MUSEUM／高浜7-2-4。施設固有location PointとGoogle Maps query。公園全体の地図は棄却。')
add(4,'https://maruchiba.jp/feature/detail_89.html',35.729757,140.8273515,'銚子観光案内所／西芝町1438（JR銚子駅構内）。li[data-marker-title="銚子観光案内所"] data-marker-lat/lng。観光協会 https://www.choshikanko.com/kankoDB/0109/ の名称住所と照合。')
csv='https://www.city.ichikawa.lg.jp/uploaded/attachment/53042.csv'
add(5,csv,35.72257083,139.9279823,'名称=旧八幡市民談話室、所在地=八幡2丁目4-8、緯度・経度列。市の2021-03-23移転発表 https://www.city.ichikawa.lg.jp/uploaded/attachment/3513.pdf p1 は同建物1階を明示。現行施設案内 https://www.city.ichikawa.lg.jp/page/2304.html と住所照合。旧市川駅前案内所には割り当てない。')
add(6,csv,35.76845712,139.9704539,'名称=観賞植物園、所在地=市川市大町213-11、緯度・経度列。園の公開施設点であり園内受付位置ではない。','facility')
add(7,csv,35.68527961,139.9167271,'名称=行徳図書館、所在地=末広1丁目1-31、緯度・経度列。配布は2階、座標は図書館の建物代表点。施設ページの行徳支所マーカーは隣接する別施設のため棄却。')
add(8,csv,35.71545829,139.9320268,'名称=中央図書館、所在地=鬼高1丁目1-4生涯学習センター（メディアパーク市川）、緯度・経度列。')
add(9,'https://www.city.funabashi.lg.jp/shisetsu/shiyakusho/shiyakusho/0001/0001/p011000.html',35.694552,139.982539,'市役所本庁舎／湊町2-10-25。地図リンクq。配布窓口5階とは区別した建物代表点。')
add(11,'https://maruchiba.jp/feature/detail_89.html',34.99576415129914,139.86220974788517,'li[data-marker-title="館山市観光協会 館山駅東口観光案内所"] data-marker-lat/lng。市カード案内 https://www.city.tateyama.chiba.jp/gesui/page100037.html が東口・北条1879-2と指定。県特集の東口節の住所括弧は「西口」と食い違うため括弧は根拠にしない。東口と西口は別マーカー。')
add(12,'https://maruchiba.jp/spot/detail_10427.html',34.989632,139.854799,'"渚の駅"たてやま／館山市館山1564-1。施設詳細GeoCoordinates、place q、経路目的地が一致。複合施設の公開目的地点であり個別棟・受付位置は未確定。市の蓋設置地図は使用しない。','facility')
add(13,'https://maruchiba.jp/feature/detail_89.html',34.99565648594261,139.86158747539372,'li[data-marker-title="館山市観光協会 西口観光まちづくりセンター"] data-marker-lat/lng。北条1879-2、レンタサイクル窓口。観光協会 https://tateyamacity.com/citycycle-rental と https://tateyamacity.com/archives/4093 の西口案内所表記、元台帳のたてチャリ窓口を照合。市カードページのつばきファクトリー地図は蓋設置位置なので棄却。')
add(14,'https://www.city.kisarazu.lg.jp/soshiki/toshiseibi/shitasuidosuishinshitsu/5/1684.html',35.381555,139.925199,'木更津市観光案内所（GoogleMap）リンクの!3d/!4d目的地。URLの/@表示中心ではない。富士見1丁目2番1号。')
add(15,'https://www.google.com/maps/d/kml?mid=1wiRu2WXxoY3B-ioeNuz9MNx6jksSvqM&forcekml=1',35.7848289,139.8980997,'観光協会公式 https://www.matsudo-kankou.jp/access/ が埋め込む公開My MapsのKML。Document=松戸駅から観光案内所へ、Placemark/name=松戸観光案内所、Point/coordinates（経度,緯度,高度）。徒歩経路LineStringではない。本町7-3と照合。')
add(16,'https://wwwp.pref.chiba.lg.jp/pbbfmap/facility/1658',35.78244551207901,139.899258585949,'松戸市文化ホール／松戸1307-1松戸ビルヂング4階。施設公開PointとGoogle Maps query。4階の室内点ではない。')
for i in [17,18]:add(i,'https://www.city.noda.chiba.jp/shisetsu/shiyakusho/access.html',35.955104,139.874814,'野田市役所／鶴奉7番地の1。施設地図q。配布案内では高層棟6階下水道課と1階守衛室。別窓口IDを維持した庁舎代表点。')
add(19,'https://www.chiba-muse.or.jp/SEKIYADO/visit/page-1519065141259/',36.1005348,139.7827015,'県立関宿城博物館／関宿三軒家143-4。ページ下部住所に付くmapリンクの!3d/!4d。アクセス本文内の旧リンク36.1002253,139.7822838と相違があり、現在の住所付き施設リンクを採用。')
add(22,'https://maruchiba.jp/corporate/material/detail_10257.html',35.577405,140.383011,'道の駅みのりの郷東金／田間1300-3。施設詳細place qと経路目的地。施設代表点であり敷地内カウンターの測量位置ではない。','facility')
add(24,'https://wwwp.pref.chiba.lg.jp/pbbfmap/facility/1893',35.675339,140.005302,'谷津干潟自然観察センター／習志野市秋津5-1-1。施設location PointとGoogle Maps query。谷津干潟全体ではない。')
add(26,'https://maruchiba.jp/feature/detail_89.html',35.8617921,139.9708973,'li[data-marker-title="柏市観光案内所 まるっと柏"] data-marker-lat/lng。本文所在地柏1-1-11ファミリかしわ3Fと公式観光協会現行住所を照合。')
add(27,'https://www.city.nagareyama.chiba.jp/institution/1028492/1021196.html',35.872872,139.925134,'流山おおたかの森駅前観光情報センター／おおたかの森北1-2-1スターツおおたかの森ホール2階。施設詳細q、階位置ではなく建物代表点。')
add(28,'https://maruchiba.jp/spot/detail_10469.html',35.854828,140.121201,'旧井上家住宅／我孫子市相島新田1。施設GeoCoordinates、place q、経路目的地。住宅敷地の公開施設代表点であり9棟のうち受付の建物までは示さない。','facility')
add(32,'https://www.city.urayasu.lg.jp/shisetsu/shikanren/shiyakusho/1005488.html',35.653053,139.901982,'浦安市役所／猫実1-1-1。施設詳細q。1階守衛室の建物代表点。旧道路整備課や新治水課の関係変更はしない。')
add(33,'https://www.city.urayasu.lg.jp/shisetsu/bunka/1005586.html',35.655244,139.901173,'浦安市郷土博物館／猫実1-2-7。施設詳細q。')
add(42,'https://www.fuwarishibayama.com/share/js/map.js',35.695083,140.410101,'公式アクセス https://www.fuwarishibayama.com/access/index.html が読み込むJS。myLatlngをpositionとするtitle=道の駅 風和里しばやまのMarker。myLatlng2（空の駅）・centerLatLng（表示中心）と区別。小池2568の施設代表点。','facility')
for i in [43,47]:add(i,'https://www.vill.chosei.chiba.jp/map/xml/3.xml',35.4122327,140.3540473,'村の施設マップ https://www.vill.chosei.chiba.jp/map/map1/map2.html が読む村役場カテゴリ3.xml。名称=長生村役場、説明=本郷1-77、施設座標。保健センターとは別地点。')
add(45,'https://wwwp.pref.chiba.lg.jp/pbbfmap/facility/2404',35.412157,140.353527,'長生村保健センター／本郷1-77。施設location PointとGoogle Maps query。住所が同じ村役場とは別の施設点。')
# Approved, explicitly named Google embed entity markers, not viewport parameters.
EMBEDS={1:('http://www.chibacity-ta.or.jp/spots/ctic','千葉市観光情報センター'),2:('https://www.chibacity-ta.or.jp/spots/mtic','千葉市幕張観光情報センター'),10:('https://mitsui-shopping-park.com/lalat-tokyobay/access/','ららテラスTOKYO-BAY'),20:('https://www.city.sakura.lg.jp/section/museum/access.html','市立美術館'),29:('https://www.abikoinfo.jp/user-guide/','我孫子インフォメーションセンター'),36:('https://www.city.yachimata.lg.jp/soshiki/26/54793.html','八街市第3庁舎'),40:('https://www.city.oamishirasato.lg.jp/0000005447.html','中央公民館'),41:('https://www.town.shibayama.lg.jp/0000001426.html','芝山町役場'),44:('http://www.chosei-bunkahall.jp/','長生村文化会館'),46:('https://chosei-koryu.com/','長生村交流センター')}
add(30,'https://www.city.kamagaya.chiba.jp/web/Gmaps/data/1_office.xml',35.776801,140.00081,'市公式地図のSisetu/Name=鎌ケ谷市役所、Content/Address=新鎌ケ谷2-6-1、Data/Position/Latitude,Longitude。localmap.jsがこのPositionでMarkerを生成することを確認。施設ページURLのlat=35.780901はviewport中心なので使用しない。')
add(31,'https://www.city.kamagaya.chiba.jp/web/Gmaps/data/14_kyodo.xml',35.772923,139.999954,'市公式地図のSisetu/Name=郷土資料館、Content/Address=中央1-8-31、Data/Position/Latitude,Longitude。施設ページURLのlat=35.777024,lng=140.001364はviewport中心なので使用しない。')
REASONS={
21:'佐倉ふるさと広場の公式施設詳細は広場全体の名称検索と表示中心のみ。佐蘭花（管理棟・売店）の独立した公開数値位置を確認できず、風車・公園の点を受付棟へ転用しない。',
23:'企業局公式アクセスには企業局全体のGoogle目的地はあるが、配布先の「新館3階」とその目的地が示す棟の対応が未確定。敷地内の旧館・新館を区別する数値根拠が不足するため採用しない。',
25:'現行上下水道局庁舎ページで千代田1丁目2番32号・総務課3階を確認したが、地図はPDF案内図。建替え後の庁舎の公開数値目的地点を確認できないため、旧水道部の位置や画像からの推定を採用しない。',
34:'現行公式事務室案内は中袖4番地の終末処理場管理棟2階を明示するが、位置は画像案内図・正面入口写真。施設全体と管理棟を区別した公開数値地点が未確認。画像の位置を緯度経度へ捏造しない。',
35:'市公式アクセスは市役所全体と外部そでMAPへの導線。現行南庁舎1階守衛室の棟固有の数値位置を確認できない。庁舎再整備後の複数棟を区別できず市役所代表点を流用しない。',
37:'市公式庁舎アクセスのGoogleマーカーは「八街市役所」で総合保健福祉センターを含む表示。第一庁舎1階受付への棟同定ができない。第三庁舎の座標を同住所の第一庁舎に流用しない。',
38:'白井市公共施設CSVの名称は「白井市役所 本庁舎・東庁舎」で一つの地点。上下水道課は東庁舎2階だが、その地点が東庁舎を表すか未確認。公式フロア図・庁舎案内でも棟別の数値地点を確認できない。',
39:'白井市公共施設CSVの名称は「白井市役所 本庁舎・東庁舎」で一つの地点。本庁舎1階守衛室に対応する棟別の数値地点がない。東庁舎との間を推定して割り当てない。'
}
