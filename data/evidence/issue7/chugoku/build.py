"""Offline generation and validation. Run from repository root; writes issue7/chugoku only."""
import json,pathlib,hashlib,zipfile,io,re,html,datetime,base64
D=pathlib.Path('data/evidence/issue7/chugoku'); B=pathlib.Path('data/work/issue7-baseline'); OUT=pathlib.Path('data/national/issue7/chugoku.json')
def read(p):return json.loads(pathlib.Path(p).read_text())
def dump(p,x):pathlib.Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
ids=read(B/'assignments.json')['chugoku']; places={p['id']:p for p in read(B/'ledger.json')['places']}; audit=read(D/'prior-audit.json'); fetches=read(D/'fetches.json'); byurl={f['url']:f for f in fetches}
checked=datetime.datetime.now(datetime.timezone.utc).date().isoformat()
def source(url):
 f=byurl[url];assert f.get('status')==200;assert sha(f['snapshotPath'])==f['snapshotSHA256'];return f

def evidence(url,loc,method):
 f=source(url)
 return dict(sourceUrl=url,snapshotPath=f['snapshotPath'],snapshotSHA256=f['snapshotSHA256'],sourceLocator=loc,checkedAt=checked,actorType='ai',verificationMethod=method)
def content(url):return pathlib.Path(source(url)['snapshotPath']).read_text(errors='replace')
def fid(suffix):return next(i for i in ids if i.endswith(suffix))
updates=[];proof=[]
def add(suffix,lat,lng,url,loc,method,extractor,refs):
 i=fid(suffix);ev=evidence(url,loc,method)
 updates.append(dict(facilityId=i,coordinate=dict(lat=lat,lng=lng),scope='building',evidence=ev))
 proof.append(dict(facilityId=i,name=places[i]['name'],coordinate=dict(lat=lat,lng=lng),extractor=extractor,sourceUrl=url,identityReason=method,supportingSources=[source(x) for x in refs]))
kur='https://www.city.kurashiki.okayama.jp/kurashi/suidou/1003847/1013233/1010897.html'
# P05 is a named building-point dataset; no center geocoding, no new coordinate derivation.
zpath='data/evidence/issue5/chubu/P05-22_GML.zip';z=zipfile.ZipFile(zpath);p05url='https://nlftp.mlit.go.jp/ksj/gml/data/P05/P05-22/P05-22_GML.zip'
p05=[]
for suffix,pref,index,refs,why in [
 ('8dd78605b23dd55e25',33,1749,['https://www.town.yakage.okayama.jp/life/kankyo/gesui/manhole.html','https://yakagemachiya.information.jp/shisetsuannai/','https://yakagemachiya.information.jp/kannaiannai/'],'P05固有名やかげ町家交流館・矢掛2639と町の配布案内・運営者の古民家施設案内が一致。室内の窓口位置は要求しない。'),
 ('ab79fd8795933123c5',33,327,[kur],'P05児島産業振興センター・児島駅前1-37と市配布案内が一致。市は2階児島商工会議所と同所在地1階児島産業振興センターを明示。同一建物代表点を使う。'),
 ('f0d5e530cedd97b88a',33,327,[kur],'P05児島産業振興センター・児島駅前1-37と市配布案内の同名1階が一致。階・入口の精密点ではない。'),
 ('ddde663d81d83b2c0f',35,486,['https://k-kanrikousha.or.jp/sportspark/supokou.html','https://hirosetu.or.jp/wp-content/uploads/2023/06/f8dbb4b1ff128920c826fa32859fbbeb.pdf','https://www.pref.yamaguchi.lg.jp/soshiki/96/189046.html'],'P05固有名は下松スポーツ公園体育館。現在の管理者は同体育館をトラックワンアリーナと併記し体育館窓口での配布を明示。2023年の設備視察会原本も同体育館・河内140・アリーナ写真を示す。管理者/県の河内字恋路10140は公園管理事務所の住所表記で差を記録するが、別施設・移転の証拠ではない。公園全体の表示中心ではなくP05で個別に特定された体育館点を採る。')]:
 inner=f'P05-22_{pref}_GML.zip';member=f'P05-22_{pref}.geojson';raw=zipfile.ZipFile(io.BytesIO(z.read(inner))).read(member);d=json.loads(raw);f=d['features'][index];lng,lat=f['geometry']['coordinates'];loc=inner+'!'+member+'#/features/'+str(index)
 ev=dict(sourceUrl=p05url,snapshotPath=zpath,snapshotSHA256=sha(zpath),sourceLocator=loc,checkedAt=checked,actorType='ai',verificationMethod='AIが全国ZIPから原値を再抽出。'+why+' 2022年4月基準/JGD2011(EPSG:6668)、経度緯度をlat/lngへ転記。')
 updates.append(dict(facilityId=fid(suffix),coordinate=dict(lat=lat,lng=lng),scope='building',evidence=ev));p05.append(dict(facilityId=fid(suffix),locator=loc,feature=f,memberSHA256=hashlib.sha256(raw).hexdigest(),crs=d.get('crs')))
 proof.append(dict(facilityId=fid(suffix),name=places[fid(suffix)]['name'],coordinate=dict(lat=lat,lng=lng),extractor='p05',sourceUrl=p05url,identityReason=why,supportingSources=[source(x) for x in refs]))
u='https://dive-hiroshima.com/explore/341/';s=content(u);m=re.search(r'"geo":\{"@type":"GeoCoordinates","latitude":"([\d.]+)","longitude":"([\d.]+)"',s)
add('795a18c5cddf2431eb',float(m[1]),float(m[2]),u,'JSON-LD geo / 東広島市観光案内所 / 西条駅2階','AI原典照合。新規取得した市施設一覧40088は西条町西条475-2・JR西条駅2階・082-430-7701。県観光341は西条本町12-3・JR西条駅2階・同電話。同じ固有施設・同一駅建物と同定し、住所表記差だけで保留しない。駅前の別棟くぐり門ではない。','jsonld',['https://www.city.higashihiroshima.lg.jp/kanko/kanko/sitemap/40088.html','https://www.city.higashihiroshima.lg.jp/soshiki/gesuido/1/2/40232.html'])
u='https://www.okayama-kanko.jp/spot/detail_10300.html';s=content(u);m=re.search(r'[?&]q=([\d.]+),([\d.]+)',html.unescape(s))
add('424799903d1a9c1291',float(m[1]),float(m[2]),u,'旧柚木家住宅（西爽亭）施設詳細 iframe embed/v1/place q','AI原典照合。旧柚木家住宅玉島3-8-25の明示目的地を採る。再取得した市配布原本は西爽亭と新倉敷駅代替を区別する。correctionsの住所・電話分離と同時採用を要する。新倉敷駅の点ではない。','q',[kur])
u='https://www.city.yamaguchi.lg.jp/map/7282.html';s=content(u);m=re.search(r'[?&]q=([\d.]+),\s*([\d.]+)',html.unescape(s))
add('0bd3389d5748cea3af',float(m[1]),float(m[2]),u,'道の駅あいお施設詳細 / maps?ll=…&q=34.0288046,131.45724640000003','AI原典照合。市が道の駅あいお秋穂東1520-4として指定する数値q目的地。再取得した運営者の所在地・配布原本と一致し、小規模売店・レストラン建物の代表点として採る。2026年度の造成・建築工事計画も確認。計画中の新敷地へ置換せず、移転開始時は再照合が必要。','q',['https://michinoeki-aio.com/access/','https://water-city-yamaguchi.com/for-kids/page_1089/','https://www.city.yamaguchi.lg.jp/site/kaiken/189052.html'])
u='https://niimi.gr.jp/info/info_detail/index/77.html';s=content(u);m=re.search(r'new google.maps.LatLng\(([\d.]+),\s*([\d.]+)\)',s);assert 'position: latlng' in s
add('7940cff6f6fa056d34',float(m[1]),float(m[2]),u,'協会入会案内記事直下 #p-gmap / initialize latlng -> markerOptions.position','AI原典照合。観光協会自身の入会案内に置かれた協会マーカー、現在フッター西方472-10と市の配布先が一致。隣接するJR新見駅471には適用しない。地図中心と同値だがmarker.positionにも明示される。','latlng',['https://www.city.niimi.okayama.jp/kurashi/kurashi_detail/index/15587.html','https://niimi.gr.jp/contact/contact_register/index.html'])
u='https://www.kaike-onsen.jp/about';s=content(u);m=re.search(r'"businessLocationCoordinates":\{"latitude":([\d.]+),"longitude":([\d.]+)\}',s)
add('ec8a334a6855cf91c5',float(m[1]),float(m[2]),u,'Wix seo.context businessName / businessLocationFormatted / businessLocationCoordinates','AI原典照合。公式サイトのbusinessName=米子市観光センター、businessLocationFormatted=皆生温泉3丁目1-1に結び付いた座標。本文の施設・窓口案内と市配布案内が一致。汎用の地図表示中心ではない。','business',['https://www.city.yonago.lg.jp/9894.htm','http://www.city.yonago.lg.jp/24306.htm'])
u='https://enkei-museum.com/html/information.html';s=content(u)
# Only explicitly labelled route DESTINATION, never the !1m3 viewport triple.
pat=r'!4m5!1s0x3555d8f176031b45%3A0x89e576bab3ae34af!2z([^!]+)!3m2!1d([\d.]+)!2d([\d.]+)';matches=re.findall(pat,s);assert len(matches)==4 and len(set((x[1],x[2]) for x in matches))==1
label=base64.urlsafe_b64decode(matches[0][0]+'='*(-len(matches[0][0])%4)).decode();assert '円形劇場' in label and '２９７１' in label
add('f82ae05278a2614df9',float(matches[0][1]),float(matches[0][2]),u,'公式アクセス4経路の終点 !4m5!1s0x3555d8f176031b45:0x89e576bab3ae34af !2z(施設名住所) !3m2!1d35.4292995!2d133.8152441','AI原典照合。施設公式アクセスHTML内の4経路が同一の施設名・鍛冶町1丁目2971-2付き終点を明示。円形校舎を利用する単一館の建物代表点。pbの最初の表示中心やGoogle地図本体の応答を抽出した値ではない。','route-destination',['https://enkei-museum.com/news/news-detail.php?id=8','https://www.kurayoshi-kankou.jp/figuremuseum/'])
# Per-facility new findings: these are not copies of prior unresolved rows.
notes={
'09ae420fdee6e6c661':('multiple-buildings','市の公園案内と配布ページを再取得。P05の同名施設は見つからず、公園名称から管理建物の数値点を確定できない。','公園配置図における配布建物と公開GIS建物の対応'),
'0b31ddb7a9bb8b0617':('multiple-buildings','県施設ページを再取得しq=35.0373927,134.1336676を再確認。ノースヴィレッジ敷地全体の案内で、配布を受け持つ建物の指定には至らない。P05同名なし。','運営者の配布受付棟案内と棟別GIS'),
'10b6ee9f630ef7203b':('missing-primary-coordinate','町の施設案内を新規取得し豊沢314・フロアマップの存在を確認。P05同名なし。フロア図のみでは地理座標を復元できない。','町公開GISにナギテラス名付き点、または施設外形'),
'29d39832b41529a063':('missing-primary-coordinate','鉄道公式路線図を再取得。水島駅埋込のpb表示中心を目的地として扱わず、P05でも駅建物を特定できなかった。','鉄道または市公開GISの水島駅建物点'),
'2a5031a7a254d9bdbd':('multiple-buildings','市施設ページで産直・ラーメン店・ローソンの構成と横田331-1を再確認。P05検索でも同名なし。各棟のうち配布建物に対応する数値原典が不足。','道の駅の配布棟案内と建物GIS'),
'31ca2ca80f991e84b4':('missing-primary-coordinate','観光施設詳細を再取得し矢掛1989を確認、追加取得の町条例も同名・同住所。P05に問屋の同名点なし。施設の実在確認と座標確認を区別。','問屋の公式数値マーカーまたは町公開建物外形'),
'3451fd3f7466c85bb5':('missing-primary-coordinate','協会の公式アクセスを再取得しP05も検索したが、府中町559-2の協会建物を示す数値原典を確認できない。','協会事務所の公式GIS点または建物外形'),
'37f1eda15ce4d18414':('missing-primary-coordinate','鉄道公式路線図を再取得。倉敷市駅用の埋込表示中心から建物点を作らない。P05検索にも駅建物の同名点なし。','鉄道または市公開GISの倉敷市駅建物点'),
'3f5f3971d581f490c7':('multiple-buildings','県観光と運営者施設案内を再取得。ビジターセンター、美術館、サイクリング棟等があり、qの施設全体点を配布棟へ接続する証拠が不足。P05同名なし。','配布するビジターセンター棟と公開外形の照合'),
'42df9ae55a2417f861':('wrong-facility','旧補助URL1702は再取得しても平和公園のレストハウス。追加でひろチカ運営サイトを取得したが地下広場案内所の数値点を確認できない。','地下広場管理者の案内所位置と地理参照可能な構造図'),
'4418dd72a69888d0bf':('multiple-buildings','公式アクセスとJSを再取得しmap_dataがマーカーに使われることを確認。ただし村全体点で旅籠千両萬両への結び付き不足、所在地14627と台帳4627の差も残る。','旅籠千両萬両の個別点・配布先住所確認'),
'442369a0c345a4ef96':('coordinate-conflict','JR駅情報は西方471を確認。市配布ページには観光協会とJR駅の2配布先に対し単一marker(34.9876651,133.456787)があるがどちらか明示せず。協会の別マーカーを駅に流用しない。','JR新見駅を名指す位置データ'),
'56534586c259fb790a':('missing-primary-coordinate','市博物館案内を再取得し、P05の同名点も検索。埋込pbの表示中心以外に博物館建物の数値点を確認できない。','市公開GISまたは博物館建物外形'),
'56c4b3109bfbb9d36d':('multiple-buildings','県観光と運営者アクセスを再取得。33.990717,130.9891736は庭園目的地であり、書院・茶室等のうち受付建物との対応が不足。','受付棟の指定と庭園配置図の地理参照'),
'5c25582e543cde5044':('multiple-buildings','県観光を再取得。売店1階・レストラン2階の情報と別棟施設の存在を確認。GeoCoordinatesは既知値だが対象売店建物に重なる根拠を追加できない。','運営者の売店棟配置図と公開建物外形'),
'5c5cec6c482042291d':('missing-primary-coordinate','温泉公式アクセスを再取得。温泉地への広域交通案内から商工センター個別建物は特定できず、P05同名点もなし。','商工センター名付き公式地点'),
'7234bdb6d4605a7665':('multiple-buildings','公園公式アクセスを再取得。P05には同住所のはっちの家があるが管理棟と同定できない。住所qを管理棟座標へ変換しない。','はっちの家と管理棟の関係、または管理棟の個別GIS点'),
'7851aeb9671340371a':('relocation','追加取得した津和野駅公式記事はイ66-1の駅舎内切符簡易販売窓口を明示。台帳イ71-2との履歴とカード窓口の対応は未確定。P05にも協会個別点なし。','観光協会の移転告知・現在のカード配布窓口指定'),
'78d5b7e93bce40b71b':('multiple-buildings','秋芳洞公式ページを再取得し秋吉3449-1、黒谷・秋吉台等の案内所の存在を確認。洞窟全体や入口の点を対象案内所に流用できない。','秋芳洞案内所の建物指定・公開外形'),
'792aab26713d312890':('multiple-buildings','県観光を再取得し由宇8500-6・海浜公園/物産館等を確認。34.0326527,132.2169625の施設全体座標だけでは配布棟との対応が不足。','物産館等の配布建物を示す運営案内とGIS'),
'83c9c4a0ad77ff4af0':('missing-primary-coordinate','上下水道局の公式案内を再取得、P05にも局固有点を探したが該当なし。複数地図のpb表示中心から下水道整備課建物の点を作らない。','上下水道局宮島町7-1庁舎の公式数値地点'),
'85f80ce977bcdf56d4':('relocation','追加取得の市広報115698.pdfで2023年5月8日に土師288-1へ新支所移転と確認。現マーカーはその新支所、P05土師291は旧支所。配布原本は2023年4月1日から休止のため新庁舎へカード窓口が引き継がれた根拠なし。単なる住所同一性不足から、休止前旧窓口と新庁舎の関係未確認へ理由更新。','配布再開告知または休止中施設IDを旧所在地として扱うかの親判断'),
'8b8fd2a944840cadfd':('multiple-buildings','町施設ページと県観光を再取得。管理事務所電話と公園住所は確認できるがq=34.5186399,133.562182は公園全体で管理棟指定ではない。P05同名点なし。','里庄町の管理棟配置図・建物GIS'),
'8d0cee31bd1bcec521':('coordinate-conflict','新規県福祉マップ7621は施設名付きmarker 33.9453848,131.2825532を持つが、住所は則貞3-4-1・電話は公園企画課。運営者の沖宇部254・湖水ホール専用電話51-7057と不整合。名称だけでホール点と断定しない。','宇部市の湖水ホール個別GIS点または県福祉マーカー訂正資料'),
'9158e6a0fc7222e6ab':('missing-primary-coordinate','協会案内に加えて特産品販売所の公式salonを新規取得。同駅2階と1階の建物関係は確認できるが、地図はpb表示中心のみ。P05に浜田駅同名点なし。','JR浜田駅建物点を示す鉄道または自治体データ'),
'93e9b0b1e4bcb33b8e':('multiple-buildings','県観光53と呉観光94を再取得。前者は複数建物を含む記念館、後者は公園で住所も幸町5番他。券売所建物の数値原典としては使えない。','券売所建物の配置図と個別建物外形'),
'a24ab0817e243a1ffb':('missing-primary-coordinate','市の施設案内を再取得し宇品旅客ターミナル1階・宇品海岸1-13-26を再確認。P05に固有建物点なし。入口精度は不要だが旅客ターミナルの数値原典が不足。','広島港宇品旅客ターミナルの公式GIS点'),
'a5355105c733978fb2':('relocation','町トップと新庁舎建設ページ481を新規取得し現美田600-4を再確認。全国P05再抽出でも浦郷534の旧役場しか該当せず、現庁舎数値点が不足。','美田600-4新庁舎の町公開GISまたは外形'),
'a7982389d4085032f9':('missing-primary-coordinate','商店街の個別店舗ページを再取得し中通3-3-17・電話36-3902を確認。P05同名なし。表示中心/文字住所から点を作らず保留。','商店街のギャラリー90数値マーカーまたは建物GIS'),
'ac2f433114644560e5':('wrong-facility','県観光ページを再取得し3乗船場の併記を確認。単一GeoCoordinatesは対象黒田町ふれあい広場への対応を証明しない。P05同名なし。','堀川遊覧のふれあい広場個別建物点'),
'ad6498274696679c6b':('missing-primary-coordinate','県観光ページを再取得し案内所の名称・西豊井1247は確認。位置データは依然lat=0,lng=0、P05にも同名なし。ゼロを除外。','下松駅南口観光案内所の公式地点'),
'baec24a203c6ed911a':('multiple-buildings','管理法人の施設紹介とアクセスを再取得しP05検索も実施。処理場内配布建物の緯度経度との対応は得られない。案内図の目測を数値原典にしない。','管理棟指定と処理場公開建物GIS'),
'cb11c6cf2f76187e61':('missing-primary-coordinate','市の施設案内を再取得し栄町9-21と資料館を確認。P05同名なし。pb表示中心以外の明示建物数値点が見つからない。','市資料館の公開GIS建物点'),
'cd44c49fdfac071988':('missing-primary-coordinate','公式アクセスに加えhomeと読み込まれるgooglemap.jsを追加取得。JSは.marker要素のdata-lat/lngを位置に使うが、取得したhome/access本文に当該要素はなく協会の数値点を得られない。P05同名なし。','柳井3714-1の協会事務所を名指す地図データ'),
'd0065de3f1d6af9a22':('multiple-buildings','市庁舎アクセスと下水道課を再取得。P05山陽小野田市役所1028は庁舎総称で別館指定なし。別館を本館点へ集約せず保留。','別館の個別建物点・配置図と外形'),
'd79e170069f79cc7d2':('mixed-record','市配布案内と観光案内所一覧を再取得。児島駅1-107と商工会議所1-37を明確に区別できるため住所・電話の分離訂正を提案。駅建物の数値原典はなお不足。','児島駅建物の公式GIS点'),
'd96f3a22bac31657b3':('relocation','現美田600-4の町公式ページと新庁舎建設ページを追加確認。P05浦郷534は旧庁舎と判定し現環境整備課の建物へ流用しない。','新庁舎の公式数値地点・公開建物外形'),
'db60eef36c8f3b518b':('missing-primary-coordinate','市観光サイトを再取得、P05に山口駅案内所の固有点なし。惣太夫町2-1の駅内案内所について数値原典をまだ確保できない。','山口駅駅舎の自治体/鉄道公式地点'),
'e0dc2b70dac9632686':('multiple-buildings','県の刀剣博物館案内と配布休止原本を再取得。長船966のq=34.72186,134.10701は鍛刀場・工房を含む施設の案内で受付棟との対応不足。','博物館受付建物の個別点・外形'),
'e10aada0cecdff9fae':('missing-primary-coordinate','観光協会詳細を再取得し、新たに赤瓦運営者の一号館ページも取得。醤油蔵建物と新町2441は確認できるが数値地点なし。県旧ページ503は1回で打ち切り。','一号館の公式地点・市公開建物外形'),
'e2f1019dc6faed28bc':('missing-primary-coordinate','協会公式サイトを再取得しP05も検索したが、江津町1518-1の協会建物を指定する数値原典なし。pb表示中心を採らない。','江津市の案内所個別地点'),
'e4b9d51a912a95286a':('multiple-buildings','地域振興協会連絡先を再取得。文字列q・住所からBee+交流棟の数値点は得られず、P05も同名なし。管理棟と別IDを維持。','Bee+交流棟個別GIS点と公園内位置図'),
'eb39ed62b47f9f29ba':('missing-primary-coordinate','市PLAT ABC施設案内を再取得しレジデンス岩国駅東1階を確認。P05同名なし。駅そのものの点とレジデンス建物点は区別。','レジデンス岩国駅東の公式建物座標'),
'f9ac7cca9893ace076':('multiple-buildings','市配布・県観光を再取得。インフォメーションは本館内だが、複数校舎全体のqを本館点に結び付ける配置証拠はなお不足。P05同名なし。','明倫学舎本館の個別外形と受付所在の照合'),
'811926f2652d6640dc':('missing-primary-coordinate','市配布案内を新規取得し玉島爪崎390-4・JR新倉敷駅2階を確認。既存観光案内所一覧も同駅として照合。P05に駅建物点なし。旧柚木家の点とは分離。','JR新倉敷駅駅舎の公式位置データ'),
'db1f68e131a3fd939d':('missing-primary-coordinate','追加取得の協会salonは浅井町777-35・JR浜田駅1Fを明記。駅建物と同定できるがpb数値は表示中心で建物マーカーではない。P05にも同名駅なし。','JR浜田駅の公式建物点'),
'dc1637ffd07c249588':('missing-primary-coordinate','追加取得の観光協会f/kankoannaiで国際観光案内所を確認。市配布先と照合したが駅建物の数値原典は得られず、P05にも同名なし。','改築後のJR米子駅建物点を示す鉄道/自治体データ')}
updated={u['facilityId'] for u in updates}; unresolved=[]; attempts_audit=[]
for x in audit:
 i=x['facilityId']; fs=[f for f in fetches if i in f['facilityIds']]
 attempts=[dict(kind='prior-record-reread',sources=x['priorReviewReferences'],result=x['previousReason']),dict(kind='new-p05-extraction-search',source=zpath,result='全国ZIP内の31〜35県GeoJSONを名称・住所の部分一致候補検索。検索ログ参照。候補一致自体を採用とはしない。')]
 attempts += [dict(kind='new-web-fetch',sourceUrl=f['url'],fetchedAt=f['fetchedAt'],status=f.get('status'),snapshotPath=f.get('snapshotPath'),snapshotSHA256=f.get('snapshotSHA256'),result=f.get('error','本文を取得し名称・住所・地図データを確認。個別の結論はreason/coordinate-proof参照。')) for f in fs]
 attempts_audit.append(dict(facilityId=i,priorReasonCategory=x.get('priorReasonCategory'),investigationStatus='new-investigation',attempts=attempts))
 if i in updated:continue
 cat,reason,nxt=notes[i.split('-')[-1]]
 unresolved.append(dict(facilityId=i,reasonCategory=cat,reason=reason,nextSource=dict(url=places[i]['evidence']['sourceUrl'],required=nxt),investigationStatus='new-investigation',attempts=attempts))
assert len(notes)==len(unresolved)
corrections=[]
for suffix,field,new in [('424799903d1a9c1291','address','岡山県倉敷市玉島3丁目8-25'),('424799903d1a9c1291','phone','086-522-0151'),('d79e170069f79cc7d2','address','岡山県倉敷市児島駅前1-107'),('d79e170069f79cc7d2','phone','086-472-1289'),('811926f2652d6640dc','phone','086-526-8446')]:
 i=fid(suffix);corrections.append(dict(facilityId=i,target='places',field=field,old=places[i][field],new=new,reason='再取得した市公式配布原本で本配布先と代替窓口の住所・電話を分離。関係・配布状態は変更しない。',evidence=evidence(kur,'カード別配布場所・所在地・電話欄','AIが固定台帳のexact old値と市配布原本の施設別値を照合。提案のみ。')))
result=dict(schema=1,updates=updates,unresolved=unresolved,corrections=corrections)
# Verification uses original bytes, numeric extractors above, exact old, and immutable input hashes.
allids=[x['facilityId'] for x in updates+unresolved];assert len(allids)==len(set(allids))==len(ids) and set(allids)==set(ids)
go=pathlib.Path('cmd/builddata/ledger.go').read_text();struct=re.search(r'type Evidence struct \{(.*?)\n\}',go,re.S)[1]
actual_fields=set(re.findall(r'json:"([^"]+)"',struct))
fields={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
assert actual_fields==fields
for row in updates+corrections:
 e=row['evidence'];assert set(e)==fields;assert not pathlib.Path(e['snapshotPath']).is_absolute();assert sha(e['snapshotPath'])==e['snapshotSHA256']
for f in fetches:
 if f.get('snapshotPath'):assert sha(f['snapshotPath'])==f['snapshotSHA256']
for x in audit:
 for e in x['priorEvidence']:assert sha(e['snapshotPath'])==e['snapshotSHA256']
for ref in read(D/'reused-resources.json'):assert sha(ref['path'])==ref['sha256']
for p,h in read(D/'input-hashes.json').items():assert sha(p)==h,p
for p,h in read(B/'hashes.json').items():assert sha(B/p)==h,p
assert sha(zpath)==read('data/evidence/issue5/chubu/P05-22_GML.zip.source.json')['sha256']
dump(OUT,result);dump(D/'coordinate-proof.json',proof);dump(D/'p05-selected-records.json',p05);dump(D/'investigation-audit.json',attempts_audit)
dump(D/'validation.json',dict(checkedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),assigned=len(ids),updates=len(updates),unresolved=len(unresolved),corrections=len(corrections),allIdsClassifiedExactlyOnce=True,evidenceSevenFields=True,numericOriginalsMatch=True,snapshotHashesMatch=True,oldCorrectionValuesMatch=True,fixedInputsUnchanged=True,newWebInvestigatedIds=len({i for f in fetches for i in f['facilityIds']}),fetchAttempts=len(fetches),fetchSuccess=sum(f.get('status')==200 for f in fetches),notClaimed=['親独立レビュー','manifest採用','Go/UI変更','全施設の座標確定','全施設の移転不存在証明']))
print(json.dumps(read(D/'validation.json'),ensure_ascii=False,indent=2))
