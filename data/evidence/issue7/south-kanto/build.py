from research import *
import csv, html
records=read('data/evidence/issue7/south-kanto/fetch-records.json')
targets=read('data/evidence/issue7/south-kanto/targets.json')
byurl={r['url']:r for r in records}
def ref(url):return byurl[url]
def content(url):
 r=ref(url);return (ROOT/r['snapshotPath']).read_bytes().decode('utf-8-sig',errors='replace')
def evidence(r,locator,method):
 return {'sourceUrl':r.get('url',r.get('sourceUrl')),'snapshotPath':r['snapshotPath'],'snapshotSHA256':r['snapshotSHA256'],'sourceLocator':locator,'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':method}
def fid(s):return 'facility:kanto-south-'+s
updates=[];verification=[];corrections=[]
def add(id,coord,ev,reason,support,extraction):
 updates.append({'facilityId':id,'coordinate':coord,'scope':'building','evidence':ev})
 verification.append({'facilityId':id,'reason':reason,'supportingSources':[ref(u) for u in support], 'extraction':extraction})
 oldlist=read('data/national/issue5/south-kanto.json')['unresolved']
 idx=next(i for i,x in enumerate(oldlist) if x['facilityId']==id)
 corrections.append({'facilityId':id,'sourceFile':'data/national/issue5/south-kanto.json','path':f'/unresolved/{idx}/reason','old':oldlist[idx]['reason'],'new':reason,'basis':ev,'applied':False})
zip_path='data/evidence/issue5/chubu/P05-22_GML.zip'
z=zipfile.ZipFile(ROOT/zip_path)
p05ref={'sourceUrl':'https://nlftp.mlit.go.jp/ksj/gml/data/P05/P05-22/P05-22_GML.zip','snapshotPath':zip_path,'snapshotSHA256':sha(ROOT/zip_path)}
extracts=[]
for suffix,pref,idx,support,reason in [
 ('integration-09','13',1642,['https://www.city.edogawa.tokyo.jp/e026/sports/kankomidokoro/bungakukan/manhole.html'],
 '新取得した区配布案内は中央1-4-1の本庁舎3階1番を明記。全国P05の江戸川区役所の名称・住所と対応する本庁舎建物代表点として十分。室内広報課の独立座標は不要。'),
 ('53fcefb12220c8b3f170','14',1159,['https://www.yamato-kankou.com/about-us/access/','https://yamato-bunka.jp/about/','https://yamato-bunka.jp/facility/','https://www.city.yamato.lg.jp/gyosei/yamatoshiinfo/kokyoshisetsu/gakushubunka/18087.html'],
 '新取得した協会アクセスは大和南1-8-1シリウス2階、建物運営者は生涯学習センターを同じ6階建てシリウスの構成施設と明記。市施設一覧も生涯学習センターを同住所とする。P05の生涯学習センター点を共有建物代表点として採用候補にする。2階窓口固有点は不要。')]:
 member=f'P05-22_{pref}_GML.zip';gj=f'P05-22_{pref}.geojson';zz=zipfile.ZipFile(io.BytesIO(z.read(member)));g=json.loads(zz.read(gj));f=g['features'][idx];lng,lat=f['geometry']['coordinates']
 ex={'facilityId':fid(suffix),'zipPath':zip_path,'member':member,'geojson':gj,'featureIndex':idx,'feature':f,'crs':g['crs']}
 extracts.append(ex)
 loc=f"{member} > {gj} features[{idx}]; {json.dumps(f['properties'],ensure_ascii=False)}; geometry.coordinates=[経度,緯度]をlat/lngへ組替え。JGD2011 EPSG:6668原値、変換なし。国土交通省 国土数値情報 市町村役場等及び公的集会施設データ（2022年4月）。"
 ev=evidence(p05ref,loc,'AIが原ZIPの数値と現行公式の名称・住所・入居建物を照合。国土交通省公開施設点の建物代表点利用。入口・室内の実測や現地確認ではない。出典と抽出加工を表示。')
 add(fid(suffix),{'lat':lat,'lng':lng},ev,reason,support,ex)
u='https://www.city.itabashi.tokyo.jp/_res/projects/default_project/_page_/001/035/617/131199_public_facility25.csv'
b=(ROOT/ref(u)['snapshotPath']).read_bytes()
try:t=b.decode('utf-8-sig')
except UnicodeDecodeError:t=b.decode('cp932')
row=next(r for r in csv.DictReader(t.splitlines()) if r['ID']=='131199000010')
ev=evidence(ref(u),'CSV ID=131199000010、名称=情報処理センター、所在地_連結表記=東京都板橋区板橋2-65-6、緯度/経度列。出典：板橋区「公共施設一覧」。CC BY 4.0（掲載ページで対象CSVに明示）、行抽出・字段組替え。',
 'AIが新取得CSV原値を区現行庁舎案内の情報処理センター6階くらしと観光課と照合。建物代表点であり6階室内位置の測量ではない。原典に測地系明記なし、座標変換なし。')
add(fid('integration-06'),{'lat':float(row['緯度']),'lng':float(row['経度'])},ev,
 '区公開CSVの情報処理センター建物行と区庁舎案内の6階くらしと観光課を新取得・照合。区役所本館とは別住所の建物点として十分。同CSV内の4階区民相談室・オンブズマン室には約13〜20m異なる点があるが、窓口点を平均せず建物名称そのものの行を採用する。',
 ['https://www.city.itabashi.tokyo.jp/kusei/joho/1035613/1035617.html','https://www.city.itabashi.tokyo.jp/kusei/chosha/1043016/1043099/1042900.html'],
 {'type':'csv','url':u,'idColumn':'ID','idValue':'131199000010','row':row,'latColumn':'緯度','lngColumn':'経度'})
u='https://www.city.urayasu.lg.jp/shisetsu/shikanren/shiyakusho/1005488.html'
m=re.search(r'maps\?q=([0-9.]+),([0-9.]+)',content(u));assert m
lat,lng=map(float,m.groups())
ev=evidence(ref(u),'市役所施設詳細（猫実一丁目1番1号）の地図リンク q='+m[1]+','+m[2]+'。公式HTML本文中の数値でありGoogle本体からの抽出ではない。',
 'AIが市の施設詳細原本と固定入力の猫実1-1-1市役所6階を照合。同一庁舎の建物点のみ。旧道路整備課の現在の配布継承は認定せず既存relation/statusを維持。測地系明記なし、変換なし。')
add(fid('integration-legacy-urayasu'),{'lat':lat,'lng':lng},ev,
 '建物位置と配布継承を分離する。固定入力の市役所6階・猫実1-1-1は市公式施設詳細の庁舎に対応し、建物点を追加できる。旧道路整備課の現配布継承不明は関係状態の問題として維持し、治水課への改称・統合・配布再開を認定しない。',
 [u],{'type':'official-q','url':u,'literal':'q='+m[1]+','+m[2]})

# A factual facility point is distinct from republication of the database/HTML.
for suffix,detail,support,reason in [
 ('121e759343c948057983','e146a011-4ebd-4785-83c0-52bb5e2ce26f',['https://www.city.sagamihara.kanagawa.jp/shisei/1026823/gesuido/1004546/1014470.html'],
 '新取得のJAPAN47GO LocalBusinessは相模湖観光案内所・与瀬1183（相模湖駅前）を個別に示し、市配布案内と一致する。公園地点ではなく案内所そのものの公開点を建物代表点の候補とする。一般的な文書転載禁止を座標事実利用の個別禁止と読み替えない。'),
 ('490affe5c4d10543f6b8','1a08e49c-2ea2-4abc-8b17-767b1236c02d',['https://miura-info.ne.jp/tourismassociation/','https://www.city.miura.kanagawa.jp/soshiki/gesuidoka/699.html'],
 '新取得の自治体・観光協会共同DBは海岸側センター上宮田1450-4の個別施設点。運営者現行案内も同住所を明記し、上宮田1497の駅前案内所とは区別している。このセンター建物の代表点を採用候補とし、駅前案内所へ共有しない。'),
 ('af1b056736ebfd481a88','4ef140be-042f-4b36-b9f1-2a0b0f45bf26',['https://www.chigasaki-kankou.org/information/','https://www.city.chigasaki.kanagawa.jp/kurasi_gesuido/1051217.html'],
 '新取得の協会案内は茅ヶ崎駅構内改札南側・ATM隣と明記。DBの茅ヶ崎市観光案内所LocalBusiness・元町1-1・電話0467-82-3986と現案内所の名称・電話・駅内所在地が対応する。駅全体の表示中心から作った値ではなく案内所個別公開点を建物代表点として提案する。室内ATM横の精密測位は不要。')]:
 u='https://www.japan47go.travel/ja/detail/'+detail
 data=[json.loads(v) for v in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>',content(u))]
 obj=next(v for v in data if v.get('@type')=='LocalBusiness')
 coord={'lat':obj['geo']['latitude'],'lng':obj['geo']['longitude']}
 ev=evidence(ref(u),'script[type=application/ld+json] @type=LocalBusiness, name='+obj['name']+'; address.streetAddress='+obj['address']['streetAddress']+'; geo.latitude / geo.longitude。出典：公益社団法人日本観光振興協会 JAPAN47GO（自治体・観光協会共同運営）。2数値を抽出、原値の変換なし。',
 'AIが個別施設GeoCoordinatesと市・運営者の現行名称・所在地・電話等を照合。Google地図本体から抽出せず、DB施設点を建物案内用に使用。原本全体の転載やDB一括再利用の許諾を認定したものではない。測地系明記なし。')
 add(fid(suffix),coord,ev,reason,support+['https://www.japan47go.travel/ja/about','https://kankou-data.nihon-kankou-dx.info/'],{'type':'jsonld-localbusiness','url':u,'object':obj})

save(OUT/'p05-extracted-records.json',extracts)
save(OUT/'building-verification.json',verification)
# Every assigned place receives fresh source attempts; screening is kept distinct from full building identification.
done={x['facilityId'] for x in updates}
notes={
 2:'新取得の市配布案内・移転関連原典を照合したが、第2分館の旧IDと新庁舎の対応を確定していない。P05本庁舎点で置換不可。',
 3:'新取得JAPAN47GOのLocalBusinessは相模湖観光案内所・与瀬1183、数値35.61684082/139.1897656。一般転載規約と座標事実利用の個別条件は別問題。DB点に対応する建物同定の追加裏付け、または自治体公開施設点を未取得。公園を扱うsagamiko.infoの地点は代用不可。',
 10:'今回はGO TOKYO公式詳細を取得できた。destinationは施設名文字列で数値を含まず、旧TLS/429だけを未解決理由にしない。有明水再生センター5階の建物点原典が残る。',
 11:'新取得した運営者ページは「大秦町1-1 小田急マルシェ秦野1階」。固定入力「小田急線秦野駅改札出て左」との階・位置関係が未確認。DB数値35.37028971/139.225494を旧窓口へ直ちに適用しない。一般転載規約のみを位置不採用理由にしない。',
 18:'新取得の協会本文は1450-4の海岸側センターと1497の駅改札前案内所を明確に区別。JAPAN47GOの数値35.18778076/139.6568178は前者の個別施設。建物に対応する自治体公開点や外形との独立照合が残る。原本再公開条件と座標事実の利用判断を別に扱う。',
 21:'市現行施設案内を追加取得。本庁舎・東庁舎・保健福祉センターを別々に列挙するが、棟別数値地点は本文から未取得。P05市役所1点のどの棟かが残る。',
 25:'CADANアクセスは今回もHTTP500。取得済み東京都案内の銭瓶町ビルディング1階という入居情報に対応する建物座標原典が残る。',
 27:'市「庁舎の概要・アクセス」を追加取得。P05市役所1点と第1庁舎の建物対応の照合は未完了。市役所住所一致だけで複数棟を統合しない。',
 33:'新取得の協会本文は駅構内改札南側・横浜銀行ATM隣と明記。DBの個別案内所点35.3303068/139.406757は取得済みだが、駅構内案内図と数値点の建物対応を独立に照合していない。一般転載規約だけを理由に拒否しない。',
 39:'追加取得の市施設案内は上下水道課を東庁舎2階と明記。本庁舎と区別が必要で、P05代表点の東庁舎への対応は未確定。',
 40:'上下水道局庁舎の現行公式ページを追加取得。所在地千代田1-2-32を照合したが、新庁舎を示す数値建物点の抽出まで未完了。',
 43:'市アクセスと2026年庁舎案内PDFを追加取得。南庁舎守衛室の棟同定資料はあるが、P05の2022年市役所点と再整備後の南庁舎の対応を確定していない。',
 52:'2022年11月14日の上下水道局新庁舎移転を説明する市広報PDFを追加取得。P05基準時点後の移転で、市役所の点を局庁舎へ流用できない。',
 53:'市広報PDFで上下水道局新庁舎移転を追加確認。旧萱田町サービス事務所と現局庁舎を区別し、宿直対応の現建物点原典を引き続き要する。',
 54:'2026年市庁舎案内PDFは観光協会を南庁舎1階と明記。守衛室と同じ建物の点を共有可能だが、南庁舎の数値位置の同定が未完了。',
 58:'新取得の三浦市観光協会本文で、駅前案内所=上宮田1497・駅改札外、海岸側センター=1450-4と別所在地を確認。同一建物ではなく、海岸側DB点の共有不可。',
 60:'追加取得した協会accessは区内交通全般の案内であり、協会が入居する区役所南館の目的地座標ではない。南館の建物点に対応する公開原典が必要。',
 62:'市広報PDFは新庁舎1階の給排水相談課を示す。建物移転の履歴と旧関係を分離し、当該旧IDの時点との対応を追加確認する。',
 63:'市広報PDFは新庁舎への移転・サービス連絡先を示すが、旧萱田町596-19の建物を同定する資料ではない。endedの旧施設へ現庁舎点を上書きしない。'
}
unresolved=[];screenings=[]
for idx,target in enumerate(targets):
 id=target['facilityId'];r=old[id]
 attempts=[]
 # add a shared supporting-source connection without fabricating another GET
 connected=[x for x in records if id in x['facilityIds']]
 if idx==58:connected.append(ref('https://miura-info.ne.jp/tourismassociation/'))
 for x in connected:
  a={'sourceUrl':x['url'],'fetchedAt':x['fetchedAt'],'status':x.get('status'),'result':x.get('error','原本取得。数値候補の有無をスクリーニング。HTTP成功だけでは建物位置の確認済みとはしない。')}
  for k in ['snapshotPath','snapshotSHA256']:
   if k in x:a[k]=x[k]
  attempts.append(a)
 numeric=[]
 for x in connected:
  if x.get('status')!=200:continue
  t=(ROOT/x['snapshotPath']).read_bytes().decode('utf8',errors='ignore')
  hits=[m.group(0) for m in re.finditer(r'(?:latitude|longitude)["\s:]*[0-9.]+|[?&](?:q|ll|destination)=35\.[0-9.,]+|LatLng\([0-9., ]+\)',t)]
  if hits:numeric.append({'sourceUrl':x['url'],'values':list(dict.fromkeys(hits))[:20]})
 screenings.append({'facilityId':id,'priorReason':r['reason'],'priorCategory':('条件未確認' if any(s in r['reason'] for s in ['許諾','利用条件']) else '移転別棟' if any(s in r['reason'] for s in ['棟','移転','東庁舎','南庁舎','新館']) else '未再調査' if '追加照合' in r['reason'] else '原典不足'),'freshAttempts':len(attempts),'numericScreening':numeric,'result':'candidate' if id in done else 'unresolved','priorEvidence':r['evidence']})
 if id in done:continue
 category='原典不足'
 if idx in [2,11,15,21,27,34,39,40,42,43,52,53,54,58,62,63]:category='移転別棟'
 if idx==59:category='建物対象外の可能性'
 if idx in [3,18,33]:category='建物対応の裏付け不足'
 newresult=notes.get(idx)
 if not newresult:
  newresult=f"今回{len(attempts)}出典を実取得し、公式本文の座標・目的地パラメータを追加スクリーニングした。"
  newresult+=f"数値を含む資料は{len(numeric)}件だが、建物代表点としての対象同定には未到達。" if numeric else '今回取得本文から対象建物に対応する数値座標を新たに特定できていない。'
  newresult+='残る確認事項：'+r['reason']
 unresolved.append({'facilityId':id,'reasonCategory':category,'reason':newresult,'nextSource':{'sourceUrl':r['nextSource']['sourceUrl'],'required': '当該建物の公式GIS施設Point、自治体施設CSVまたは建物外形。入口・室内窓口の精密座標は不要。詳細はreasonの棟・移転対応を確認。'},'investigationStatus':'new-fetch-and-targeted-review' if idx in notes else 'new-fetch-and-numeric-screening; building-identification-incomplete','attempts':attempts})
 if idx in [10,11,58]:
  oldlist=read('data/national/issue5/south-kanto.json')['unresolved'];oi=next(i for i,x in enumerate(oldlist) if x['facilityId']==id)
  corrections.append({'facilityId':id,'sourceFile':'data/national/issue5/south-kanto.json','path':f'/unresolved/{oi}/reason','old':r['reason'],'new':newresult,'basis':attempts,'applied':False})
save(OUT/'screening.json',screenings)
save(ROOT/'data/national/issue7/south-kanto.json',{'schema':1,'updates':updates,'unresolved':unresolved,'corrections':corrections})
# Reference old bytes rather than copying them. Preserve unknown original retrieval timestamps.
oldrefs=[]
for x in read('data/evidence/issue5/south-kanto/source-index.json'):
 if x.get('snapshotPath'):
  x=dict(x)
  if 'responseHeaders' in x:x['responseHeaders']={k:v for k,v in x['responseHeaders'].items() if k.lower()!='set-cookie'}
  oldrefs.append(x)
save(OUT/'reused-source-index.json',oldrefs)
print('updates',len(updates),'unresolved',len(unresolved),'corrections',len(corrections))
