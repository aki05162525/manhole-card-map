"""Reproduce supplement from saved official bytes; no network calls."""
from research import *
import shutil,html
OUT=pathlib.Path('data/national/location-updates/kanto-north-saitama.json')
CHECKED='2026-11-05T05:00:48Z'
DIR='https://www.saitama-support.jp/map/search/detail/'
specs=[]
def add(indices,url,lat,lng,locator,note='名称・住所を照合した同一建物の代表点。室内の窓口位置を表さない。'):
 for i in indices:specs.append((i,url,lat,lng,locator,note))
# Public prefectural facility directory: actual Marker.position, not Map.center.
for indices,num in [([9],27633),([15],13155),([18,19],17827),([21],17828),([27,28],16302),([29],16329),([30,31,33],16088),([34],40444),([36],19611),([46],16162),([47],19667),([50,51],31857),([52],17242),([53,54],16974),([55],16999),([56],20222),([57,58],16015),([61],37307),([65],16360),([66],16372),([67],12021),([69],39795),([70],16594),([72],17989),([74,75],13267),([81],12546)]:
 u=DIR+str(num);s=content(CACHE[u]);m=re.search(r'new google.maps.LatLng\(([^)]+)',s);lat,lng=map(float,m.group(1).split(','))
 assert re.search(r'position\s*:\s*latlng',s)
 table=BeautifulSoup(s,'html.parser').select_one('.table_detail').get_text(' ',strip=True)
 note='施設名・住所欄を既存施設と照合。建物代表点であり室内窓口精度ではない。'
 if indices==[15]:note+='川口駅前行政センターの住所はキュポ・ラ本館棟4階。同じキュポ・ラの2階総合受付への建物代表点として使用。'
 if indices==[50,51]:note+='新曽南庁舎1・2階のさくらパルと4階上下水道窓口は同一庁舎。'
 if indices==[52]:note+='行政センター3階子育て広場と2階トビックは同一建物。'
 if indices==[81]:note+='町配布記事13667が「新しい村（森の市場 結）」と明示。敷地内の他建物へ転用していない。'
 add(indices,u,lat,lng,'new google.maps.LatLng('+m.group(1)+'); google.maps.Marker の position: latlng; .table_detail: '+table[:220],note)
for i,page in [(1,'007'),(2,'009'),(3,'010'),(4,'011'),(5,'012'),(8,'008')]:
 u=f'https://www.pref.saitama.lg.jp/shisetsu/shakai/{page}.html';s=content(CACHE[u]);m=re.search(r'maps\?q=([\d.]+),([\d.]+)',s);assert m
 add([i],u,float(m[1]),float(m[2]),'施設情報「所在地」「その他」及び「地図を開く」の maps?q='+m[1]+','+m[2], '県の水循環センター公式地図の施設代表点。所在地と維持管理支社の対応を公社アクセス原本と照合。敷地内の守衛室・室内窓口の座標としては扱わない。' if i<6 else '小山川水循環センターの名称と東五十子382-1を照合した公式施設代表点。窓口精度ではない。')
add([10],'https://www.city.kawagoe.saitama.jp/shisei/shisetsu/kanko/1013327/1013330.html',35.91408937251836,139.48126546771277,'本川越駅観光案内所のGoogle Maps qおよびStatic Maps markers')
add([11],'https://www.city.kawagoe.saitama.jp/shisei/shisetsu/kanko/1013327/1013329.html',35.90710516496571,139.4831432,'川越駅観光案内所のGoogle Maps qおよびStatic Maps markers')
add([12,13],'https://www.city.kumagaya.lg.jp/shisetsu/shiyakusho/annai/shiyakusho.html',36.1472016,139.388562,'熊谷市役所へのGoogle Maps placeリンクの !3d36.1472016!4d139.388562（@の中心値は不使用）')
add([16],'https://www.city.gyoda.lg.jp/soshiki/shougaigakusyubu/kyodohakubutsukan/riyou/access/map_access.html',36.1379272,139.4533529,'setGoogleMap_811(36.1379272,139.4533529,...); AdvancedMarkerElement position:latlng')
add([17],'https://www.city.gyoda.lg.jp/search_shisetsu/syuyo/5657.html',36.1402981,139.4577097,'商工センター: setGoogleMap_302; AdvancedMarkerElement position:latlng','ぶらっと♪ぎょうだの入居先である行田市商工センター（忍2-1-8）建物代表点。1階窓口そのものの精度ではない。')
for i,u,lat,lng in [(23,'https://chocotabi-saitama.jp/souvenir/64597/?back=1',35.79781327,139.5053097),(32,'https://chocotabi-saitama.jp/spot/40825/',36.21783,139.17727),(44,'https://chocotabi-saitama.jp/souvenir/7498/',35.97475225,139.5898454),(76,'https://saitama-supportdesk.com/ja/spots/post-22377/',36.05800906,139.2613096)]:
 add([i],u,lat,lng,'公式観光施設ページ「所在地」と「行き方を見る」の destination='+str(lat)+','+str(lng))
add([37,39],'https://www.city.kounosu.saitama.jp/page/2982.html',36.06596,139.52219289999994,'鴻巣市役所: Google Maps q=36.06596,139.52219289999994')
add([48],'https://www.city.koshigaya.saitama.jp/kurashi_shisei/kurashi/douro/suidogesuido/manholecard.html',35.8892009,139.7857619,'ガーヤちゃんの蔵屋敷: Static Maps markers および q=施設名@35.8892009,139.7857619')
add([60],'https://www.city.misato.lg.jp/soshiki/kensetsu/gesuido/5/961.html',35.8598441,139.8652029,'ららほっとみさと: Google Maps placeリンクの !3d35.8598441!4d139.8652029')
add([78],'https://www.town.kawajima.saitama.jp/1825.htm',35.9925196,139.4844419,'町役場への経路案内URLの到着点 !1d139.4844419!2d35.9925196（出発バス停と@中心値は不使用）')
# Unresolved cases retain the actual URLs inspected and their individual findings.
R={
0:'県施設一覧と県子育て施設一覧には荒川水循環センター全体の点があるが、笹目5-37-14の守衛室の建物位置を区別できない。南部支社・センター代表点を守衛室へ流用しない。',
6:'県施設情報013は菅沼984と武川駅徒歩15分を掲載するが数値の地図点がない。県の荒川上流流域概要も管内図・処理能力のみで、管理棟の明示点を確認できない。',
7:'県施設情報014は月輪521-6の市野川水循環センターを同定できるが数値の地図点がない。流域概要の管内図から座標を推定しない。',
14:'市施設案内の地図は筑波2-112の案内所を指す。一方、観光協会の2025年移転記事および既存施設は筑波2-115-1。旧窓口のplace座標を新窓口へ転用しない。',
20:'商業観光課の公式所在地は本庁舎東側の別館。県一覧で取得できた本庁舎のMarkerは別建物なので採用しない。別館案内は画像で明示座標なし。',
22:'店舗公式アクセスで元町21-18を確認。埋込地図はpbのviewport !1m3!1d/!2d/!3dのみで、明示marker座標・q座標を取得できない。県施設検索にも対応する詳細施設が見つからない。',
24:'商工会議所公式アクセスで事務局入居先の本町1-7を照合。埋込地図の数値はviewportのみ。飯能市全域の観光アクセス図を事務局位置に転用しない。',
25:'県施設一覧の本庁舎Markerは住所が下三俣290。既存施設および現市役所の住所は三俣2-1-1であり、新旧住所の同一地点を公式原本で確定できない。',
26:'環境浄化センターの公式概要は花崎2046を確認できるが、地図URLのqは施設名検索で数値はll（中心）だけ。住所検索・llを施設確定座標にしない。',
35:'県施設一覧は農林公園キヤッセ羽生全体のMarker。配布先ムジナモ市場の建物と同じ点か確定できず、園内別棟への流用を避ける。施設公式地図にも明示座標なし。',
38:'市の天空の里施設案内で明用632を確認。カーナビ用に隣接コスモスアリーナ（636-1）を指定する記述があるが別施設であり流用不可。天空の里自体の明示座標なし。',
40:'配布記事の数値llはviewport。施設公式アクセスの短縮Google MapリンクはHTTP429で取得できず再試行していない。公園全体と管理棟事務所の点も区別が必要。',
41:'県観光施設ページには道の駅おかべのdestinationがあるが、住所は岡688-1。既存施設の岡部688-1と不一致。さらに施設全体とふるさと物産センター建物の区別が必要で、住所修正検討を別提案とする。',
42:'市配布記事は長在家1280-1の深谷市物産館への2026年10月移転を明示。地図はll中心のみ。県観光の道の駅全体のdestinationは農産物直売所・併設物産館のどの建物か特定できず保留。',
43:'上下水道庁舎の公式アクセスから市GIS fid=357-830まで追跡。保存HTMLにあるinitMpx/initMpyは表示初期中心で、当該施設のfeature座標と確認できないため不採用。',
45:'市の草加宿芭蕉庵ページと地図JSにはMarker値があるが、現住所は神明2-5-1。既存施設の神明二丁目145番地1と一致せず、住所同定の修正を先に検討する必要がある。',
49:'市子育て施設案内で水辺のまちづくり館（レイクタウン4-1-4）を確認したが、埋込地図の座標はviewportのみ。観光協会と同居建物を確認しても中心値を確定点にしない。',
59:'富士見市役所の公式q座標は本庁舎。既存窓口は分館3階で、同じ鶴馬1800-1でも別棟。分館の明示markerを確認できない。',
62:'蓮田市中央公民館の公式施設ページは東6-1-8を確認できるが数値座標なし。県施設検索で同名他市施設と区別できる蓮田市の詳細markerを取得できなかった。',
63:'組合アクセスの石井・北坂戸・本部は別施設。石井1336-1の埋込地図はviewport値のみ。広報ページの石井地図短縮URLはHTTP429で取得できず再試行していない。',
64:'日高市の配布案内・下水道関連・都市計画ページを照合。高萩1385-1の浄化センターの明示座標がなく、別施設の市役所座標を転用しない。',
68:'県施設一覧と市第2庁舎案内は福岡1-1-2。既存facilityは福岡1-1-1で本庁舎住所と混在している。第2庁舎候補点は取得済みだが住所整備前に自動採用しない。',
71:'県施設一覧と市第2庁舎案内は福岡1-1-2。上下水道課の既存facilityは福岡1-1-1で本庁舎住所と混在。第2庁舎の候補を本庁舎位置として流用せず住所整備を別提案。',
73:'伊奈町上下水道庁舎の公式施設ページで小室5048を確認。庁舎写真・案内はあるが数値の施設Markerがなく、総合センターや役場の位置を転用しない。',
77:'町の施設再編記事で下八ツ林923の旧コミュニティセンターが地域活動センターイーストへ改称と確認。役場870-1とは別施設。町案内の埋込地図はviewportのみで、さまちかサイトも現行位置原本として使える明示座標なし。',
79:'県施設一覧の吉見百穴Markerには北吉見327と記載。既存施設および観光案内の北吉見324と相違するため、受付建物か遺跡全体かを確定できない。',
80:'Yotteco公式施設アクセスは寄居1231-11と観光窓口を確認できるが埋込地図はviewportのみ。県グリーンツーリズム施設情報にも数値の地図点がない。',
82:'宮代町上下水道事務所の公式案内は宮東51の案内図画像のみ。配布記事13667の所在地と一致するが、町役場・新しい村の点を事務所へ流用しない。',
83:'無印良品店舗詳細は取得タイムアウトが原本manifestに記録され再取得しない。町の配布記事とイベント記事で中央1-2-1の店舗を照合したが数値の店舗markerなし。駅前のマンホール蓋位置は不使用。'
}
assert len(TARGETS)==84
assert set(R)|{s[0] for s in specs}==set(range(84))
assert not(set(R)&{s[0] for s in specs})
audit=json.load(open('data/national/regions/kanto-north.json'))
assign=json.load(open(ROOT/'assignments.json'))
# Evidence reuse: copy referenced old bytes into this supplementary namespace.
def localize(u):
 m=dict(CACHE[u]);p=m.get('snapshotPath')
 if p and not p.startswith(str(ROOT)+'/'):
  dest=ROOT/(hashlib.sha256(u.encode()).hexdigest()[:20]+'.html');shutil.copyfile(p,dest)
  m['reusedFrom']=p;m['snapshotPath']=str(dest)
 if m.get('snapshotPath'):assert hashlib.sha256(pathlib.Path(m['snapshotPath']).read_bytes()).hexdigest()==m['snapshotSHA256']
 CACHE[u]=m;return m
updates=[];decisions=[]
for i,u,lat,lng,locator,note in sorted(specs):
 m=localize(u);s=html.unescape(content(m));assert str(lat) in s and str(lng) in s,(i,lat,lng)
 supporting=[]
 for c in audit['cards']:
  for r in c.get('relations',[]):
   if r.get('facilityId')==TARGETS[i]['id']:
    for url in r.get('sourceUrls',[]):
     if url in CACHE and url not in supporting:supporting.append(url);localize(url)
 updates.append({'facilityId':TARGETS[i]['id'],'coordinate':{'lat':lat,'lng':lng},'evidence':{'sourceUrl':u,'snapshotPath':m['snapshotPath'],'snapshotSHA256':m['snapshotSHA256'],'sourceLocator':locator,'checkedAt':CHECKED,'actorType':'ai','verificationMethod':'AIによる公式原典の数値・施設同定の照合。'+note+'現地確認・人手確認ではない。'}})
 decisions.append({'index':i,'facilityId':TARGETS[i]['id'],'name':TARGETS[i]['name'],'address':TARGETS[i]['address'],'legacyIds':TARGETS[i].get('legacyIds',[]),'sourceUrl':u,'identityNote':note,'supportingSourceUrls':supporting})
unresolved=[]
for i,reason in sorted(R.items()):
 urls=[u for k,u in assign if k==i]
 for c in audit['cards']:
  for r in c.get('relations',[]):
   if r.get('facilityId')==TARGETS[i]['id']:
    for u in r.get('sourceUrls',[]):
     if u in CACHE and u not in urls:urls.append(u)
 attempts=[]
 for u in urls:
  if u not in CACHE:continue
  m=localize(u)
  if m.get('error'):result='保存済み取得記録: '+m['error']
  elif m.get('status') and m['status']!=200:result='HTTP '+str(m['status'])+'。回避・再試行なし。'
  else:
   b=BeautifulSoup(content(m),'html.parser');title=b.title.get_text(' ',strip=True) if b.title else '本文'
   patterns=[]
   raw=str(b)
   if 'google.maps.Marker' in raw or 'AdvancedMarkerElement' in raw:patterns.append('明示Marker実装あり')
   if re.search(r'(?:q=|destination=)3[56]\.',raw):patterns.append('数値q/destinationあり')
   if 'maps/embed?pb=' in raw:patterns.append('pb埋込地図あり（viewport値は不採用）')
   if 'initMpx' in raw:patterns.append('GIS初期中心値あり（feature座標とは未確認）')
   if re.search('maps.app.goo.gl|goo.gl/maps',raw):patterns.append('短縮地図リンクあり')
   result='本文照合: '+title+'。'+('、'.join(patterns) if patterns else 'HTML内に採用可能な数値の施設地図点を確認できず')+'。当該施設の不採用理由はreasonに個別記録。'
  attempts.append({'url':u,'result':result})
 assert attempts,i
 unresolved.append({'facilityId':TARGETS[i]['id'],'attempts':attempts,'reason':reason})
 decisions.append({'index':i,'facilityId':TARGETS[i]['id'],'name':TARGETS[i]['name'],'address':TARGETS[i]['address'],'legacyIds':TARGETS[i].get('legacyIds',[]),'unresolvedReason':reason})
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps({'schema':1,'region':'kanto-north','updates':updates,'unresolved':unresolved},ensure_ascii=False,indent=2)+'\n')
(ROOT/'decisions.json').write_text(json.dumps(sorted(decisions,key=lambda x:x['index']),ensure_ascii=False,indent=2)+'\n')
# Keep all research acquisitions, plus original bytes that were actually reused.
merged={m['url']:m for m in json.load(open(ROOT/'manifest.json'))}
for u,m in CACHE.items():
 if u in merged or m.get('reusedFrom'):merged[u]=m
(ROOT/'manifest.json').write_text(json.dumps(list(merged.values()),ensure_ascii=False,indent=2)+'\n')
print('targets',len(TARGETS),'updates',len(updates),'unresolved',len(unresolved))
