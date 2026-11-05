from research import *
D={}; attempts={}
def direct(i,u,lat,lng,locator,note):
 D[i]={'url':u,'lat':lat,'lng':lng,'locator':locator,'note':note,'officialUrl':u}
def embed(i,u,note='',which=0):
 rows=json.loads((ROOT/'embed-markers.json').read_text());row=next(r for r in rows if r['officialUrl']==u and r['markers']);m=row['markers'][which]
 D[i]={'url':row['mapUrl'],'lat':float(m[2]),'lng':float(m[3]),'locator':'initEmbed selected place '+m[0]+' / '+m[1]+' / ['+m[2]+','+m[3]+']','note':'公式施設ページのiframe参照先。表示中心でなく施設ID・名称・住所に結び付く明示マーカー。'+note,'officialUrl':u}
def short(i,u,official,note):
 e=cache[u];m=re.search(r'!3d([\d.]+)!4d([\d.]+)',e['finalUrl']);assert m
 D[i]={'url':u,'lat':float(m[1]),'lng':float(m[2]),'locator':'HTTP redirect finalUrl の施設目的地 !3d'+m[1]+'!4d'+m[2],'note':note,'officialUrl':official}
embed(0,'https://www.ina-city-kankou.co.jp/panya/access/')
embed(2,'https://kankou-minamiminowa.nagano.jp/ajikoubou/')
embed(15,'https://kai.library2.city.kai.yamanashi.jp/lib_futaba.html')
embed(24,'https://ueda-kanko.or.jp/spot/kankoukaikan/','建物代表点で2階窓口の測位ではない。')
embed(30,'https://www.ina-city-kankou.co.jp/sakurahotel/access/')
embed(40,'https://www.city.ueda.nagano.jp/soshiki/tkyoiku/1974.html')
embed(46,'https://suwakko-land.com/access/')
embed(65,'https://www.ningyoukan.net/')
embed(69,'https://libnet.city.kofu.yamanashi.jp/lib/accessmap/')
embed(74,'https://www.ina-city-kankou.co.jp/miharashinoyu/access/')
embed(76,'https://kofu-kameyaza.com/access/')
direct(7,'https://www.city.uenohara.yamanashi.jp/map/list.php?ctg01_id=30',35.63003533357661,139.1086208763158,'setMarkers 上野原市役所 / 上野原3832番地','個別施設マーカー配列とmakeMarker呼出を照合。')
direct(47,'https://www.city.kai.yamanashi.jp/map/9312.html',35.66079337231275,138.51524307272317,'竜王図書館 所在地篠原2610-12 / initlat,initlong','同ドメイン /ssi/js/shisetsu-detail-googlemap.js のmarkerOpts.positionで施設マーカーに使用。')
direct(77,'https://www.town.karuizawa.lg.jp/map/m6730.html',36.341413059633894,138.54747715529595,'追分宿郷土館 / 追分1155-8 / initlat,initlong','同ドメイン /ssi/js/shisetsu-detail-googlemap.js のmarkerOpts.positionで施設マーカーに使用。')
direct(58,'https://www.city.chino.lg.jp/map/kankoannaijyo.html',35.994356,138.152132,'茅野市観光案内所 / ちの3506 モンエイトビル2階 / initlat,initlong','公式地図のmarkerOpts.positionへの利用を別保存のJSで検証。')
direct(55,'https://www.city.minami-alps.yamanashi.jp/sisetsu/shisetsu/michinoeki-shirane/',35.637698,138.47101,'Googlemaps_Map.setMarkers name=道の駅しらね loc=[138.47101,35.637698]','在家塚595-1情報館を同定。道路北側の直売所587-1と区別。')
direct(50,'https://www.inacity.jp/shisetsu/shiyakusho_shisho/inashiyakusho.html',35.8274607,137.9539919,'伊那市役所周辺地図リンク !3d35.8274607!4d137.9539919','下新田3050の本庁舎。')
direct(44,'https://www.city.chikuma.lg.jp/soshiki/shogaigakushu/togurasouzoukan/2094.html',36.486011,138.148233,'地図はこちら / !3d36.486011!4d138.148233','戸倉2305-1の戸倉創造館。')
for i in [10,43]:direct(i,'https://www.town.nagano-takamori.lg.jp/docs/12584.html',35.5519427,137.8789876,'高森町教育委員会 / !3d35.5519427!4d137.8789876','下市田2183-1の教育委員会・図書館配布場所の見出し直下の地図。役場本体の座標と共用しない。')
short(21,'https://maps.app.goo.gl/EzHYgjRudfEbd8Km8','https://www.vill.okuwa.lg.jp/','公式フッター役場までのアクセス。長野880-1を照合。')
short(42,'https://maps.app.goo.gl/whmiCGUbg3bjRPQK9','https://www.town.fujikawaguchiko.lg.jp/ka/info.php?if_id=6910&ka_id=15','配布施設の地図。蓋リンク2hsaeZVQWVoQVVbn9とは区別。')
short(51,'https://maps.app.goo.gl/jYZV81JSDuP1WgEe6','https://www.town.fujikawaguchiko.lg.jp/ka/info.php?if_id=6911&ka_id=15','道の駅かつやまの施設地図。蓋リンクKZftgnE8kZoiFRux9とは区別。')
short(20,'https://maps.app.goo.gl/wcWKSfiT82iQxcXB6','https://www.town.fujikawaguchiko.lg.jp/ka/info.php?if_id=6947&ka_id=15','西湖2068の施設地図。蓋リンクRNvgeBt7aF5fFyub8とは区別。')
embed(25,'https://www.vill.chikuhoku.lg.jp/docs/377.html','西条4195の役場。坂井の教育委員会マーカーを使わない。')
embed(5,'https://www.city.azumino.nagano.jp/soshiki/32/67732.html')
embed(6,'https://komoroplaza.com/?page_id=368','こもろプラザ1階の図書館。市役所棟に転用しない。')
for i in [22,41]:embed(i,'https://www.city.iida.lg.jp/soshiki/160/time.html','大久保町2534の本庁舎。蓋設置地点とは独立。')
embed(68,'https://www.shingenmuseum.com/')
direct(1,'https://www.town.karuizawa.lg.jp/map/list/list142.html',36.34853654192297,138.59710599049842,'setMarkers 軽井沢町役場 / 長倉2381番地1','施設名・住所付きマーカーの生成を照合。')
direct(3,'https://www.city.uenohara.yamanashi.jp/map/list.php?ctg01_id=41',35.622133522484056,139.11670738092687,'setMarkers 上野原市地域活性化施設-ふらっと上野原- / 新田946','施設名・住所付きマーカーの生成を照合。')
direct(4,'https://raidenkurumi.jp/pages/121/',36.3557148,138.37389729999995,'アクセス情報 / 滋野乙4524-1 / map q=36.3557148,138.37389729999995','施設公式の数値目的地qと同ページのJSON-LD geoを照合。')
direct(48,'https://www.city.saku.nagano.jp/kanko/kanko/balloon_fes_2026/sponsoredevent.html',36.2361803,138.4407532,'道の駅 ヘルシーテラス佐久南 / iframe q=36.2361803,138.4407532','施設公式の伴野7-1と市の施設名付き目的地を照合。レストラン四季の彩の別マーカーと区別。')
direct(62,'https://www.city.saku.nagano.jp/kanko/kanko/balloon_fes_2026/sponsoredevent.html',36.2780961,138.4647679,'プラザ佐久 / iframe q=36.2780961,138.4647679','プラザ佐久公式の佐久平駅東1-1（駅併設）と市の施設名付き目的地を照合。')
for i in [18,34]:direct(i,'https://www.city.nakano.nagano.jp/docs/opendata/file_contents/202118_public_wireless_lan.csv',36.741569,138.369214,'CP932 CSV / NO=0000000001 / 中野市役所 / 中野市三好町一丁目3番19号 / 緯度,経度','市公表の公衆無線LAN施設位置。市役所建物代表点として採用しWi-Fi設置箇所や個別窓口の精密位置とはしない。現庁舎案内と住所照合。')
embed(8,'https://www.city.okaya.lg.jp/section/BarrierFree/syousai/232.html')
embed(39,'https://kutsukake-terrace.info/access.html','駅併設くつかけテラス内案内所。中軽井沢駅建物の代表点として採用。')
for i in [12,31]:embed(i,'https://www.city.azumino.nagano.jp/soshiki/7/10784.html','豊科6000の現本庁舎を確認。休日窓口も建物代表点に留める。')
