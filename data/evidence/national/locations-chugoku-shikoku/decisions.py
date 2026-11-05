import json,re,html,urllib.parse,zipfile,io
import research as R
T={x['index']:x for x in json.load(open(R.ROOT/'targets.json'))}
S=json.load(open(R.ROOT/'sources.json'))
decisions=[]
def add(i,url,lat,lng,locator,note):
 decisions.append(dict(index=i,url=url,lat=float(lat),lng=float(lng),locator=locator,note=note))
def q(i,needle,note=''):
 u=next(u for u in S[str(i)] if needle in u)
 txt=urllib.parse.unquote(html.unescape(R.read(R.cache[u])))
 m=re.search(r'[?&](q|query|destination|daddr)=(?:loc:)?(3[3456]\.\d+),\s*(1[23]\d\.\d+)',txt)
 assert m,(i,u)
 add(i,u,m[2],m[3],m[0],note)
def geo(i,needle,note=''):
 u=next(u for u in S[str(i)] if needle in u);txt=R.read(R.cache[u])
 m=re.search(r'"latitude"\s*:\s*"?(3[3456]\.\d+)"?\s*,\s*"longitude"\s*:\s*"?(1[23]\d\.\d+)',txt);assert m,(i,u)
 add(i,u,m[1],m[2],'JSON-LD GeoCoordinates '+m[0],note)
for i,needle in {
4:'detail_1453',6:'stations/views',19:'detail_10025',20:'detail_10366',22:'detail_10300',25:'detail_100880',27:'detail_10745',28:'detail_12968',33:'detail_11175',35:'detail_16167',37:'detail_11455',44:'detail_11748',53:'2746',55:'explore/2994',60:'explore/53/',62:'spot/6680',64:'japan47go',65:'explore/293/',66:'explore/2781',70:'japan47go',77:'japan47go',78:'detail_11060',80:'1009885',82:'99339',83:'detail_15959',84:'detail_16463',87:'detail_17538',92:'detail_18116',95:'detail_17789',108:'facility_506',122:'point/3664',131:'japan47go',142:'stations/views',143:'spot/323',144:'spot/6934',145:'a=180',146:'a=1102',149:'spot/10023',152:'spot/1710',153:'spot/2641',154:'spot/546',156:'spot/80',158:'spot/566',160:'toon-kanko',162:'spot/458',164:'stations/views',168:'id=15822',172:'id=7722',175:'id=7722',178:'search_spot.html?id=16511',179:'stations/views'}.items():
 q(i,needle,{22:'住所欄に併記された新倉敷駅ではなく玉島3-8-25の旧柚木家住宅を同定。新倉敷駅窓口の位置ではない。',78:'庭園公式目的地の施設代表点。受付窓口を個別測量した点ではない。',108:'徳島県のバリアフリー施設詳細で観光情報センターを同定。center値ではなく経路案内daddrを採用。',35:'GREENable HIRUZENの施設目的地。個々の展示棟・窓口の実測ではない。'}.get(i,''))
for i,n in [(12,'46788'),(13,'32473'),(15,'83688')]:geo(i,n,{12:'観光ガイド友の会ページの連絡先が益田市観光協会・駅前町17-2。市の配布案内と同名称住所電話を突合。'}.get(i,''))
add(49,S['49'][0],34.912223,133.947072,'GDMap2施設データ id=354 title=道の駅「くめなん」 lat/lng','自治体の施設名付き地点。')
add(89,S['89'][0],34.015379,131.870881,'staticmap?markers=color:red%7C34.015379,131.870881','上下水道局の施設詳細の明示マーカー。')
for i in [113,114,116]:add(i,S[str(i)][0],34.13376019470086,134.5804595947266,'markerInfos[0] title=松茂町役場 lat/lng','同一庁舎の別窓口IDを維持。centerとは異なる名前付きマーカー。総合会館の地点には転用しない。')
add(139,S['139'][0],34.24984986195823,133.9241686463356,'markerInfos[0] title=綾川町立生涯学習センター','配列内の綾上図書館およびcenterとは区別。')
add(148,S['148'][0],33.2211097,132.5652372,'Google Maps place link !8m2!3d33.2211097!4d132.5652372','宇和島市観光物産協会シロシタ・丸之内5-1-4。リンクの@表示中心ではなく明示施設地点!3d/!4d。')
add(155,S['155'][0],33.770134,132.717616,'meta property="og:latitude,og:longitude" content="33.770134,132.717616"','施設公式の位置メタデータとog:locality下三谷1761-1を突合。')
add(157,S['157'][0],34.012887,133.574478,"new google.maps.Marker position: new google.maps.LatLng('34.012887', '133.574478')",'愛媛県の子育て応援施設情報。名称と川之江町1814-5を市の配布案内と突合。')
add(166,'https://moak.jp/share/js/maps.js',33.561242,133.572944,'initMap latlng; marker = new google.maps.Marker({position: latlng})','美術館公式案内https://moak.jp/guide/のgoogleMaps要素から読み込むJS。案内本文高須353-2と照合。')
for i,u in [(123,'https://www.city.marugame.lg.jp/map/8643.html'),(31,'https://www.city.setouchi.lg.jp/map/406.html'),(32,'https://www.city.setouchi.lg.jp/map/406.html'),(88,'https://www.city.hofu.yamaguchi.jp/map/aspirante.html'),(177,'https://www.city.kami.lg.jp/map/information.html')]:
 txt=R.read(R.cache[u]);lat=re.search(r"var initlat = '([^']+)'",txt)[1];lng=re.search(r"var initlong = '([^']+)'",txt)[1]
 add(i,u,lat,lng,'var initlat/initlong; /ssi/js/shisetsu-detail-googlemap.js markerOpts.position=myLatlng','関連JSのMarker生成まで確認。'+('美術館は牛窓庁舎3・4階と公式来館案内に明記。建物地点を共有する。' if i==31 else ''))
# Independently reviewed official facility records. Current address checks are retained in sources.json.
P05={38:(33,1653),39:(33,1653),40:(33,1681),45:(33,1826),46:(33,1833),50:(33,1952),51:(33,1977),58:(34,38),59:(34,235),69:(34,1972),71:(34,2146),75:(34,2373),110:(36,351),111:(36,348),115:(36,1149),117:(36,1174),118:(36,1172),121:(37,94),125:(37,189),126:(37,189),127:(37,155),128:(37,155),134:(37,339),135:(37,411),136:(37,411),137:(37,635),138:(37,683),150:(38,1315),163:(38,2163),171:(39,584),173:(39,532),174:(39,573)}
z=zipfile.ZipFile('data/work/official-facility-index/P05-22_GML.zip')
for i,(pref,row) in P05.items():
 member=f'P05-22_{pref}_GML.zip';geojson=f'P05-22_{pref}.geojson'
 f=json.loads(zipfile.ZipFile(io.BytesIO(z.read(member))).read(geojson))['features'][row]
 lng,lat=f['geometry']['coordinates'];p=f['properties']
 note='国土交通省P05-2022の建物地点（JGD2011、実用上の世界測地系緯度経度として値を保持）。原典名称「'+p['P05_003']+'」・所在地「'+p['P05_004']+'」と現在の公式施設案内・配布案内を突合。'
 if i==110:note+='本館と東館を分け、東館レコードを選択。'
 if i==59:note+='現在の乳幼児施設ページのGoogle地点は別地域を指すため不採用。配布案内の三篠公民館とP05の名称住所が一致。'
 add(i,'https://nlftp.mlit.go.jp/ksj/gml/data/P05/P05-22/P05-22_GML.zip',lat,lng,f'{member}!{geojson}#/features/{row}',note)
assert len({d['index'] for d in decisions})==len(decisions)
(R.ROOT/'decisions.json').write_text(json.dumps(decisions,ensure_ascii=False,indent=2)+'\n')
print('reviewed',len(decisions),'remaining',len(T)-len(decisions))
for i,t in T.items():
 if i not in {d['index'] for d in decisions}:print(i,t['name'])
