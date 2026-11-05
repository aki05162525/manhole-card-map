from research import *
import html,xml.etree.ElementTree as ET
records=[]
for f in ['fetch-records.json','fetch-extra.json','fetch-extra2.json','fetch-extra3.json','fetch-extra4.json']:
 if (OUT/f).exists():records+=read(OUT/f)
byurl={r['url']:r for r in records}
def textof(r):return pathlib.Path(r['snapshotPath']).read_text(errors='replace')
def plain(s):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',s)))
def ref(r):return {k:r[k] for k in ['url','snapshotPath','snapshotSHA256','fetchedAt'] if k in r}
# AI decisions, explicitly selected records, never fuzzy-match approval.
p05={1:(22,825),2:(21,667),5:(21,887),7:(23,969),9:(21,1317),22:(22,437),25:(22,525),32:(21,880),36:(22,1802),37:(22,723),45:(22,525),49:(22,1807),51:(22,1837)}
identity={
1:'現行配布案内が福田400の福田支所2階を明記。名称住所はP05と一致。既知の移転・別棟矛盾はなく、改修履歴の不存在証明は建物代表点に不要。',
2:'現行市配布案内は美濃加茂市上下水道課（市役所分庁舎）、太田町1900と明示。P05も分庁舎の同名同住所で本庁舎ではない。',
5:'市施設案内2207.htmが市民センターは瑞穂市穂積公民館と瑞穂市体育館の複合施設と明示。別府1300-3のP05穂積公民館を同定。体育館内部や1階窓口の精密測位は主張しない。',
7:'観光協会施設案内が刈谷駅前観光案内所の入居先を産業振興センター1F、相生町1-1-6と明示。P05産業振興センターの建物点を使用。観光協会HTMLの案内所目的地(34.99063742782774,137.01125979423523)とは約31m異なる。名称・住所と入居先が一致する一方、観光目的地の点を建物内部と判断する根拠はないため、建物外周内を位置検査対象とするP05収容建物点を優先。別数値を平均・付け替えせず記録する。',
9:'現行配布案内は池田町役場、町庁舎案内・所在地は六之井1468-1。P05同名同住所を建物代表点として同定。',
22:'現行配布案内は本庁舎1階総合案内。P05沼津市役所御幸町16-1を、2026年の市役所施設案内と県公開AEDの同住所1階正面玄関横・3階医務室内の2点に照合。P05は両点付近の本庁舎、別住所2-20の水道部庁舎とは約100m離れており区別。今回取得した本庁舎1階図で総合案内は正面玄関側、別館とは区別されている。総合案内の室内位置としては主張しない。',
25:'旧移転理由は誤読。元地域監査の22-207-C001 proposalsは寄って宮休業時の臨時配布。現在の逆さ富士配布案内は市役所1階当直室で、下水道課案内は弓沢町150の市役所5階。P05富士宮市役所を同定。',
32:'現行市配布案内は巣南庁舎下水道課、宮田300番地2。P05に同名同住所2点（879/880）が約4m離れて存在するが別棟名・異住所の競合ではなく、建物代表点精度では整合。正式市役所名の880を選択し平均は取らない。',
36:'町配布案内と指定管理者アクセスはウエルピアながいずみ健康づくりセンター、納米里549。P05健康づくりセンター同住所の建物点を同定。町役場の点とは区別。',
37:'市現行配布案内は富士市役所北口守衛室、永田町1丁目100番地。P05富士市役所の建物点を同定。県富士総合庁舎（本市場441-1）と区別し、北口の入口精密点は要求しない。今回取得した市庁舎1階図は北口に警備員室（夜間休日受付）を表示する。',
45:'現行下水道課ページが弓沢町150（市役所5階）を明記し配布案内も一致。旧臨時庁舎移転理由を元proposalに遡って棄却。P05富士宮市役所を同定。',
49:'現行町配布案内は役場上下水道課、中土狩828。各課連絡先で上下水道課の本館2階を確認。P05長泉町役場の同名同住所点を本館代表点として対応付け。西館の課や窓口位置としては使用しない。',
51:'現行町配布案内はしらすの窓口定休日の代替が吉田町役場2階上下水道課、住吉87。P05同名同住所の建物点と照合。一般的な改修履歴証明だけを追加条件にしない。',
3:'飛騨高山観光公式の中橋観光案内所ページは本町1-2を明記し、当該施設iframeのplace数値qとgConfが一致。Google本体応答の抽出ではなく公式HTMLが指定する施設目的地。',
28:'飛騨市観光公式モデルコース73のmarkerData label 4は名称「飛騨古川まちなか観光案内所」と緯度経度を直接持つ。市配布案内の壱之町8-3の案内所と同定。駅横の別案内所と区別。',
14:'県公開の沼津市AEDデータID 0000000030は水道部庁舎、御幸町2-20、1階自動ドア前、電話934-4851。現行市配布案内が水道部庁舎1階守衛室、電話一覧が同庁舎水道総務課庶務係934-4851を明示。同一建物を電話・名称・階で対応付け。台帳16-1は本庁住所なので訂正提案を分離。',
50:'県公開AED ID 0000000030の水道部庁舎を現行配布案内の水道部庁舎2階水道総務課及び公式電話一覧934-4851と同定。住所は2-20を根拠とし台帳16-1の訂正提案を分離。AEDは1階自動ドア前の建物代表点としてのみ使用し2階窓口精密点とはしない。'}
# Individual unresolved outcomes from newly fetched sources, with concrete next evidence.
notes={
0:('原典不足','町の現行案内で年末年始の石廊崎546-5を再確認。運営者アクセスはTLS hostname mismatchで取得不能。公園名だけでは休憩棟を選べない。','運営者の休憩棟配置図と建物GIS'),
4:('原典不足','町の現行案内は1812-10の駅北口案内所を明記するが数値建物点は掲載しない。P05に対象案内所の確実な一致なし。','垂井駅北口観光案内所の自治体施設GIS'),
6:('原典不足','現行案内の地図URLは施設名qとll表示中心のまま。観光公式アクセスにも対象建物の数値は得られなかった。駅構内という情報だけでllを採用しない。','伊東駅駅舎の公開建物外形と案内所入居説明'),
8:('原典不足','市の配布案内と観光協会aboutを再取得し栄町1-2-14を確認。今回取得HTMLに建物を特定した数値なし。Google制限先は再訪しない。','観光協会建物の自治体GISまたは施設台帳'),
10:('移転別棟','観光公式配布ページと施設詳細を再取得。施設詳細には複数の地点・施設が含まれ、本社/史料館/売店のどの建物で配布するか未解決。','カクキューのカード配布棟と棟別配置図'),
11:('移転別棟','現行配布案内は第二庁舎1階。一般市役所施設ページの数値qは中央町1-1の庁舎代表で第二庁舎との対応を確定できず、P05第一庁舎候補を流用しない。','熱海第二庁舎の棟別GISと所在地'),
12:('原典不足','県Wi-Fiの施設名付き点を再取得したが砂山町265-16と固定台帳265-13の差が残る。駅内建物の対応を示す資料を今回得られなかった。','観光案内所と駅舎の入居図及び住所対応'),
13:('移転別棟','市配布先は新居関所史料館1227-5。観光協会埋込は新居関所の住所featureであり史料館棟の点にはしない。','史料館棟を識別できる市施設GISまたは建物外形'),
15:('移転別棟','町配布案内と県の観光施設データを再取得。県の点は道の駅ふじおやま名で、観光案内所が入る棟との対応は今回未確定。','道の駅の観光案内所入居棟図と建物外形'),
16:('原典不足','市の陶磁器会館施設詳細は403。別のやきもの散歩道公式案内を追加取得して住所・施設を調査。市ページへの制限回避は行わない。','陶磁器会館の建物目的地を示す公開GIS'),
17:('原典不足','現行市案内は中央公園内の千福7-1で、llは表示中心。観光協会公式は403。公園住所を事務所棟の点と言い換えない。','観光協会事務所の棟別地図'),
18:('移転別棟','現行配布先北庁舎2階を確認。新たに有効な市ドメインの庁舎案内図ページを取得できたがP05一般市役所点と北庁舎の数値対応は未解決。','関市北庁舎の建物外形とP05重ね合わせ'),
19:('移転別棟','市配布案内と運営者駅舎カフェaccessを再取得。駅全体の埋込しか得られず駅舎建物を数値で区別できなかった。','郡上八幡駅舎の建物外形または公式施設marker'),
20:('移転別棟','配布先は掛川城券売所と再確認。市庁舎案内はこの窓口の座標根拠にならず、城公園の点を流用しない。','券売所棟の公園配置図と地理参照可能な建物外形'),
21:('原典不足','市施設案内は名称qと表示中心ll。売店・レストラン・足湯があり当該配布建物の数値を確認できず。','道の駅潮見坂の配布建物案内と公開建物点'),
23:('移転別棟','市の配布先と運営者ホームを再取得。温泉・物産等の複数施設があり道の駅全体の埋込だけでは配布棟を特定できない。','道の駅やまと窓口の入居棟図'),
24:('移転別棟','現行市配布案内と庁舎案内を再取得。上下水道課の西館という旧記録を棄却する資料なし。P05一般市役所点を西館へ流用しない。','海津市西館の建物外形と案内図'),
26:('座標競合','市配布ページ403に対し運営者園内図・トップを取得。P05樹空の森と富士山交流センターは約126m異なる。ビジターセンターとの地理的対応は未確定。','園内図のビジターセンターとP05の2点の位置照合'),
27:('原典不足','現行GKPで登窯広場展示工房館を確認しP05を検索したが、名称住所付き一致点が得られない。今回施設個別ページの追加取得までは未実施。','登窯広場展示工房館の市施設ページと建物GIS'),
29:('原典不足','市配布案内とskydome公式を新規取得。公式埋込は依然住所ラベルで建物外形由来か不明。旧Google抽出を採用しない。','道の駅の建物外形と店舗配布場所'),
30:('移転別棟','北庁舎1階守衛室を現行配布案内で再確認。北庁舎2階と同じ棟でよいが一般P05市役所点との対応が未確認。','関市北庁舎の公開棟別GIS'),
31:('移転別棟','高山市の配布案内と岐阜観光公式施設ページを再取得。後者は数値qを持つが道の駅内配布棟との対応を今回確認できない。','道の駅ひだ朝日村の配布棟配置図'),
33:('原典不足','現行市配布案内と既存アクセスの再調査で新町2-34の施設を確認。現建物とP05の旧施設との同一性が未確認のため、旧施設点に対応させない。','ひと・まちテラスの現行建物外形/施設GIS'),
34:('原典不足','町の配布案内は下賀茂の道の駅内観光協会。今回の原本にはこの建物を特定する数値なし。別施設オーシャンパークとは分離。','南伊豆町観光協会の建物GIS'),
35:('原典不足','現行の配布原典取得を試みた。既知の403を突破せず、森川町井桁西25-1にある観光協会の建物座標原典は今回確保できていない。','愛西市公開GIS又は観光協会建物図'),
38:('移転別棟','現行市配布案内と市役所詳細は取得。第一庁舎1階警備員室とP05一般市役所点の棟対応は第二庁舎との区別資料不足で保留。','熱海第一・第二庁舎の棟別配置図'),
39:('原典不足','市配布案内と観光協会accessを再取得。埋込は中泉1-1-5の住所featureであり建物点の生成根拠は不明。福田支所の点を流用しない。','磐田観光協会建物の公開GIS'),
40:('移転別棟','観光公式配布ページとまるや運営者トップを新規取得。配布紹介は旧住所表記、運営者は八丁町52番地。本社markerが配布棟かは未確定。','まるや配布棟案内と住所変更対応'),
41:('移転別棟','市配布案内・市観光詳細・道の駅公式を再取得。市の旧MyMaps埋込は表示中心しか得られず2階事務局棟の数値にはできない。','下田市観光協会事務局が入る棟の公開GIS'),
42:('移転別棟','市配布案内と道の駅美並公式accessを再取得。物産館名は配布先にあるが地図は道の駅全体で棟との対応未確認。','美並物産館の建物外形と施設配置図'),
43:('移転別棟','旧URLが現行サイトへ転送され取得成功。配布は庁舎2階事務室と確認。ポンプ場名付き埋込のviewportは庁舎座標にはしない。','岳南排水路管理組合の庁舎棟配置図/公開GIS'),
44:('移転別棟','市の現行配布案内を取得。あじさいエコパークの配布棟指定は引き続き本文にない。分庁舎点は別IDへ限定。','蜂屋川クリーンセンター管理棟の配布案内と建物外形'),
46:('原典不足','市配布案内とアントレテナントページを再取得し2階入居確認。駅ビル建物の数値原典を得られず。','アントレ駅ビル建物外形/施設GIS'),
47:('原典不足','科学館配布・利用案内を再取得して住所を確認。取得HTMLから対象建物の数値を確定できず、他市の科学館点は不使用。','愛知県下水道科学館の建物GIS'),
48:('原典不足','GKP現行行を取得。県観光の施設詳細はタイムアウトで取得できず、JR大府駅構内という記載だけでは当該建物点を確定できない。','KURUTO運営者の駅舎入居図と建物外形')}
updates=[];p05records=[];invest=[];unresolved=[]
z=zipfile.ZipFile('data/evidence/issue5/chubu/P05-22_GML.zip');datasets={}
for pref in [21,22,23]:
 inner=f'P05-22_{pref}_GML.zip';zz=zipfile.ZipFile(io.BytesIO(z.read(inner)));member=f'P05-22_{pref}.geojson';raw=zz.read(member);datasets[pref]=(json.loads(raw),inner,member,hashlib.sha256(raw).hexdigest(),zz)
zipPath='data/evidence/issue5/chubu/P05-22_GML.zip'
for n,id in enumerate(ids):
 attempts=[{**ref(r),'status':r.get('status'),'error':r.get('error'),'type':'new-fetch'} for r in records if id in r.get('facilityIds',[])]
 attempts.append({'type':'new-local-dataset-search','sourcePath':'data/evidence/issue5/chubu/P05-22_GML.zip','resultPath':'data/evidence/issue7/tokai/p05-search.json','sourceLocator':'facilityId='+id,'result':'名称・住所の全feature検索。候補は採否を別途判断。'})
 oldreason=un.get(id,{}).get('reason','issue5 review deferred: 建物継続使用又は別棟の追加根拠要求')
 oldcat='未再調査' if '追加proposal' in oldreason else ('過剰な精度要求' if n in [1,51] else ('移転別棟' if any(k in oldreason for k in ['別棟','移転','庁舎','建物の指定','複数']) else '原典不足'))
 inv={'facilityId':id,'name':places[id]['name'],'priorReasonCategory':oldcat,'priorReason':oldreason,'priorSource':'data/national/issue5/chubu.json','baselineEvidence':places[id]['evidence'],'investigationStatus':'new-source-retrieval-and-local-dataset-research','attempts':attempts}
 if n in p05:
  pref,idx=p05[n];d,inner,member,msha,zz=datasets[pref];f=d['features'][idx];lng,lat=f['geometry']['coordinates'];locator=f'{inner}!{member}#/features/{idx}'
  e={'sourceUrl':'https://nlftp.mlit.go.jp/ksj/gml/data/P05/P05-22/P05-22_GML.zip','snapshotPath':zipPath,'snapshotSHA256':sha(zipPath),'sourceLocator':locator+'; '+f['properties']['P05_003']+' / '+f['properties']['P05_004'],'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'AIが国交省P05-22建物Pointの名称・住所を現行公式案内と照合。'+identity[n]+' EPSG:6668/JGD2011のGeoJSON原数値をlat/lngに順序変更のみ。P05の作成工程には住所ジオコーディングが含まれるが、本調査で住所から座標を生成してはいない。室内・入口測量ではない。'}
  updates.append({'facilityId':id,'coordinate':{'lat':lat,'lng':lng},'scope':'building','evidence':e})
  p05records.append({'facilityId':id,'locator':locator,'rawFeature':f,'memberSHA256':msha,'crs':d['crs']})
 elif n in [3,28,14,50]:
  url=places[id]['evidence']['sourceUrl'] if n==3 else ('https://www.hida-kankou.jp/courses/73' if n==28 else 'https://opendata.pref.shizuoka.jp/dataset/8504/resource/51192/content.html');r=byurl[url];s=textof(r)
  if n==3:
   m=re.search(r'var gConf\s*=\s*\{lat:([\d.]+),lng:([\d.]+)',s);lat,lng=map(float,m.groups());locator='施設名「中橋観光案内所」、本町1-2; iframe embed/v1/place q='+m[1]+','+m[2]+'; gConf(id:4827)と一致'
  elif n==28:
   m=re.search(r"label: '4',\s*name: (\".*?\"),\s*lat: Number\('([\d.]+)'\),\s*lng: Number\('([\d.]+)'\)",s);assert json.loads(m[1])=='飛騨古川まちなか観光案内所';lat,lng=float(m[2]),float(m[3]);locator='markerData.push label=4; name=飛騨古川まちなか観光案内所; lat/lng Number literals'
  else:
   row=next(t for t in re.findall(r'<tr.*?</tr>',s,re.S) if '0000000030' in t);cells=[plain(t).strip() for t in re.findall(r'<td[^>]*>(.*?)</td>',row,re.S)];lat,lng=float(cells[14]),float(cells[15]);assert cells[3]=='水道部庁舎';locator='AED設置箇所一覧 HTML table; ID=0000000030; 名称=水道部庁舎; 緯度・経度列; 設置位置=1階自動ドア前'
  e={'sourceUrl':url,'snapshotPath':r['snapshotPath'],'snapshotSHA256':r['snapshotSHA256'],'sourceLocator':locator,'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'AIが今回取得した公式原本の名称付き目的地数値を抽出。'+identity[n]+' 原本に明示的な測地系の記載は未確認。Web地図用緯度経度として無変換で使用し、測量精度やWGS84への変換済みを主張しない。'}
  updates.append({'facilityId':id,'coordinate':{'lat':lat,'lng':lng},'scope':'building','evidence':e})
 else:
  cat,reason,nextsource=notes[n];unresolved.append({'facilityId':id,'reasonCategory':cat,'reason':reason,'nextSource':nextsource,'investigationStatus':'追加確認実施・建物点未確定','attempts':attempts})
 inv['result']='candidate' if n in identity else 'unresolved';inv['finding']=identity.get(n,notes.get(n,('', ''))[1]);invest.append(inv)
# Keep old sources referenced, not duplicated.
corrections=[]
for n in [25,45]:
 id=ids[n]
 for path,key in [('data/national/issue5/chubu.json','unresolved'),('data/national/location-updates/chubu-west.json','unresolved')]:
  d=read(path)
  for idx,x in enumerate(d.get(key,[])):
   if x['facilityId']==id:
    corrections.append({'facilityId':id,'targetPath':path,'jsonPointer':f'/{key}/{idx}/reason','old':x['reason'],'new':'元地域監査22-207-C001のproposalは寄って宮臨時休業時の市役所での臨時配布であり、臨時庁舎への移転ではない。現行市役所窓口は弓沢町150。座標候補はissue7/tokaiのP05根拠を参照。','basis':{'sourcePath':'data/national/regions/chubu-west.json','sourceLocator':'cardId=22-207-C001 proposals; 保存済み原本 data/evidence/national/chubu-west/7bab59f2246fd1c52d07.html と今回取得の市配布案内/下水道課案内を照合'}})
for path,key in [('data/national/issue5/chubu.json','unresolved'),('data/national/location-updates/chubu-west.json','unresolved')]:
 for idx,x in enumerate(read(path).get(key,[])):
  if x['facilityId']==ids[28]:
   corrections.append({'facilityId':ids[28],'targetPath':path,'jsonPointer':f'/{key}/{idx}/reason','old':x['reason'],'new':'保存済み公式モデルコース73のmarkerData label=4に飛騨古川まちなか観光案内所の緯度36.2350326、経度137.1863768が存在する。今回の再取得でも一致した。金森町8-32の駅横施設とは区別する。','basis':{'snapshotPath':'data/evidence/national/locations-chubu-west/ab548fdcccd6faf9a5538375.html','snapshotSHA256':sha('data/evidence/national/locations-chubu-west/ab548fdcccd6faf9a5538375.html'),'sourceLocator':'markerData.push label=4, name, lat, lng'}})
corrections.append({'targetPath':'data/evidence/national/chubu-west/README.md','textReplacement':True,'old':'富士宮臨時市役所','new':'寄って宮臨時休業時の富士宮市役所での臨時配布','basis':{'sourcePath':'data/national/regions/chubu-west.json','sourceLocator':'cardId=22-207-C001 proposals。臨時庁舎移転の提案ではない。'}})
for n in [14,50]:
 id=ids[n];new=places[id]['address'].replace('16-1','2-20');corrections.append({'facilityId':id,'targetPath':'data/work/issue7-baseline/ledger.json','selector':{'id':id,'field':'address'},'old':places[id]['address'],'new':new,'applyTo':'親の将来統合コピーのみ。固定入力は変更禁止。','basis':ref(byurl['https://opendata.pref.shizuoka.jp/dataset/8504/resource/51192/content.html'])|{'sourceLocator':'ID=0000000030 水道部庁舎、電話934-4851。市電話一覧の水道総務課庶務係と同定。'}})
save(OUT/'p05-records.json',p05records);save(OUT/'investigation.json',invest)
save('data/national/issue7/tokai.json',{'schema':1,'updates':updates,'unresolved':unresolved,'corrections':corrections})
print('updates',len(updates),'unresolved',len(unresolved),'corrections',len(corrections))
