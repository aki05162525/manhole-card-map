"""Offline candidate packaging and checks; writes only issue7/koshin artifacts."""
import json,hashlib,zipfile,io,re,datetime
from pathlib import Path
R=Path('data/evidence/issue7/koshin');B=Path('data/work/issue7-baseline');O=Path('data/national/issue7/koshin.json')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def dump(p,x):Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
ids=read(B/'assignments.json')['koshin'];ps={p['id']:p for p in read(B/'ledger.json')['places']};prior=read('data/national/issue5/chubu.json');olds={x['facilityId']:x for x in prior['unresolved']};review=read('data/national/issue5/reviews/chubu.json')
rows=sum([read(R/f) for f in ['fetch-records.json','fetch-additional.json','fetch-focused.json','fetch-layouts.json']],[]);byurl={x['sourceUrl']:x for x in rows};links=read(R/'additional-links.json');checked=datetime.datetime.now(datetime.timezone.utc).isoformat()
zpath='data/evidence/issue5/chubu/P05-22_GML.zip';zm=read(zpath+'.source.json');assert sha(zpath)==zm['sha256'];z=zipfile.ZipFile(zpath);geo={};members={}
for pref in [19,20]:
 sn=f'P05-22_{pref}_GML.zip';sub=zipfile.ZipFile(io.BytesIO(z.read(sn)));gn=f'P05-22_{pref}.geojson';raw=sub.read(gn);geo[pref]=json.loads(raw);members[pref]={'archive':sn,'member':gn,'memberSHA256':hashlib.sha256(raw).hexdigest(),'crs':geo[pref].get('crs')}
# Explicit human-readable AI identity decisions, not fuzzy matching.
selected={1:(19,966,'配布本文が船津1754の生涯学習館（図書館）を指定。船津1700の町役場とは別のP05地物。'),2:(19,127,'市役所施設詳細1776.htmlの配置課に上下水道課。P05北別館(index134)と区別し市役所名の地物を使用。'),8:(20,1463,'運営施設案内が更埴文化会館あんずホール・杭瀬下1-64を示す。P05重複1503は約4mの差で同施設。現配布ページの掲載範囲と旧関係は変更せず、施設建物のみの候補。'),9:(20,2889,'公式配布本文と村役場紹介で古見1555-1の役場を同定。'),14:(20,1551,'市配布案内の総合観光会館を県公式観光詳細3402の上山田温泉2-12-10と照合。前回503の貸館ページへ依存しない。'),15:(20,3026,'公式配布案内で小布施1491-2の役場建設水道課窓口を明記。'),19:(20,2403,'第16弾市田柿の休日配布は下市田2183-1の役場日直室。教育委員会・図書館の別施設点は使わない。'),21:(20,673,'公式配布案内で図書館と市庁舎を区別し下水道課は市庁舎2階。P05小諸市役所を使用。'),22:(20,3026,'同じ小布施役場の宿日直室。室内位置は要求せず建物点を共有。'),23:(20,673,'公式配布案内で宿日直室は市庁舎1階。こもろプラザの点は使わない。'),26:(20,2889,'公式本文が役場建物裏側の休日通用門と明記。同じ建物代表点であり入口位置ではない。'),27:(20,1529,'今回再取得の市配布本文・運営施設案内で上山田温泉3-1-1の上山田文化会館を照合。既知の移転・別棟競合は確認されず、一律の2022年以後改修履歴証明は要求しない。'),30:(20,420,'現配布本文が幸町8-1の市庁舎4階を指定。旧岡谷市役所建物とは区別。'),32:(20,2403,'第16弾市田柿の平日配布は同役場環境水道課。'),42:(20,1606,'今回取得の101437.htmlで本庁舎西側勤労者会館1階への入居を確認。住所は固定配布根拠PDFの県291-5とP05で一致。本庁舎点は使わない。')}
notes={
0:('relocation-or-separate-building','今回取得した宿日直案内PDFを画像で確認し、庁舎西側棟南端の入口まで同定。P05旧田富庁舎点がこの棟内か、南館との対応を未確認。入口精度ではなく棟対応が残る。','中央市の現庁舎棟別GIS・公共施設台帳'),
3:('insufficient-primary-coordinate','市配布ページと駅市民サービス案内を再取得。JR駒ヶ根駅構内を確認したが建物Pointなし。llのみの地図中心は採用せず、駅舎代表点が得られれば足りる。','JRまたは市の駅舎建物GIS'),
4:('relocation-or-separate-building','市配布案内と観光協会告知を再取得。臨時駐車場内のまちの案内所で、南側FARM BASEは対象外と明記。トレーラーハウスの数値原典未取得。','fumottoの現配置図とトレーラーハウスを示す公的GIS'),
6:('coordinate-conflict','市配布案内・大手事務所案内を再取得。大手3-8-13の事務所1階まで確認。既存の駐車場地物と大手公民館3-8-1は別対象で転用しない。','松本市大手事務所の建物GIS・施設台帳'),
7:('relocation-or-separate-building','県配布案内とふれあいまつり案内を再取得。管理本館1階の指定を確認したが処理場全体と管理棟を分離した数値原典なし。','県下水道公社の棟配置図に対応する管理本館GIS'),
10:('relocation-or-separate-building','配布本文は南館上下水道課。市役所アクセスと宿日直案内PDFも取得したが本館側の地図中心や視点を南館座標にしない。','中央市南館の棟別GIS・公共施設台帳'),
11:('relocation-or-separate-building','県配布案内とまつり案内を再取得。管理本館1階ロビーは確認できるが管理棟の数値原典が未取得。受付・ロビーの室内差は保留理由ではない。','県下水道公社の管理本館GIS'),
12:('insufficient-primary-coordinate','市配布案内と観光協会アクセスを再取得。大町3200・信濃大町駅構内の案内所を確認。交通アクセス図の概略位置から建物点は生成しない。','信濃大町駅舎の公的建物GIS'),
13:('relocation-or-separate-building','県配布案内と事務所アクセスを再取得。真島町川合1060-1のアクアパル管理本館が対象。別処理場クリーンピアや処理場敷地代表点は不採用。','アクアパル千曲管理本館の棟別GIS'),
16:('relocation-or-separate-building','市案内・観光協会アクセスと追加公式ページを取得。現公式フッターは猿橋55大黒屋1階で、旧大月1-1-33の施設へ流用不可。旧関係は維持。','旧駅前観光協会建物の公的GIS・旧施設図'),
17:('insufficient-primary-coordinate','市配布案内・商店街公式を再取得。追加の市案内図PDFを画像確認し十三くら764-1と寺子屋758を区別。カード印刷の数値は蓋座標なので採用しない。','十三くらの建物GISまたは公式施設marker'),
18:('relocation-or-separate-building','市配布案内・ゆきむら夢工房施設案内を再取得。長6090-1の住所地図と隣接直売所の区別に必要な建物数値は未取得。','ゆきむら夢工房の独立した建物GIS'),
20:('insufficient-primary-coordinate','市配布案内・観光協会の施設紹介とアクセスを再取得。小諸駅舎内を確認。室内窓口精度は不要だが駅舎の数値原典が未取得。','しなの鉄道または市の小諸駅舎建物GIS'),
24:('relocation-or-separate-building','町配布案内・振興公社施設案内を再取得。軽井沢駅北口西側から入るさわやかハット2階と確認。駅全域と対象建物を区別する数値原典なし。','さわやかハット棟の公的建物GIS'),
25:('relocation-or-separate-building','市配布案内・水道事務所施設ページを再取得。篠原2534-1の水道事務所は竜王庁舎南側別棟。竜王庁舎点やll表示中心を不採用。','甲斐市水道事務所の建物GIS'),
28:('relocation-or-separate-building','県配布案内・事務所概要を再取得。管理棟の指定まで確認できたが豊科田沢6709の処理場敷地から棟点を抽出する根拠なし。','アクアピア安曇野管理棟の公開GIS'),
29:('insufficient-primary-coordinate','市配布案内と観光協会アクセスを再取得。JR上諏訪駅内諏訪1-1-18を確認。協会事務局や諏訪市全体の地図は代用しない。','JR上諏訪駅舎の公的建物GIS'),
31:('relocation-or-separate-building','市配布ページ・道の駅アクセス・追加観光協会施設ページを取得。あさしな亭と配布窓口の同棟関係は未検証。PDFのカード座標は蓋であり採用しない。','道の駅物産販売棟とレストランの現配置図'),
33:('relocation-or-separate-building','県配布案内とアクセスを再取得。赤沼2455の管理本館1階警備員室は確認。管理棟の数値原典が不足。室内警備員室の位置は要求しない。','クリーンピア千曲管理本館の公開GIS'),
34:('insufficient-primary-coordinate','市配布案内・観光協会和田城記事・市立博物館分館紹介を再取得。南信濃和田1192と一致する数値markerを確認できず、本館埋込は転用しない。','飯田市遠山郷土館の公的建物GIS'),
35:('relocation-or-separate-building','市配布案内・庁舎案内図・アクセスを再取得。花咲1608-19の花咲庁舎を本庁舎と区別。対象棟の数値原典なし。','大月市花咲庁舎の建物台帳・GIS'),
36:('insufficient-primary-coordinate','市配布ページ・県施設詳細・観光協会一覧を再取得。長野駅東西自由通路の入居確認まで。駅舎代表点で足りるがその数値原典が不足。','長野駅橋上駅舎の公的建物GIS'),
37:('relocation-or-separate-building','県配布案内・事務所アクセスを再取得。管理本館2階と確認。1階警備室と共通の建物点で足りるが棟数値原典未取得。','クリーンピア千曲管理本館の公開GIS'),
38:('insufficient-primary-coordinate','町配布案内・妻籠公式アクセスを再取得。吾妻2196-1の案内所と宿場全域の地図を区別。宿場エリア点は採用不可。','妻籠観光案内所の建物GIS・施設詳細marker'),
39:('insufficient-primary-coordinate','市配布ページ・観光協会追加ページを取得。猿橋55大黒屋1階を確認したが公式建物数値markerなし。旧駅前窓口座標の流用不可。','猿橋大黒屋の建物GIS・公式施設marker'),
40:('insufficient-primary-coordinate','市配布ページ・商店街ホームページ・市の案内図PDFを取得。PDF画像で岩村田758を確認、十三くら764-1と区別。数値はカードの蓋座標のため不採用。','岩村田寺子屋758の建物GIS'),
41:('insufficient-primary-coordinate','県観光施設ページと観光協会公式ホームページを取得。田中279・田中駅の情報ステーションを確認したが駅建物数値原典なし。','田中駅舎の公的建物GIS')}
# Supplement every facility with actual fresh retrieval records; old reads are separately labelled.
extra={0:['MHCsyukunittyokusituannaiPDF.pdf'],5:['127168.html','13805.html','googlemap.js','42264.html','132245.html'],10:['MHCsyukunittyokusituannaiPDF.pdf'],14:['id%3D3402'],17:['ananizu.pdf'],31:['sakukankou.jp/sightseeing/hotpark-asashina/'],39:['content-page/view/2'],40:['www.iwamurada.com/','ananizu.pdf'],41:['www.tomikan.jp/'],42:['101437.html']}
classification=[];updates=[];unresolved=[];records=[]
for i,id in enumerate(ids):
 p=ps[id];urls=[p['evidence']['sourceUrl']]+links.get(id,[])
 urls += [r['sourceUrl'] for r in rows if any(t in r['sourceUrl'] for t in extra.get(i,[]))]
 attempts=[dict(byurl[u],kind='fresh-http') for u in dict.fromkeys(urls) if u in byurl]
 old=olds.get(id);originalReason=old['reason'] if old else 'Issue5独立レビューで建築改修履歴不足として保留。'
 category='insufficient-primary-coordinate'
 if i in [0,39,40,41,42]:category='not-previously-investigated'
 elif i==27:category='overstrict-building-history-requirement'
 elif i in notes:category=notes[i][0]
 c={'facilityId':id,'name':p['name'],'priorReasonCategory':category,'priorReason':originalReason,'investigationStatus':'fresh-primary-retrieval-and-prior-reread','attempts':attempts,'priorEvidence':p['evidence']}
 if i in selected:
  pref,index,judgment=selected[i];f=geo[pref]['features'][index];lng,lat=f['geometry']['coordinates'];locator=f"P05-22_{pref}_GML.zip / P05-22_{pref}.geojson / features[{index}] / {f['properties']['P05_003']} / {f['properties']['P05_004']}"
  ev={'sourceUrl':zm['url'],'snapshotPath':zpath,'snapshotSHA256':zm['sha256'],'sourceLocator':locator,'checkedAt':checked,'actorType':'ai','verificationMethod':judgment+' 国土交通省P05-22建物配置点を原数値のまま緯度経度順に組替え。EPSG:6668/JGD2011、室内・入口測量ではない。出典・加工・現行照合はdata/evidence/issue7/koshin/README.mdとclassification.json。'}
  updates.append({'facilityId':id,'coordinate':{'lat':lat,'lng':lng},'scope':'building','evidence':ev})
  records.append({'facilityId':id,'prefecture':pref,'featureIndex':index,'feature':f,**members[pref]});c.update(result='candidate',judgment=judgment)
 elif i==5:
  r=byurl['https://www.city.ueda.nagano.jp/map/13805.html'];raw=Path(r['snapshotPath']).read_text();lat=float(re.search("initlat = '([^']+)'",raw)[1]);lng=float(re.search("initlong = '([^']+)'",raw)[1]);judgment='市施設HTMLのinitlat/initlongが市配信JSのmarkerOpts.positionに使われる。現住所下武石742をフロア案内・2021年供用開始の総合センターと照合。P05旧自治センター(index352)・旧健康センター(index397)は不採用。現公民館index398は同総合センター2階を指定し約23m差だが、候補は現市公式markerを優先。Google本体応答の抽出なし。'
  ev={k:r[k] for k in ['sourceUrl','snapshotPath','snapshotSHA256']};ev.update(sourceLocator="var initlat / var initlong; /ssi/js/shisetsu-detail-googlemap.js markerOpts.position=myLatlng",checkedAt=checked,actorType='ai',verificationMethod=judgment+' 数値事実の出典付き利用。一般著作権規定はREADME参照。')
  updates.append({'facilityId':id,'coordinate':{'lat':lat,'lng':lng},'scope':'building','evidence':ev});c.update(result='candidate',judgment=judgment)
 else:
  category,reason,nxt=notes[i];unresolved.append({'facilityId':id,'reasonCategory':category,'reason':reason,'nextSource':nxt,'investigationStatus':'fresh-primary-retrieval-partial-coordinate-investigation','attempts':attempts});c.update(result='unresolved',judgment=reason)
 classification.append(c)
# Exact correction proposal to obsolete review reasoning, not a mutation or distribution change.
ri=next(i for i,r in enumerate(review['reviews']) if r['facilityId']==ids[27]);oldreview=review['reviews'][ri]
corrections=[{'facilityId':ids[27],'targetFile':'data/national/issue5/reviews/chubu.json','jsonPointer':f'/reviews/{ri}/requiredEvidence','old':oldreview['requiredEvidence'],'new':'Issue7では現行配布先の名称・住所とP05建物点の対応を個別確認する。既知の移転・別棟・座標競合がない施設に、2022年以後の改修不存在の証明を一律に要求しない。本件は今回の再取得原典による建物代表点候補として親の独立レビューを受ける。','basis':'今回再取得の市配布案内2041.html・運営者2319.html、P05 features[1529]。元レビューの当時の取得失敗記録・判定や配布関係は変更しない。'}]

dump(R/'classification.json',classification);dump(R/'p05-records.json',records)
dump(O,{'schema':1,'updates':updates,'unresolved':unresolved,'corrections':corrections})
# All referenced prior evidence remains in place. Historical retrieval time is carried only where recorded.
refs={str(B/f):sha(B/f) for f in ['ledger.json','full.json','assignments.json','hashes.json']}
for p in ['data/national/issue5/chubu.json','data/national/issue5/reviews/chubu.json','data/national/location-updates/chubu-east-south.json','data/evidence/issue5/review-chubu/p05-spec.pdf',zpath,zpath+'.source.json']+[ps[id]['evidence']['snapshotPath'] for id in ids]:refs[p]=sha(p)
lock=R/'input-hashes.json'
if lock.exists():assert read(lock)==refs,'Referenced inputs changed'
else:dump(lock,refs)
dump(R/'reused-archive.json',zm|{'reuseStatus':'existing-repo-path-no-copy'})
print(f'{len(updates)} candidates, {len(unresolved)} unresolved')
reused=[]
for c in classification:
 e=c['priorEvidence'];m=olds.get(c['facilityId'],{}).get('reusedSnapshot',{})
 reused.append({'facilityId':c['facilityId'],'sourceUrl':e['sourceUrl'],'snapshotPath':e['snapshotPath'],'snapshotSHA256':e['snapshotSHA256'],'fetchedAt':m.get('fetchedAt'),'retrievalTimeStatus':'recorded-in-prior-metadata' if m.get('fetchedAt') else 'unknown-not-invented','reuseStatus':'existing-repo-path-no-copy'})
dump(R/'reused-sources.json',reused)
competing=[]
for pref,indices in [(19,[127,134,682]),(20,[352,397,398,1463,1503])]:
 for index in indices:competing.append({'prefecture':pref,'featureIndex':index,'feature':geo[pref]['features'][index],'memberSHA256':members[pref]['memberSHA256'],'status':'comparison-only-see-classification-not-an-additional-update'})
dump(R/'p05-competing-records.json',competing)
