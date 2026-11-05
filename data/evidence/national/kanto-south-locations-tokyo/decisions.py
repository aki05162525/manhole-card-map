# AI manual decisions. Numeric coordinates are extracted only from the specified marker.
D={}
def add(i,url,kind,match='',note=''):D[i]=dict(url=url,kind=kind,match=match,note=note)
for i,code in {3:'J0007',6:'J0004',15:'M0019',16:'M0061',23:'M0051',29:'M0119',32:'M0028',33:'M0049',35:'M0032',37:'M0227',42:'M0120',45:'M0614',57:'M0254',62:'M0047',63:'M0070',78:'M0059',98:'M0009',101:'M0023'}.items():add(i,'https://tokyotouristinfo.com/detail/'+code,'destination')
add(38,'https://www.city.shibuya.tokyo.jp/shisetsu/bunka-shisetsu/bunka-shisetsu/sk4_sendagaya.html','geo')
add(40,'https://www.toshima-mirai.or.jp/center/a_kumin/','marker')
for i,u in {
44:'https://www.city.adachi.tokyo.jp/chosha/shisetsu/kuyakusho/001.html',
51:'https://www.city.tachikawa.lg.jp/shisetsu/1019988/1008299.html',
52:'https://www.city.tachikawa.lg.jp/shisetsu/1019988/1008299.html',
71:'https://www.city.hino.lg.jp/shinsenr/1022769/index.html',
72:'https://www.city.kokubunji.tokyo.jp/shisetsu/shikanren/shiyakusyo/shiyakusyo.html',
73:'https://www.city.kokubunji.tokyo.jp/shisetsu/shikanren/hall/1017572.html',
79:'https://www.city.fussa.tokyo.jp/map/shiyakusho/1001595.html',
80:'https://www.city.higashiyamato.lg.jp/shisei/shiyakusho/1007209.html',
81:'https://www.city.higashiyamato.lg.jp/shisei/shiyakusho/shisetsu/city/1006827.html',
82:'https://www.city.kiyose.lg.jp/shisetsu/sisetu/1001180.html',
83:'https://www.city.higashikurume.lg.jp/shisetsu/shikanren/hall/1002036.html',
85:'https://www.city.higashikurume.lg.jp/shisetsu/shakai/1002046.html'}.items():add(i,u,'q')
add(53,'https://www.city.tachikawa.lg.jp/kanko/shogai/1003065/1003069.html','place','女性総合センター')
add(55,'https://www.musashino.or.jp/place/1001617/1001943.html','place','武蔵野プレイス')
add(59,'https://www.city.ome.tokyo.jp/soshiki/25/72544.html','place','青梅観光案内所')
add(66,'https://machida-guide.or.jp/gallery/','place','町田ツーリストギャラリー')
add(87,'https://www.city.inagi.tokyo.jp/kanko/miryoku/1010492/1013753/1010317.html','place','ペアテラス')
add(97,'https://www.hinodekanko.jp/アクセス-問合せ/','place','日の出町観光協会')
add(1,'https://www.ur-net.go.jp/chintai/kansai/osaka/counter/senri/','searchpoint',note='ll表示中心ではなく同ページのGoogle Mapsで見る /maps/search/座標を採用。')
add(7,'https://machihon.tokyo/bookstore/317/','place','第一書林',note='東京都書店商業組合の店舗案内。')
add(11,'https://magazine.metro.tokyo.lg.jp/libraries/view/211','library')
add(25,'https://www.city.edogawa.tokyo.jp/documents/4408/20251211_bunka.csv','csv','篠崎文化プラザ')
add(26,'https://www.city.edogawa.tokyo.jp/documents/4408/20251211_bunka.csv','csv','北小岩コミュニティ会館')
for i,u in {28:'https://www.city.kita.lg.jp/city-information/facilities/1015927/1018349/1015939.html',41:'https://www.city.kita.lg.jp/children-edu/adult-learning/1010206/1010227/1010228.html',74:'https://www.city.kokubunji.tokyo.jp/shisetsu/kouen/1005196/1004238.html',75:'https://www.city.kokubunji.tokyo.jp/shisetsu/shikanren/hall/1003837.html'}.items():add(i,u,'q')
add(94,'https://tokyotouristinfo.com/detail/M0558','destination')
add(100,'https://www.opendata.metro.tokyo.lg.jp/soumu/130001_evacuation_center.csv','evaccsv','郷土資料館',note='東京都提供の「避難所、避難場所データ オープンデータ」を利用。檜原村3221の郷土資料館行。')
for i,u,short in [(24,'https://www.gotokyo.org/jp/plan/japanese-prefectural-tourism-promotion-corner/index.html','https://goo.gl/maps/twZuPCCkryPn8SXy9'),(54,'https://musashino-kanko.com/','https://maps.app.goo.gl/nZxwGnBsD3iCK11cA'),(95,'https://mizuhokyodo.jp/access/','https://maps.app.goo.gl/wFARoCGfUAY5zTdM8')]:add(i,u,'redirect',short)
D[54]['url']='https://musashino-kanko.com/outline/officeinfo/'
for i,u in {9:'https://www.city.shinagawa.tokyo.jp/shisetsu/bunkasportsshisetsu/1008222/1008231.html',30:'https://www.city.katsushika.lg.jp/institution/1030225/1030226/1006815.html',50:'https://www.city.tachikawa.lg.jp/shisetsu/1008075/1008295.html',76:'https://www.city.kunitachi.tokyo.jp/machi/machizukuri/3/6093.html',77:'https://www.city.kunitachi.tokyo.jp/soshiki/Dept08/Div03/Sec01/shisetsu/0098/1463551618027.html'}.items():add(i,u,'q')
add(49,'https://tokyotouristinfo.com/detail/M0045','destination')
add(60,'https://www.city.ome.tokyo.jp/map/14255.html','query')
add(67,'https://www.opendata.metro.tokyo.lg.jp/koganei/01_koukyoushisetsu.csv','standardcsv','第二庁舎')
for i in [64,65]:add(i,'https://www.city.machida.tokyo.jp/shisei/opendata/shisetsu/public_facility.files/132098_public_facility.csv','standardcsv','町田市役所',note='市公開施設データ。番地以下の単独列には日付形式化があるため、名称および所在地_連結表示を照合。')
add(90,'https://www.city.akiruno.tokyo.jp/cmsfiles/contents/0000015/15465/132284_public_facility2022-2.csv','standardcsv','あきる野市役所')
add(88,'https://www.city.hamura.tokyo.jp/map/xml/14.xml','xmlmarker','郷土博物館',note='同市jquery.GoogleMaps2.jsがPlacemark内latitude/longitudeをCreateMarkerのpositionに使用することを確認。StartLookAt表示中心ではない。')
add(91,'https://akiruno.town-info.com/irodori/','iframeq',note='あきる野商工会運営の事業者詳細にあるembed/v1/placeの数値q。')
add(48,'https://sst8.jp/','jsmarker',note='サザンスカイタワー八王子の公式建物マーカー。アクセスページのマーカーは経度が約36m異なるが、同一建物の公開代表点としてトップの値を採用。7F窓口の位置精度を示さない。')
for i,aid in {21:'200029460',27:'281140021',36:'281110733',39:'281150090',43:'281210885',61:'282060083',69:'282110054',86:'282240157',96:'283050023',99:'283070017'}.items():add(i,'https://www.digitalservice.metro.tokyo.lg.jp/documents/d/digitalservice/toitsudb_202609','asset',aid,note='東京都デジタルサービス局・都区市町村保有アセットデータベース2026年9月24日版の種別=建物。台帳名称と所在地を配布施設に照合。土地の代表点は使わない。')
add(31,'https://udx.jp/access/','routeend',note='公式アクセス内の車経路embedの終点ブロック（秋葉原UDX AKIBA ICHI、外神田4-14-1）の!3m2!1d緯度!2d経度。二経路の終点一致。最初の!1m3表示中心とは区別。2F窓口でなく建物の地点。')
