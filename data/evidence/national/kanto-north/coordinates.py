# Explicitly inspected destination/marker coordinates. Ordinals refer to immutable relations.
COORD={}
def p(cid,indices,url,lat,lng,locator):
 for i in indices:COORD[(cid,i)]={'url':url,'lat':lat,'lng':lng,'locator':locator}
p('08-203-J001',[0],'https://www.city.tsuchiura.lg.jp/kanko-bunka-sports/jitenshanomachi/cyclist-support-spot/page011935.html',36.0834681127865,140.213162899017,'りんりんポート土浦／所在：川口二丁目13番25号／google.maps.Marker.position（centerのみではない）')
p('08-205-B001',[0],'https://www.ibaraki-shokusai.net/shop/shops3?id=7383',36.212134195427836,140.17356389895616,'Yasato de toreta マーケット／下青柳200番地／maps/embed/v1/place?q=地点')
p('08-207-A001',[0],'https://www.city.yuki.lg.jp/kurashi-tetsuzuki/suidou-gesuidou/gesuidou/page005290.html',36.3038966512035,139.878222048283,'結城蔵美館／結城市大字結城1330／google.maps.Marker.position')
p('08-211-A001',[0],'https://www.city.joso.lg.jp/kurashi_gyousei/kurashi/shisetsu_koukyou/facility/tiikikoryu/page001373.html',36.11333014520762,139.97964883544321,'地域交流センター（豊田城）／新石下2010番地／地図リンクq=')
p('08-212-A001',[0],'http://www.kanko-hitachiota.com/page/page000428.html',36.531275,140.52766599999995,'観光案内センター／山下町998-23（常陸太田駅駅舎内）／google.maps.Marker.position')
p('08-224-A001',[0],'https://www.city.moriya.ibaraki.jp/kurashi_tetsuzuki/suido/1002264/1002265.html',35.948963,139.980445,'上下水道事務所 上下水道課／百合ケ丘二丁目2734番地の1を表示する住所リンクmaps?q=。休日の市役所には適用しない')
p('08-230-A001',[0],'https://www.city.kasumigaura.lg.jp/page/page002376.html',36.0700103,140.3747111,'かすみがうら市交流センター（畔の駅コハン）／坂4784番地先／地図を見る：かすみがうら市交流センター q=')
p('09-210-B001',[0],'https://www.ohtawara.info/access.html',36.862750867787,140.12151181697845,'大田原市観光協会（大田原市観光交流センター内）／黒羽田町848／beachMarker.position=myLatLng')
p('10-203-A001',[0],'https://www.city.kiryu.lg.jp/shisetsu/kankou/1016644.html',36.4110334,139.3386417,'シルクル桐生／本町5丁目354番地／施設案内の地図を表示する q=')
p('10-204-A001',[0],'https://www.city.isesaki.lg.jp/soshiki/keizai/shoko/machinakakaseika/1588.html',36.327052,139.191989,'伊勢崎駅前インフォメーションセンター／曲輪町8番地1／地図リンクq=')
p('10-206-B001',[0],'https://www.oigami.net/access/',36.67120432762694,139.20979625216566,'老神温泉観光協会・旅館組合／利根町老神607-1／現在地からのルート検索destination=')
p('10-524-A001',[0,1],'https://www.town.oizumi.gunma.jp/s008/map/010/20200702101003.html',36.24975390112513,139.4072365255478,'大泉町役場（新庁舎）／日の出51番1号／施設案内GoogleMAP?q=。211窓口・総合案内は室内位置で別管理')
p('11-232-A001',[0,1],'https://www.city.kuki.lg.jp/shisei/shisetsu/shiyakusho/1006530.html',36.100144729547225,139.66708653097848,'鷲宮行政センター／鷲宮6丁目1番1号／鷲宮行政センター案内図q=。下水道施設課・警備員室は別窓口')
p('11-232-B001',[0,1],'https://www.city.kuki.lg.jp/shisei/shisetsu/shiyakusho/1006529.html',36.12624351057289,139.6968484285947,'栗橋行政センター／間鎌251番地1／栗橋行政センター案内図q=。総務人権係・警備員室は別窓口')
p('11-235-A001',[1],'https://www.city.fujimi.saitama.jp/madoguchi_shisetsu/01shisetsu/siyakysho/2010-0510-1001-142.html',35.8567586,139.5490737,'富士見市役所／鶴馬1800番地の1／q=富士見市役所@35.8567586,139.5490737。分館3階の窓口へは適用しない')
