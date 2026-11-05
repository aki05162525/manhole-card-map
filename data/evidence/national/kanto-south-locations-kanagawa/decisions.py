# AI-reviewed decisions; indexes refer only to immutable targets.json saved for this task.
C={}
def add(i,url,lat,lng,locator,scope='building'):
 C[i]=dict(url=url,lat=lat,lng=lng,locator=locator,scope=scope)
add(6,'https://www.city.kawasaki.jp/kawasakiu18/page/0000164395.html',35.53254927428651,139.702867269516,'東海道かわさき宿交流館／本町1-8-4。地図q（llは別値で不採用）。公開施設CSVの同名同住所地点とも約6m以内で整合。')
add(9,'https://www.city.sagamihara.kanagawa.jp/kurashi/shisetsu/bunka_shakai/library_etc/1002757.html',35.55927,139.393061,'博物館、高根3-1-15、地図を表示する q。')
add(11,'https://www.city.yokosuka.kanagawa.jp/2150/thibaudeir.html',35.28298092859072,139.65967290888443,'ティボディエ邸の施設詳細、汐入町1丁目1、Google Maps q。公園全体ではなく当該建物。臨時代替窓口の管理事務所へは移さない。')
add(15,'https://www.city.fujisawa.kanagawa.jp/shisetsu/annai/bunka/037.html',35.340527,139.447856,'藤澤浮世絵館、辻堂神台2-2-2ココテラス湘南7階、地図q。建物代表点。')
add(16,'https://www.city.fujisawa.kanagawa.jp/bunkazai/kouryuukann/open.html',35.346485,139.487271,'ふじさわ宿交流館、西富1-3-3、地図q。')
add(17,'https://www.city.odawara.kanagawa.jp/field/c-planning/water/intro/intro/access.html',35.28798585096686,139.1908282041552,'上下水道局へのアクセス、高田401、地図q/daddr。浄水場全体の推定中心ではなく局庁舎への公式目的地。')
add(19,'https://www.city.odawara.kanagawa.jp/kanko/corridor/castle/p09992.html',35.25061815201822,139.15472018470763,'常盤木門、地図qおよびルート検索daddr。城址公園全体ではなく門建物。')
add(21,'https://maps.app.goo.gl/qZvXqtfc7atVMrQv8',35.3204265,139.3784333,'道の駅公式 https://m-shonanchigasaki.com/ のGoogle MAPリンクの地点 feature !8m2!3d35.3204265!4d139.3784333。@35.3198066,139.3764482はviewportで棄却。施設本文柳島1546-1と名称照合。','facility')
add(26,'https://www.city.atsugi.kanagawa.jp/atsugicitymuseum/access/21168.html',35.495368,139.349488,'あつぎ郷土博物館、下川入1366-4、施設名付きq。配布ページの住所検索llは使用しない。')
add(30,'https://www.city.ebina.kanagawa.jp/shisetsu/kunka/shiryo/1005754.html',35.454227,139.397352,'海老名市温故館、国分南1-6-36、地図q。')
add(32,'https://www.city.ayase.kanagawa.jp/material/files/group/8/koukyousisetu202202.csv',35.437177,139.42616,'市公開「公共施設一覧」CSV seq=0 施設名=綾瀬市役所 所在地=神奈川県綾瀬市早川550番地、緯度/経度列。窓口の階は元配布案内と対応。')
add(33,'https://www.town.hayama.lg.jp/material/files/group/5/87342410.csv',35.272003,139.586361,'町公開AED一覧 名称=葉山町役場 所在地=堀内2135 設置場所=１階町民健康課内、緯度/経度。建物位置に限定し配布窓口・AEDの室内座標とは主張しない。')
add(36,'https://www.town.hayama.lg.jp/material/files/group/5/87342410.csv',35.284582,139.601194,'町公開AED一覧 名称=南郷上ノ山公園 所在地=長柄1888-1 設置場所=事務所入口前、緯度/経度。町公園詳細の管理事務所と配布案内を照合。事務所への公開地点であり公園中心の補間ではない。','office-entrance')
for i in [37,38]:add(i,'https://www.town.nakai.kanagawa.jp/material/files/group/5/sisetsulist.csv',35.33079,139.2188286,'町公開公共施設等一覧、施設名=中井町役場、住所=比奈窪56、緯度/経度列。隣接農村環境改善センターは同番地でも別地点なので混同しない。各階の窓口は建物位置を共有。')
# Public tourism association POIs, matched to municipality/operating tourism office addresses.
add(8,'https://www.japan47go.travel/ja/detail/e146a011-4ebd-4785-83c0-52bb5e2ce26f',35.61684082,139.1897656,'日本観光振興協会の全国観光情報DB、LocalBusiness name=相模湖観光案内所、streetAddress=与瀬1183（相模湖駅前）、geo.latitude/longitude。市配布案内の名称住所と一致。駅ホーム中心からの推定ではない。','facility')
add(25,'https://www.japan47go.travel/ja/detail/a0fb6c4c-f3eb-4fd3-8b84-681c45b66e5a',35.37028971,139.225494,'日本観光振興協会の全国観光情報DB、LocalBusiness name=秦野駅観光案内所、streetAddress=大秦町1-1、geo.latitude/longitude。運営観光協会の秦野駅改札横の案内と市配布案内を照合。室内窓口の精密座標ではない。','facility')
# Google embed source URLs are long; resolve the exact URL from archived parent HTML.
import json,re,html,pathlib
ROOT=pathlib.Path('data/evidence/national/kanto-south-locations-kanagawa')
M=json.loads((ROOT/'manifest.json').read_text())
def embed(i,parent,lat,lng,name):
 pr=next(r for r in M if r['url']==parent)
 s=pathlib.Path(pr['snapshotPath']).read_text()
 us=[html.unescape(v) for v in re.findall(r'<iframe[^>]*src="([^"]+)',s) if 'maps/embed?pb' in v]
 rs=[r for r in M if r['url'] in us and r.get('snapshotPath') and f'[{lat},{lng}]' in pathlib.Path(r['snapshotPath']).read_text()]
 assert len(rs)==1,(i,rs)
 add(i,rs[0]['url'],lat,lng,f'公式施設案内 {parent} から埋込。Google embedレスポンスの施設レコード {name} の直後の[{lat},{lng}]。viewportの先頭3数値とは区別。公式案内の名称・住所・配布先の建物をAI照合。')
embed(1,'https://www.city.yokohama.lg.jp/asahi/madoguchi-shisetsu/kuyakusho/annai/access-parking.html',35.4747743,139.544785,'横浜市旭区役所、鶴ケ峰1-4-12')
embed(18,'https://www.jryscc.co.jp/lusca/odawara/access/',35.2556598,139.1559269,'ラスカ小田原、栄町1-1-9。1階インフォメーションは建物位置を共有')
embed(31,'https://www.zama-kankou.jp/access/',35.4803068,139.4000739,'座間市観光協会、入谷東3-60-5、小田急マルシェ座間Ⅱ2階')
embed(35,'https://www.hayama-station.jp/',35.2881449,139.5958206,'HAYAMA STATION、長柄1583-17。観光協会室内窓口ではなく建物代表点')
embed(41,'https://www.yamakita.net/access/',35.361113,139.080418,'山北町ふるさと交流センター、山北1840-15。観光協会の案内所と所在地を照合')
# MLIT's published named-facility GIS points; exact name/address matches only.
# This is not an on-demand geocoder or a municipality centroid.
P05='https://nlftp.mlit.go.jp/ksj/gml/data/P05/P05-22/P05-22_14_GML.zip'
add(2,P05,35.47484467697792,139.55003436557533,'ZIP P05-22_14.geojson P05_001=14112 P05_003=旭区市民活動支援センターみなくる P05_004=横浜市旭区鶴ケ峰2-82-1 geometry.coordinates=[lng,lat]。市の現行みなくる施設案内・ココロット4階所在地と照合。国交省の施設ポイント、室内窓口精度ではない。','facility')
add(29,P05,35.396031339519574,139.31351027970655,'ZIP P05-22_14.geojson features[1180] P05_001=14214 P05_003=市役所駅窓口センター P05_004=伊勢原市桜台1-1-7 geometry.coordinates=[lng,lat]。市現行施設案内の小田急伊勢原駅南口方面・小田急マルシェ2階と同定。所在地の不足を推測補完したものではなく公開施設地点。','facility')
for i in [39,40]:add(i,P05,35.326701516848516,139.15664581966178,'ZIP P05-22_14.geojson P05_001=14362 P05_003=大井町役場 P05_004=大井町金子1995 geometry.coordinates=[lng,lat]。町配布案内の同名同住所庁舎と照合。町地図一覧のinitlat/initlongは表示中心なので使わない。','facility')
for i in [42,43]:add(i,'https://www.town.aikawa.kanagawa.jp/material/files/group/35/2024_03soudan.csv',35.528818,139.321672,'町公開子どもの相談窓口CSV、児童相談・愛川町子育て支援課・角田251-1の場所_緯度/経度。役場内教育委員会も同一点。広報あいかわ2024年4月号 koho736.pdf PDF6ページ（紙面5）の庁舎案内で子育て支援課・住民課1階、下水道課3階を確認。国交省P05の愛川町役場（角田251-1）地点とも約9mで整合。1階住民課と3階下水道課の室内位置を区別し共通の役場建物位置として採用。')
for i in [44,45]:add(i,P05,35.48233019463441,139.2763758732199,'ZIP P05-22_14.geojson features[1544] P05_001=14402 P05_003=清川村役場 P05_004=清川村煤ヶ谷2216 geometry.coordinates=[lng,lat]。村役場施設詳細・配布案内の本庁舎と照合。同番地せせらぎ館の避難所座標は別施設なので使用しない。','facility')
add(3,'https://www.japan47go.travel/ja/detail/192b5216-6f7a-4769-b3fb-e804f55bf9d3',35.4511374,139.6312274,'日本観光振興協会全国観光情報DBのLocalBusiness 桜木町駅観光案内所／桜木町1-1／045-211-0111、geo.latitude/longitude。市配布先名称住所と一致。営業時間は本調査対象外で採用しない。','facility')
add(20,'https://www.japan47go.travel/ja/detail/4ef140be-042f-4b36-b9f1-2a0b0f45bf26',35.3303068,139.406757,'日本観光振興協会全国観光情報DBのLocalBusiness 茅ヶ崎市観光案内所／元町1-1／0467-82-3986、geo.latitude/longitude。地元観光協会の案内所本文と所在地を照合。','facility')
add(23,'https://www.japan47go.travel/ja/detail/1a08e49c-2ea2-4abc-8b17-767b1236c02d',35.18778076,139.6568178,'日本観光振興協会全国観光情報DBのLocalBusiness 三浦市観光インフォメーションセンター／南下浦町上宮田1450-4／046-888-0588、geo.latitude/longitude。市施設詳細と三浦市観光協会の所在地に一致。市ページのll中心ではない。','facility')
