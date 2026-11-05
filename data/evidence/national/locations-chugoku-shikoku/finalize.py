import json,hashlib,pathlib,shutil,datetime,zipfile,io,re,html,urllib.parse
import research as R
T={x['index']:x for x in json.load(open(R.ROOT/'targets.json'))}
S=json.load(open(R.ROOT/'sources.json'))
D=json.load(open(R.ROOT/'decisions.json'))
reasons={
1:'市の観光センター施設案内を取得したが、建物を指す数値座標を確認できなかった。',
2:'観光協会の赤瓦一号館紹介に採用可能な明示座標がなく、県観光詳細はHTTP 503。赤瓦地区全体の点を一号館に流用しない。',
3:'観光協会の円形劇場紹介で施設を同定したが数値地点を確認できず、県観光詳細はHTTP 503。',
5:'三朝温泉公式アクセスは温泉地への交通案内で、観光商工センター建物を指定する座標を確定できなかった。',
8:'県観光ページのGeoCoordinatesは堀川遊覧の別乗船場（大手前側）で、黒田町507-1のふれあい広場乗船場とは一致しない。',
9:'観光協会公式地図はGoogle埋込pbの表示領域中心のみ。浜田駅の案内所の明示地点としては採用しない。',
14:'江津市観光協会公式地図のpbに表示中心はあるが、協会・案内所建物の座標と証明できない。',
16:'公式所在地は津和野駅内・後田イ66-1で、元台帳の後田イ71-2と相違。移転・住所変更の採否を別担当へ引き継ぐため地点を保留。',
17:'現役場の美田600-4を旧P05レコードの浦郷534に結び付けられない。旧庁舎座標は採用せず、現庁舎の建物点が未確定。',
18:'宿直室は現役場（美田600-4）内。P05は浦郷534の旧役場であり、現住所へ旧庁舎点を流用しない。',
21:'倉敷公式の観光案内所一覧で児島駅案内所を確認したが、その建物を指す数値地点を得られなかった。',
23:'鉄道公式路線図の駅別Google埋込はpb表示中心。水島駅の建物地点として明示された値ではないため保留。',
24:'鉄道公式路線図の倉敷市駅地図はpb表示中心のみで、駅建物地点と区別できない。',
26:'市立カブトガニ博物館の施設案内地図はpb表示中心のみ。公園や周辺を含む表示中心から博物館の建物点を作らない。',
29:'新見市観光協会公式サイトを調べたが、協会事務所そのものの採用可能な数値地点が得られなかった。新見駅や駅前交流センターへの読み替えはしない。',
30:'JR西日本公式の新見駅情報で駅を確認したが、原典に採用できる数値目的地を確認できなかった。',
34:'現施設ページは長船町土師288-1・明示マーカー34.69969459401827,134.10324919623656。元台帳/P05の土師291とは相違し、移転採否を保留して旧点も新点も未適用。',
41:'県観光のq=34.5186399,133.562182はつばきの丘運動公園全体。配布窓口がある管理棟と特定できない。',
42:'町家交流館公式施設案内を取得したが、建物目的地を裏付ける数値地点を確認できなかった。',
43:'矢掛の公式観光施設詳細で問屋を確認したが、建物の数値目的地を確認できなかった。',
47:'県観光q=35.0373927,134.1336676はノースヴィレッジ敷地の代表点で、配布建物を特定する根拠には不足。',
48:'町のナギテラス施設案内を調べたが、名称住所と対応する数値マーカーを確認できなかった。',
52:'管理法人の芦田川施設紹介・アクセスを取得。案内図から建物の緯度経度を推定せず、数値地点未確認として保留。',
56:'市の広島港施設案内を確認したが、総合案内所のある建物を指定する数値地点を得られなかった。',
57:'追加で見つかった広島観光コンベンションビューロー1702の点はレストハウスで、広島駅南口地下広場案内所ではなかった。誤施設の座標を不採用。',
61:'商店街のギャラリー90施設紹介を確認したが、ギャラリー建物を指す採用可能な数値地点を得られなかった。',
67:'府中市観光協会公式のアクセス案内を調べたが、協会事務所の数値地点を確認できなかった。',
68:'県観光施設情報は西条本町12-3、元台帳は西条町西条475-2。ともに駅2階でも住所の同一性・変更時期を確定できずGeoCoordinatesの適用を保留。',
72:'安芸高田市の施設紹介を取得したが、北の関宿の建物目的地を裏付ける数値地点を得られなかった。',
73:'公式アクセス本文は本郷１４６２７、元台帳は本郷4627。さらにmap_dataの点は湯治村全体で旅籠千両萬両の建物と確定できないため保留。',
76:'県観光GeoCoordinatesは34.576072563331,132.26974531791。運営者アクセス図との建物対応を確定できず、道の駅の実建物の裏付け不足で保留。',
79:'公園公式の湖水ホール施設詳細はpb表示中心を含む埋込地図のみ。受付の建物を示す独立した数値地点が未確認。',
81:'山口市観光公式サイトを調査したが、山口駅の観光案内所を指定する数値目的地を確認できなかった。',
85:'上下水道局公式アクセスに複数施設のpb地図あり。下水道整備課所在建物と数値マーカーを対応づけられず、表示中心は不採用。',
86:'道の駅あいお公式アクセスを取得したが、施設の数値目的地を確認できなかった。',
90:'県観光の案内所ページはgConf lat:0,lng:0で実地点を提供していない。ゼロ値や周辺施設点は不採用。',
91:'管理公社のスポーツ公園案内を確認したが、公園全体から体育館管理事務所の建物点を区別できなかった。',
93:'岩国市のPLAT ABC案内を調べたが、現所在地に対応する数値マーカーを確認できなかった。',
94:'県観光のq/GeoCoordinatesは潮風公園の代表点。みなとオアシスの配布建物に対応するか確認できない。',
96:'柳井市観光協会公式アクセスを取得したが、協会事務所の明示数値地点を得られなかった。',
97:'秋芳洞公式の施設紹介は洞窟全体の案内。案内所建物を別に示す数値地点が未確認で、洞窟入口点を流用しない。',
99:'市の歴史民俗資料館施設案内地図はpb表示中心のみで、資料館建物の明示地点を確認できなかった。',
100:'市庁舎公式アクセスを取得したが、別館を本館から区別した数値地点がない。本館点や埋込表示中心を別館2階に流用しない。',
101:'市のサッカー交流公園公式案内を調べたが、公園のどの建物が配布場所か対応する数値点を得られなかった。',
102:'公園公式アクセスのqは住所文字列（瀬田紺屋作260-1）。住所ジオコーディングや公園中心を管理棟の建物点として使わない。',
103:'地域振興協会の公式地図qは団体名文字列で、Bee+交流棟の数値地点ではない。管理棟と交流棟を区別するため保留。',
104:'県の旧吉野川浄化センター紹介を取得したが、管理・配布建物を示す数値地点を確認できなかった。',
105:'月見ヶ丘海浜公園公式アクセスを調べたが、広い公園の代表点と配布建物を区別する数値根拠が不足。',
107:'徳島市上下水道局の公式アクセスは複数施設のpb埋込。お客さまセンターの建物点を表示中心と区別して確定できなかった。',
109:'鳴門市うずしお観光協会公式を調べたが、事務所の建物の明示座標を得られなかった。観光情報センターの別地点は流用しない。',
112:'海陽町観光協会公式を調べたが、当該事務所の明示数値目的地を確認できなかった。',
119:'香川県下水道公社の施設一覧を確認したが、大束川浄化センターの配布建物を示す数値地点は得られなかった。',
120:'香川県下水道公社の施設一覧を確認したが、金倉川浄化センターの配布建物を指定する数値地点は未確認。大束川の点は流用しない。',
124:'観光協会の城内案内所案内にはpb表示中心のみ。丸亀駅の観光案内所や城全体の代表点と区別できる明示座標が未確認。',
129:'丸亀市下水道課の施設案内を調べたが、昭和町21-1の浄化センター建物点を確認できなかった。市役所とは別施設。',
130:'同じ丸亀城内観光案内所の別facilityId。公式の城内地図はpb表示中心のみで、建物点として採用できない。',
132:'坂出市の塩業資料館公式案内を確認したが、住所と対応する数値目的地を得られなかった。',
133:'観音寺市の大正橋プラザ施設詳細はpb表示中心を含む地図。場所リンクの@表示中心を地点座標として採用しない。',
140:'2022年6月の新庁舎移転を確認。P05基準時点2022年4月の役場点を現栄町3-3-95へ無検証で流用せず、町施設マップのinitLat/Lngも表示中心なので保留。',
141:'宿直室は新庁舎内。移転前時点のP05と町マップの表示中心だけでは新建物を確定できず、2階建設課と同様に保留。',
147:'モール公式アクセスはpb表示中心のみ。建物代表点としても独立した明示座標が確認できず、1階カウンター位置は推定しない。',
151:'ミュージアム公式アクセスのGoogle埋込は広い表示範囲の中心値で、建物地点と証明できない。',
161:'公式アクセスの地図はpb表示中心。JSにはdata-lat/lngからMarkerを作る処理があるが当該ページの施設値を確認できないため不採用。',
165:'県の高須浄化センター案内を確認したが、見学・配布建物の数値地点を得られなかった。',
167:'高知市の海老ノ丸ポンプ場配布案内を確認したが、2階事務所のある建物を示す数値目的地を得られなかった。',
169:'須崎市観光協会の公式施設情報を取得したが、現事務所の数値地点を確認できなかった。',
170:'旧三浦邸のギャラリー公式案内の地図はpb表示中心のみ。旧邸建物の座標としての根拠が不足。',
176:'香美市の明示マーカーは「龍河洞」自体の地点で、龍河洞観光センター建物とは区別できないため採用しない。',
180:'県バリアフリー観光施設詳細の地図qは施設名と住所文字列。かみんか建物の数値目的地は未取得で、住所代表点を作らない。'
}
assert set(T)-{d['index'] for d in D}==set(reasons)
# Reuse the actual previously acquired original bytes, preserving original retrieval dates.
records={}
def retain(url):
 if url in records:return records[url]
 c=R.cache.get(url)
 assert c,('missing cache',url)
 c=dict(c);c['requestedUrl']=url
 if c.get('snapshotPath'):
  src=pathlib.Path(c['snapshotPath']);b=src.read_bytes();sha=hashlib.sha256(b).hexdigest()
  expected=c.get('sha256',c.get('snapshotSHA256'))
  if expected:assert sha==expected,(url,sha,expected)
  if src.parent!=R.ROOT:
   dest=R.ROOT/('reuse-'+sha[:20]+src.suffix);dest.write_bytes(b);c['reusedFrom']=str(src);c['snapshotPath']=str(dest)
  c['sha256']=sha
 records[url]=c;return c
zipurl='https://nlftp.mlit.go.jp/ksj/gml/data/P05/P05-22/P05-22_GML.zip'
meta=json.load(open('data/evidence/national/official-facility-index/P05-22_GML.zip.source.json'))
meta.update(snapshotPath='data/work/official-facility-index/P05-22_GML.zip')
R.cache[zipurl]=meta
updates=[];unresolved=[];audit=[]
for i,t in T.items():
 urls=list(dict.fromkeys([t['evidence']['sourceUrl']]+S[str(i)]))
 d=next((d for d in D if d['index']==i),None)
 if d and d['url'] not in urls:urls.append(d['url'])
 refs=[]
 for url in urls:
  c=retain(url);refs.append({'url':url,'status':c.get('status'),'error':c.get('error'),'snapshotPath':c.get('snapshotPath'),'sha256':c.get('sha256'),'fetchedAt':c.get('fetchedAt')})
 if d:
  c=retain(d['url']);assert c.get('status')==200,c
  ev={'sourceUrl':d['url'],'snapshotPath':c['snapshotPath'],'snapshotSHA256':c['sha256'],'sourceLocator':d['locator'],'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':f"公式配布案内の「{t['name']}」・所在地「{t['address']}」と公式施設情報を照合。"+d['note']+' 施設・建物の代表点として確認したもので、室内の正確な配布窓口・階の位置を示すものではない。AIによる原典照合であり、現地実測・人手確認ではない。補助原典は同根拠ディレクトリfacility-audit.jsonの当該facilityIdを参照。'}
  updates.append({'facilityId':t['id'],'coordinate':{'lat':d['lat'],'lng':d['lng']},'evidence':ev})
 else:
  attempts=[]
  for ref in refs:
   result=(f"取得失敗: {ref['error']}" if ref['error'] else f"HTTP {ref['status']}。"+('元の公式配布案内を再利用し施設名・住所を確認。' if ref['url']==t['evidence']['sourceUrl'] else reasons[i]))
   attempts.append({'url':ref['url'],'result':result})
  unresolved.append({'facilityId':t['id'],'attempts':attempts,'reason':reasons[i]})
 audit.append({'index':i,'facilityId':t['id'],'legacyPlaceIds':t['legacyIds'],'name':t['name'],'address':t['address'],'outcome':'update' if d else 'unresolved','sources':refs,'decision':d if d else reasons[i]})
# Include ancillary marker implementation and current-address evidence already used in review.
for url in ['https://www.city.hofu.yamaguchi.jp/ssi/js/shisetsu-detail-googlemap.js','https://www.city.setouchi.lg.jp/ssi/js/shisetsu-detail-googlemap.js','https://www.city.kami.lg.jp/ssi/js/shisetsu-detail-googlemap.js','https://moak.jp/guide/']:
 if url in R.cache:retain(url)
for filename in ['p05.html','p05-spec.pdf','p05-license.html','p05-classes.html']:
 metapath=pathlib.Path('data/evidence/national/official-facility-index')/(filename+'.source.json')
 if metapath.exists():
  m=json.loads(metapath.read_text());m['snapshotPath']=m['path'];R.cache[m['url']]=m;retain(m['url'])
output={'schema':1,'region':'chugoku-shikoku','updates':updates,'unresolved':unresolved}
out=pathlib.Path('data/national/location-updates/chugoku-shikoku.json');out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
(R.ROOT/'facility-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
(R.ROOT/'reused-manifest.json').write_text(json.dumps(list(records.values()),ensure_ascii=False,indent=2)+'\n')
print('OUTPUT',len(updates),len(unresolved),'source records',len(records))
