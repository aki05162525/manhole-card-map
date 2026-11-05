"""Generate candidate report from saved bytes only; never changes baseline or ledger."""
import sys
sys.dont_write_bytecode = True
from research import *
import re, xml.etree.ElementTree as ET
ids=load('data/work/issue7-baseline/assignments.json')['shikoku']
places={p['id']:p for p in load('data/work/issue7-baseline/ledger.json')['places']}
prior={p['facilityId']:p for p in load('data/evidence/issue7/shikoku/prior-records.json')}
fetches=load('data/evidence/issue7/shikoku/fetches.json')+load('data/evidence/issue7/shikoku/additional-fetches.json')
byurl={e['sourceUrl']:e for e in fetches}
def textof(url):return (ROOT/byurl[url]['snapshotPath']).read_text(errors='replace')
def ev(url,loc,method):
 e=byurl[url]
 return {k:e[k] for k in ['sourceUrl','snapshotPath','snapshotSHA256']}|dict(sourceLocator=loc,checkedAt='2026-11-05',actorType='ai',verificationMethod=method)
def fid(s):return next(i for i in ids if i.endswith(s))
# Individually read identities, numeric sources and unresolved limitations.
notes={
'03ecde6c69b7676882':('原典不足','県観光協会の施設名付きmarker id=155を追加取得。市の配布施設名・大屋冨町1777-12と一致。資料館建物代表点として十分。',['https://www.my-kagawa.jp/point/155']),
'0a3fd9d830063e2ad7':('移転別棟','P05原データは既に新庁舎住所。町施設CSVの新庁舎markerも約8m以内で一致。旧点とした既存理由を訂正提案。入口や2階室内位置を求めない。',['https://www.town.tadotsu.kagawa.jp/material/files/group/1/map_20230202.csv','https://www.town.tadotsu.kagawa.jp/theme/base/shisetsu_map/js/jquery_map.js']),
'1da8c893b7e0da18dd':('移転別棟','新施設完成ページと避難施設案内を追加取得。配布案内は昭和町21-1を明示し旧31-1を明確に除外。新管理棟の数値原典は未確定。',['https://www.city.marugame.lg.jp/page/30100.html','https://www.city.marugame.lg.jp/site/bousaiinfo/2455.html']),
'1fe04097ed447030ce':('移転別棟','指定管理者のアクセス・施設概要・2026年パンフレットを追加取得。アクセスのpbは表示中心。複数処理棟のうち配布管理棟に結び付く数値原典は未確定。',['https://www.toku-eta.or.jp/sewer/access/','https://www.toku-eta.or.jp/sewer/facility-outline/','https://www.toku-eta.or.jp/wp-content/uploads/2026/06/sewer-pamphlet_r08.pdf']),
'256deac4b524a7a91a':('原典不足','県の施設概要を追加取得、見学ページ再取得。公開検索にはヘリ離着陸場の数値もあるが南側グラウンド・広場であり建物点へ転用しない。配布建物の数値原典が不足。',['https://www.pref.kochi.lg.jp/doc/takasu-gaiyou/']),
'403952f78c6d18a261':('原典不足','市運営の島旅サイトの施設地点と日本観光振興協会GeoCoordinatesが約1m以内で一致。城内案内所を指し城全体や駅案内所と区別できる。同施設の別IDも保持。',['https://www.marugame-happylife.jp/islands/info/entry-160.html','https://www.japan47go.travel/ja/detail/9c66239c-6e1b-499c-9b34-033e2c562392','https://www.city.marugame.lg.jp/site/castle/2897.html']),
'4273f7af29262d7c74':('移転別棟','龍河洞保存会の施設案内を追加取得し観光センターの存在を確認。市markerは龍河洞で、複数の施設から観光センター建物へ結び付ける数値原典を得ていない。',['https://ryugadou.or.jp/facility/']),
'51f8a875d8e4c4dd9f':('原典不足','施設の別公式利用案内を追加取得。クールスモール2階との同定は可能だが建物markerを確認できず。室内位置は必要条件にしていない。',['https://toonartvillage2.amebaownd.com/pages/4013369/information']),
'53a83a0263666dddd1':('原典不足','徳島県UD施設GISのfeature_1253.xmlを取得。観光ターミナル館の名称・住所と明示lat/lngを確認。観光協会公式の館内案内所の説明で同定し、隣接ホテルの温泉棟と区別。',['https://maps.pref.tokushima.lg.jp/ud/search/facility_1253.html','https://maps.pref.tokushima.lg.jp/ud/search/feature_1253.xml','https://www.kaiyo-kankou.jp/spots/spots-1321/']),
'5b94c854a92178a084':('原典不足','配布ページと水道局アクセスを新規HTTP取得して再読。本庁舎南前川町5-1-4を同定したが数値は住所名義のpb表示中心である。P05にも該当建物を発見できず、数値建物原典が不足。',[]),
'5bd7b7e3810ea3b76e':('原典不足','市の雨水処理施設ページを追加取得し海老ノ丸ポンプ場を確認。配布ページとの名称一致はあるが建物座標の数値原典が不足。',['https://www.city.kochi.kochi.jp/soshiki/50/usuishori.html']),
'5d99918e1ea4d0b991':('原典不足','県観光サイトの協会名付きLeaflet markerを追加取得。原町1-9-11と電話番号が市の配布先に一致。駅は1-10-13で別。',['https://kochi-tabi.jp/search_spot_food.html?id=7721']),
'66c4c4fbd8f914efac':('原典不足','モール公式フロアマップを追加取得。1階カウンターの厳密位置は要求しないが、アクセスのpb表示中心を建物点とする根拠がなく、モール建物の別数値原典を得ていない。',['https://imabarishintoshi.aeonmall.jp/floormap']),
'93122d3bc481983632':('移転別棟','新庁舎内の宿直室。建設課と同一の新庁舎代表点を使用可能。P05原データは新住所、町CSVとも整合。',['https://www.town.tadotsu.kagawa.jp/material/files/group/1/map_20230202.csv']),
'966cf6f4a303ce7b1c':('移転別棟','施設ガイドマップを追加取得。P05施設点132.717016,33.770037と公式OG点132.717616,33.770134は約56m差。フロントを収容する本館・別館・体育館があるため、この差を室内精度の問題とせず本館外形との照合を次に行う。',['https://welpiaiyo.jp/facility-guidemap']),
'ba24f603e6bac38d9e':('移転別棟','公社の金倉川施設詳細を追加取得。大束川点は流用しない。管理棟と処理施設群を区別する数値位置が不足。',['https://kagawa-gesui.or.jp/publics/index/28/']),
'c39121867e5e6927e2':('原典不足','県観光サイトの旧三浦邸名付きLeaflet markerを追加取得。市配布案内・ギャラリー公式の青木町1-16と一致。旧邸を利用した単独施設の代表点として採用候補。',['https://kochi-tabi.jp/search_spot.html?id=7528']),
'c43792fd530ad920ed':('原典不足','県観光サイトのmuseum名付きmarker id=4554を追加取得。所在地坂井町2-8-1は市配布案内と一致。旧アクセスiframe中心とは別に明示markerから取得。配布状態は変更しない。',['https://www.iyokannet.jp/spot/4554']),
'c7eae2022b55200128':('移転別棟','公社の大束川詳細と県再評価資料の管理棟入り平面図を追加取得。管理棟図はあるが地理座標との対応は未実施。画像から推測した座標を登録しない。',['https://kagawa-gesui.or.jp/publics/index/32/','https://www.pref.kagawa.lg.jp/documents/43491/r5-1-siryou1.pdf']),
'c859f2f66b0d2b847c':('移転別棟','公式ビジターセンター案内を追加取得。公園アクセスYahoo埋込に目的地点hlat/hlonはあるが公園全体の点で、管理棟と一致するか未確定。',['https://www.tsukimigaoka.com/park/visitor.html']),
'd14ceddc7ade5a7e6a':('移転別棟','市の2023年施設案内markerと県観光の直販店紹介markerが約4m以内で一致。直販店・食堂・集落活動センターを含む道の駅建物として同定し、周辺ホテルやミュージアムと区別。室内店舗位置は求めない。',['https://www.city.kami.lg.jp/map/michinoeki20231209.html','https://kochi-tabi.jp/search_spot_inn.html?id=1370','https://www.city.kami.lg.jp/ssi/js/shisetsu-detail-googlemap.js']),
'dd7eb1d2869acfbc00':('原典不足','P05うずしお会館を新たに抽出。住所165-10と市配布ページのうずしお会館1Fが一致。観光協会施設紹介でもうずしお会館1階を確認。',['https://www.naruto-kankou.jp/charm/charm-5996/']),
'e908bad62bf5a18ac0':('原典不足','同一の丸亀城内観光案内所としてもう一方のIDと同じ根拠・点を使用。ID統合や配布関係変更は行わない。',['https://www.marugame-happylife.jp/islands/info/entry-160.html','https://www.japan47go.travel/ja/detail/9c66239c-6e1b-499c-9b34-033e2c562392','https://www.city.marugame.lg.jp/site/castle/2897.html']),
'ef53a3d23bf2f8f4f2':('原典不足','市の新施設案内を追加取得。2026年古民家改修開館と美良布1141-1を確認。地図埋込は表示中心のみで、新施設建物の数値原典は不足。',['https://www.city.kami.lg.jp/soshiki/34/kaminka.html']),
'f23124a8f6d7059054':('原典不足','日本観光振興協会の大正橋プラザGeoCoordinatesを追加取得。名称・1234-4・電話番号が市配布案内と一致し独立建物を同定。市iframe表示中心からは採らない。',['https://www.japan47go.travel/ja/detail/9fa8b273-ee7c-4374-9a8e-7af865fbaff9']),
'f48988ec217d052e92':('移転別棟','市配布先・県観光marker・運営者アクセスを新規HTTP取得して再照合。端出場と東平の区別は可能だが、端出場の広い複合施設markerを本館へ割り当てる外形対応は未確定。',[]),
'9ff461d7f7a6c20c9b':('未再調査','県観光サイト・バリアフリー施設案内・四国道の駅連絡会を追加取得。地域情報コーナーは管理事務所内と同定したが、道の駅全体marker33.534195,133.7537と当該建物の対応は未確定。',['https://kochitourism-barrierfree.jp/det.php?i=85','https://kochi-tabi.jp/search_spot_sightseeing.html?id=1382','https://www.sk-michinoeki.jp/michinoeki/458'])
}
# Source extractors return literal numeric values; no geocoding or Google Maps extraction.
updates=[];proof=[]
def add(s,url,kind,loc,selector=None):
 id=fid(s); t=textof(url)
 if kind=='marker':
  m=re.search(r'id:\s*"'+selector+r'"\s*,name:\s*"[^"]+"\s*,latitude:\s*"([\d.]+)"\s*,longitude:\s*"([\d.]+)"',t);lat,lng=map(float,m.groups())
 elif kind=='leaflet':lat,lng=map(float,re.search(r'L.marker\(\[([\d.]+),\s*([\d.]+)\]',t).groups())
 elif kind=='xml':
  x=ET.fromstring(t);lat=float(x.findtext('.//lat'));lng=float(x.findtext('.//lng'))
 elif kind=='geo':
  lat,lng=map(float,re.search(r'"geo":\{"@type":"GeoCoordinates","latitude":([\d.]+),"longitude":([\d.]+)',t).groups())
 elif kind=='citymarker':lat=float(re.search(r"initlat = '([\d.]+)'",t)[1]);lng=float(re.search(r"initlong = '([\d.]+)'",t)[1])
 method='AIが保存した公式原本の明示施設地点を抽出し、配布先の名称・住所と照合。'+notes[s][1]+' 現地確認・入口測量ではない。'
 updates.append(dict(facilityId=id,coordinate=dict(lat=lat,lng=lng),scope='building',evidence=ev(url,loc,method)))
 proof.append(dict(facilityId=id,kind=kind,selector=selector,sourceUrl=url,coordinate=dict(lat=lat,lng=lng),buildingIdentification=notes[s][1]))
add('03ecde6c69b7676882','https://www.my-kagawa.jp/point/155','marker','var markers の id="155", name="坂出市塩業資料館" の latitude/longitude','155')
add('c43792fd530ad920ed','https://www.iyokannet.jp/spot/4554','marker','var markers の id="4554", name="あかがねミュージアム" の latitude/longitude','4554')
add('c39121867e5e6927e2','https://kochi-tabi.jp/search_spot.html?id=7528','leaflet','L.marker([33.389927, 133.28955]) / 旧三浦邸 popup')
add('5d99918e1ea4d0b991','https://kochi-tabi.jp/search_spot_food.html?id=7721','leaflet','L.marker([33.392376, 133.29266]) / 須崎市観光協会 popup')
add('53a83a0263666dddd1','https://maps.pref.tokushima.lg.jp/ud/search/feature_1253.xml','xml','items/item: name=道の駅 宍喰温泉; address=海部郡海陽町大字久保字板取219-6; lat,lng')
for s in ['403952f78c6d18a261','e908bad62bf5a18ac0']:
 add(s,'https://www.japan47go.travel/ja/detail/9c66239c-6e1b-499c-9b34-033e2c562392','geo','JSON-LD geo.GeoCoordinates / 丸亀城内観光案内所')
add('f23124a8f6d7059054','https://www.japan47go.travel/ja/detail/9fa8b273-ee7c-4374-9a8e-7af865fbaff9','geo','JSON-LD geo.GeoCoordinates / 大正橋プラザ観光案内所')
add('d14ceddc7ade5a7e6a','https://www.city.kami.lg.jp/map/michinoeki20231209.html','citymarker','initlat/initlong → ssi/js/shisetsu-detail-googlemap.js の Marker.position（道の駅美良布）')
zpath='data/evidence/issue5/chubu/P05-22_GML.zip';zmeta=load(zpath+'.source.json');z=zipfile.ZipFile(ROOT/zpath)
p05=[]
for s,pref,name in [('0a3fd9d830063e2ad7',37,'多度津町役場'),('93122d3bc481983632',37,'多度津町役場'),('dd7eb1d2869acfbc00',36,'うずしお会館')]:
 inner=f'P05-22_{pref}_GML.zip';member=f'P05-22_{pref}.geojson';sub=zipfile.ZipFile(io.BytesIO(z.read(inner)));features=json.loads(sub.read(member))['features'];pairs=[(i,f) for i,f in enumerate(features) if f['properties']['P05_003']==name];assert len(pairs)==1;i,f=pairs[0];lng,lat=f['geometry']['coordinates'];id=fid(s)
 e=dict(sourceUrl=zmeta['url'],snapshotPath=zpath,snapshotSHA256=zmeta['sha256'],sourceLocator=f'{inner}/{member} features[{i}] P05_003={name}, P05_004={f["properties"]["P05_004"]}; geometry.coordinates=[lng,lat]',checkedAt='2026-11-05',actorType='ai',verificationMethod='AIが全国ZIPから今回抽出し現施設と同定。'+notes[s][1]+' JGD2011数値を既存P05運用と同様に転記。国土交通省国土数値情報2022年版（CC BY 4.0）を加工。現地確認ではない。')
 updates.append(dict(facilityId=id,coordinate=dict(lat=lat,lng=lng),scope='building',evidence=e));proof.append(dict(facilityId=id,kind='p05',member=inner+'/'+member,index=i,feature=f,coordinate=dict(lat=lat,lng=lng),buildingIdentification=notes[s][1]))
updated={x['facilityId'] for x in updates};audit=[];unresolved=[]
for id in ids:
 s=id.split('-')[-1];cat,note,extra=notes[s];urls=list(dict.fromkeys([e['sourceUrl'] for e in prior[id].get('evidence',[])]+extra))
 attempts=[]
 for url in urls:
  e=byurl[url];attempts.append(dict(kind='new-http-fetch',**e))
 attempts.append(dict(kind='existing-source-new-inspection',snapshotPath=zpath,snapshotSHA256=zmeta['sha256'],fetchedAt=zmeta['fetchedAt'],sourceUrl=zmeta['url'],result='四国36～39の原レコード5902件を検索。該当P05候補はp05-shikoku-records.json。時点だけを理由に除外しない。'))
 audit.append(dict(facilityId=id,name=places[id]['name'],priorReasonCategory=cat,priorReason=prior[id]['reason'],investigationStatus='new-investigation',result='building-candidate' if id in updated else 'unresolved',finding=note,attempts=attempts,priorReferences=prior[id].get('priorReviewReferences',[])))
 if id not in updated:
  nexturl=extra[0] if extra else places[id]['evidence']['sourceUrl']
  unresolved.append(dict(facilityId=id,reasonCategory=cat if cat!='未再調査' else '移転別棟',reason=note,nextSource=dict(url=nexturl,required='当該配布建物を識別する公開GISまたは建物外形と公式配置図の照合。室内窓口精度は不要。既存の表示中心や広場点を建物点へ変更しない。'),investigationStatus='new-investigation-unresolved',attempts=attempts))
corrections=[]
for s in ['0a3fd9d830063e2ad7','93122d3bc481983632']:
 id=fid(s);u=next(u for u in updates if u['facilityId']==id)
 corrections.append(dict(facilityId=id,targetPath='data/national/issue5/west-south.json',selector=dict(facilityId=id,array='unresolved'),field='reason',old=prior[id]['reason'],new='P05-22_37の多度津町役場は栄町3-3-95の新庁舎住所・地点を収録している。2022年6月移転だけから旧庁舎点と断定した旧理由は誤り。町施設CSVの新庁舎markerも近接一致するため、建物代表点として採用可能。',reason='全国ZIPを再展開した実レコードと新庁舎公式案内・町施設CSVを追加照合。元資料・配布関係は変更しない。',evidence=u['evidence']))
save(ROOT/'data/national/issue7/shikoku.json',dict(schema=1,updates=sorted(updates,key=lambda x:x['facilityId']),unresolved=unresolved,corrections=corrections))
save(OUT/'coordinate-proof.json',proof);save(OUT/'audit.json',audit)
print('candidates',len(updates),'unresolved',len(unresolved),'corrections',len(corrections))
