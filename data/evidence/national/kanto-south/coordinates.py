# Explicit destination coordinates inspected in official source; never map viewport/lid values.
C={}
def add(cid,index,url,lat,lng,locator):C[(cid,index)]={'url':url,'lat':lat,'lng':lng,'locator':locator}
add('13-010-A001',0,'https://map.coopdeli.coop/mirai/shop.php?shop_id=30250212',35.664519,139.369101,'コープ高倉店／施設情報、東京都八王子市高倉町49-3、Google Maps q。店舗建物代表点、サービスカウンターの室内位置ではない。')
add('13-100-W001',0,'https://tokyotouristinfo.com/detail/M0319',35.751299,139.803265,'お休み処「千住街の駅」、千住3-69、行き方検索destination。')
add('13-207-A001',0,'https://www.city.akishima.lg.jp/s087/010/010/010/140/010/20190319120320.html',35.713743,139.360724,'配布場所：昭島観光案内所、代官山2-3-6、周辺案内図 q。')
add('13-207-B001',0,'https://www.city.akishima.lg.jp/s087/010/010/010/140/020/20190319120320.html',35.7120019,139.3694126,'配布場所：アキシマエンシス郷土資料室、つつじが丘3-3-15、周辺案内図 q。建物代表点。')
add('13-208-B001',0,'https://www.city.chofu.lg.jp/040070/p026079.html',35.6574967,139.5274776,'市民西調布体育館、上石原2-4-1、Google Maps q。')
add('13-222-B001',0,'https://www.city.higashikurume.lg.jp/shisetsu/sports/1002049.html',35.762262,139.544357,'東京ドームスポーツセンター東久留米、大門町2-14-37、施設名付き地図q。')
add('13-212-B001',0,'https://www.city.hino.lg.jp/shisetsu/shiyakusho/shiyakusho/shisho/index.html',35.66180300372135,139.41357493400574,'七生支所、高幡128-5、地図 q。京王高幡SC建物代表点、2階窓口位置とは区別。')
add('13-212-B001',1,'https://www.city.hino.lg.jp/shisetsu/toshokan/toshokan/1005864.html',35.6588922,139.4134307,'高幡図書館、三沢4-1-12、地図 q。')
add('13-221-A001',1,'https://www.city.kiyose.lg.jp/shisetsu/syogaigakusyu/1001192.html',35.77214121,139.5210671,'生涯学習センター、元町1-2-11、地図 q。アミュー建物代表点、5階窓口とは区別。')
add('13-214-C001',0,'https://www.city.kokubunji.tokyo.jp/shisetsu/shikanren/kouminkan/1003831.html',35.705394,139.482399,'本多公民館、本多1-7-1、地図 q。')
add('13-203-C001',0,'https://www.city.musashino.lg.jp/kurashi_tetsuzuki/bus_churin_chusha_kotsuanzen/mubus/1052084.html',35.703926984847705,139.57995936815195,'配布場所吉祥寺まち案内所（吉祥寺本町1-15-2）の地図 q。休止中でも施設位置は保持。')
add('13-100-I001',0,'https://www.city.suginami.tokyo.jp/shisetsu/sangyo/shoko/1007450.html',35.70178642660007,139.63529074522944,'産業商工会館、阿佐谷南3-2-19、Google Maps q。')
add('13-205-B001',0,'https://www.ja-nishitokyo.or.jp/archives/store_post/shop_greencenter',35.788236130510384,139.2230958294215,'グリーンセンター、青梅市梅郷3-930-1、Googleマップはこちら q。')
add('14-212-A001',0,'https://www.city.atsugi.kanagawa.jp/kurashi_tetsuzuki/gesuido/6/2/12503.html',35.443108022086214,139.36139455872194,'厚木市役所第二庁舎、中町3-17-17、施設名付き地図q。建物代表点、14階窓口とは区別。')
add('14-212-B001',0,'https://www.city.atsugi.kanagawa.jp/kurashi_tetsuzuki/online/4/1/2/11043.html',35.4424764,139.36571080000004,'あつぎ市民交流プラザ、中町2-12-15、施設名付き地図q。アミューあつぎ建物代表点、6階窓口とは区別。')
# Reject Hino 35.679127,139.393956 and Taito spot/1118: explicitly lid installation points.
# Reject Ogai park and Seotonoyu overall campus q: exact reception/shop building not resolved.
add('13-208-A001',0,'http://www.city.chofu.tokyo.jp/www/contents/1176118954796/index.html',35.650645,139.540717,'市役所へのアクセス、小島町2-35-1、Google Maps q。庁舎代表点で2階案内所の室内位置ではない。')
for i in [1,2]:add('12-208-C001',i,'https://www.city.noda.chiba.jp/shisetsu/shiyakusho/1001045.html',36.025873,139.820636,'いちいのホール、東宝珠花237番地1、地図 q。建物代表点を共有する1階道路サービス課と2階図書館を別窓口として保持。')
# Input order is weekday corporation, then weekend Co-op store.
C[('13-010-A001',1)]=C.pop(('13-010-A001',0))
