import sys,json,re,csv,io,pathlib,hashlib
sys.path.insert(0,str(pathlib.Path(__file__).parent));import research as r
D=[]
def add(term,url,lat,lng,locator,note):
 ps=[p for p in r.targets if term in p['name']]
 assert ps,term
 for p in ps:
  D.append({'facilityId':p['id'],'sourceUrl':url,'lat':float(lat),'lng':float(lng),'locator':locator,'finding':note,'name':p['name'],'address':p['address']})
# Explicit decisions, not an automatic name/address approval.
features=json.load(open(r.ROOT/'map-features.json'))
chosen={0:'江別市民活動',2:'当麻町郷土',3:'てしお温泉',9:'天塩町役場',10:'たきかわ観光',11:'あいろーど厚田',12:'札幌市環境',13:'道の駅いわない',15:'道の駅あびら',16:'苫小牧市役所',17:'北斗市観光交流',18:'道の駅上ノ国',21:'生涯学習センター',22:'羊のまち',23:'小樽市水道局',25:'千歳市水道局'}
for i,term in chosen.items():
 f=features[i];lat,lng=f['coordinates'].split(',');u=f['sourcePages'][0]
 add(term,f['mapUrl'],lat,lng,'埋め込み地図応答の施設feature '+f['featureId']+' / '+f['nameAddress'],'公式施設案内 '+u+' のiframeから取得。施設featureの名称と住所を台帳の現住所に照合。表示中心の座標ではない。')
# Direct official map feature/route destination
add('登別市役所','https://www.city.noboribetsu.lg.jp/docs/2013031800141/',42.41243118169229,141.1067676544189,'markerInfos: title=北海道登別市役所','公式庁舎案内の施設マーカー。中央町6丁目11番地を照合。')
add('みそぎの郷','https://kikonai.jp/access/',41.67774761340679,140.43543847168996,'mapp.data.push: pois[].point; title=道の駅 みそぎの郷 きこない','施設アクセスページのPOI pointを使用。centerではない。本町338（台帳338-14）の施設名・運営者を照合。')
add('HUB HOKKAIDO','https://www.city.kitahiroshima.hokkaido.jp/hotnews/detail/00128529.html',42.9892477,141.5511668,'HUB HOKKAIDO SELECT SHOP のGoogle Mapsリンク !8m2!3d42.9892477!4d141.5511668','市の配布案内の当該店舗リンク。Fビレッジ1番地THE LODGE2階を照合。蓋位置iframeと区別。')
add('エルフィン','https://www.city.kitahiroshima.hokkaido.jp/hotnews/detail/00128529.html',42.978986,141.563174,'エルフィンパーク市民サービスコーナー のリンク !8m2!3d42.978986!4d141.563174','市の配布案内の当該窓口リンク。中央6丁目209番地を照合。蓋位置iframeと区別。')
add('AKABIRA','https://www.city.akabira.hokkaido.jp/docs/2019080200024.html?cat=/kurashi/suido/',43.579387,142.037424,'var opts markers: name=AKABIRAベース loc=[142.037424,43.579387]','市の配布先の施設名付きマーカー。幌岡町54を照合。')
add('うとろ','https://hokkaido-michinoeki.jp/michinoeki/2884/',44.0690342,144.9906951,'GoogleMapで見る !8m2!3d44.0690342!4d144.9906951','公式道の駅情報の施設目的地。ウトロ西186-8を照合。配布終了の関係はそのまま、再開を意味しない。')
add('ガーデンスパ','https://www.tokachigawa.jp/access.php',42.9333615,143.3009616,'経路iframe到着地 ガーデンスパ十勝川温泉 !3m2!1d42.9333615!2d143.3009616','施設アクセスの経路到着地点と十勝川温泉北14丁目1を照合。出発駅・地図中心と区別。')
# Public facility points: match specific facility name and current address.
u='https://www.harp.lg.jp/opendata/dataset/1749/resource/4180/hokkaido_yakuba.csv'
b=pathlib.Path(r.cache[u]['snapshotPath']).read_bytes();rows=list(csv.DictReader(io.StringIO(b.decode('cp932'))))
for term in ['美唄市役所','和寒町役場','別海町役場','上富良野町役場','当麻町役場','剣淵町役場','豊富町役場','利尻町役場','上士幌町役場','鹿追町役場','新得町役場','足寄町役場','陸別町役場']:
 row=next(x for x in rows if x['市役所']==term)
 add(term,u,row['緯度'],row['経度'],'CSV コード='+row['コード']+' 市役所='+term+' 住所='+row['住所'],'北海道公開の役場施設点（国土数値情報由来）。原地域の取得済み公式本文の現施設名・現住所と丁目・番地を照合。旧資料の施設点であることを保持。')
u='https://www.harp.lg.jp/opendata/dataset/227/url_resource/41/Hokkaido_OD_GeoDataBase2018.csv'
rows=json.load(open(r.ROOT/'public-facilities.json'))
for term,key in [('常呂','常呂総合支所'),('札幌市下水道科学館','札幌市下水道科学館'),('天塩町ファミリー','天塩町ファミリースポーツセンター')]:
 row=next(x for x in rows if x['施設名']==key)
 add(term,u,row['緯度'],row['経度'],'CSV 施設名='+key+' 住所_出典元='+row['住所_出典元'],'北海道公式施設位置DB。'+row['出典']+'の施設点。現公式施設案内と施設名称・所在地を照合。')
u='https://www.harp.lg.jp/opendata/dataset/2235/resource/8288/%E5%85%AC%E5%85%B1%E6%96%BD%E8%A8%AD%E4%B8%80%E8%A6%A7.csv'
add('富良野市役所',u,43.342336,142.383447,'CSV ID=PF0000000001 名称=富良野市複合庁舎 所在地=富良野市弥生町1番1号','2025年公開の市公式施設一覧の複合庁舎点。旧役場CSVの43.342024,142.383104は使用せず新庁舎を選択。')
# Additional explicitly selected official station destinations.
for term,number in [('芦別市観光物産',202),('香りの里たきのうえ',1016),('道の駅おうむ',1975),('ライスランド',2390),('もち米の里',2939),('北欧の風',13542)]:
 u=f'https://hokkaido-michinoeki.jp/michinoeki/{number}/'
 x=r.inspect(r.cache[u]);matches=[re.search(r'!3d([0-9.]+)!4d([0-9.]+)',m) for m in x['maps']];matches=[m for m in matches if m]
 if matches:
  m=matches[0];add(term,u,m[1],m[2],'GoogleMapで見る の施設目的地 '+m[0],'北の道の駅の施設個別案内で名称・住所を照合。ページのL.markerではなく施設名付き目的地リンクを使用。')
add('花ロードえにわ','https://hanafuru.jp/access.html',42.8972354,141.5856753,'経路iframeの到着地 花ロードえにわ !3m2!1d42.8972354!2d141.5856753','はなふる公式アクセスの到着地は花ロードえにわ（南島松817番地18）。センターハウスと別施設として使用。')
# Two q=name embeds resolve to named POIs, not an address geocode.
for term,query in [('湯の杜ぽっけ','湯の杜ぽっけ'),('豊富町観光情報','豊富町観光情報センター')]:
 for e in r.manifest:
  if e['url'].startswith('https://maps.google.com/maps?q=') and query in r.urllib.parse.unquote(e['url']):
   raw=pathlib.Path(e['snapshotPath']).read_text();m=re.search(r'\["(0x[^"\n]+)","([^"\n]+)",\[([0-9.]+),([0-9.]+)\]',raw)
   assert m
   add(term,e['url'],m[3],m[4],'地図応答の施設feature '+m[1]+' / '+m[2],'豊富町観光協会の当該施設ページから埋め込み地図を取得。名称と住所（温泉／駅前通）を照合。町の住所代表点ではない。')
# Facility-named embedded map responses newly acquired.
for term,u in [('とかち観光情報','https://obikan.jp/post_spot/1501/'),('EBRI','https://www.ebri-nopporo.com/')]:
 for murl in r.inspect(r.cache[u])['maps']:
  if '/maps/embed?' not in murl:continue
  e=r.cache[murl];raw=pathlib.Path(e['snapshotPath']).read_text();m=re.search(r'\["(0x[^"\n]+)","([^"\n]+)",\[([0-9.]+),([0-9.]+)\]',raw)
  assert m
  add(term,murl,m[3],m[4],'地図応答の施設feature '+m[1]+' / '+m[2],'公式施設ページ '+u+' のiframeの施設名付き位置。台帳の現在の所在地を照合。')
add('富良野チーズ','https://www.furanotourism.com/jp/spot/spot_D.php?id=69',43.32069218366,142.37707933331296,'住所欄MAP href: q=43.32069218366,142.37707933331296','ふらの観光協会のチーズ工房個別ページ。施設名と中五区を照合。前庭の避難場所点とは区別。')
add('稚内副港市場','https://www.visit-hokkaido.jp/spot/detail_11269.html',45.408652,141.676545,'施設詳細の埋め込み地図 q=45.408652,141.676545 および経路到着地 /dir//45.408652,141.676545/','北海道観光振興機構の公式施設ページで副港市場・港1丁目6-28を照合。市場建物点。施設サイトのcenterのみの値は不採用。')
add('函館市地域交流','https://www.harp.lg.jp/opendata/dataset/227/url_resource/41/Hokkaido_OD_GeoDataBase2018.csv',41.76379,140.71699,'CSV 施設名=地域交流まちづくりセンター 住所_出典元=末広町4番19号','北海道公式施設位置DBのH22公的集会施設点。現在の施設公式アクセス https://hakomachi.com/facility/access/ と名称・末広町4-19を照合。')
for term,url in [('釧路市上下水道部','https://maps.app.goo.gl/StpyysamtXeQvhMx9'),('留萌プラザ','https://goo.gl/maps/9N5kicx1tnbfZWJi6')]:
 e=r.cache[url];m=re.search(r'!3d([0-9.]+)!4d([0-9.]+)',e['finalUrl']);assert m
 add(term,url,m[1],m[2],'公式短縮リンクの最終URLおよび原本内の施設目的地 '+m[0],'市公式配布案内／るもいプラザ公式施設ページが指定する施設名付き目的地。現在の住所に照合。表示中心を不採用。')
u='https://www.town.toyotomi.hokkaido.jp/section/chominka/a7cug6000000128e.html'
murl=r.inspect(r.cache[u])['maps'][0];raw=pathlib.Path(r.cache[murl]['snapshotPath']).read_text();m=re.search(r'\["(0x[^"\n]+)","([^"\n]+)",\[([0-9.]+),([0-9.]+)\]',raw);assert m
add('豊富町定住支援',murl,m[3],m[4],'地図応答の施設feature '+m[1]+' / '+m[2],'町公式施設案内 '+u+' が埋め込む定住支援センターの施設点。東1条6丁目と名称を照合。')
add('石狩市観光センター','https://www.city.ishikari.hokkaido.jp/kanko/kau/1002982.html',43.243740737075925,141.3511178586446,'施設名付き地図のstaticmap markers=43.243740737075925,141.3511178586446 およびリンク q=同値','市公式個別施設ページの施設マーカーと親船町107番地を照合。地図中心のみでなくmarkers指定を確認。')
add('旭川観光物産','https://taisetsu-kamui.jp/transportation/13680',43.7627011,142.3594675,'JSON-LD TransitSystem description=旭川観光物産情報センター address=宮下通８丁目３番１号 JR旭川駅東コンコース前 geo latitude/longitude およびhasMap','公式地域DMOの当センターで行うレンタサイクル案内。電話0166-26-6665・住所・施設名を市の施設ページと照合。センターの代表点としてのみ採用。')
u=next(e['url'] for e in r.manifest if '/1881/resource/4991/' in e['url'] and e['url'].endswith('.csv'))
add('奈井江町交流',u,43.425154,141.888901,'CSV 施設ID=00000500 名称=奈井江町交流プラザみなクル 住所=奈井江町字奈井江町74(本町1区)','北海道公式公開避難施設データR03-04-01の建物施設点。町公式施設ページ https://www.town.naie.hokkaido.jp/shisetsu/bunka/minakuru/ の現在の施設名・住所・電話と照合。')
json.dump(D,open(r.ROOT/'decisions.json','w'),ensure_ascii=False,indent=2)
used={d['facilityId'] for d in D};print('updates',len(used))
for i,p in enumerate(r.targets):
 if p['id'] not in used:print(i,p['name'],p['address'])
