import json,hashlib,re,pathlib,urllib.parse,collections
R=pathlib.Path('data/evidence/national/review-north-hokkaido');S=pathlib.Path('data/evidence/national/locations-north-hokkaido')
load=lambda p:json.loads(pathlib.Path(p).read_text())
xs=load(R/'inspection.json');out=load('data/national/location-updates/north-hokkaido.json');updates={u['facilityId']:u for u in out['updates']};targets={t['id']:t for t in load(S/'targets.json')};manifest=load(S/'manifest.json');byurl={e['url']:e for e in manifest};audit=load(R/'audit.json');checks={c['facilityId']:c for c in audit['checks']}
def ref(e):return {k:e[k] for k in ['url','finalUrl','snapshotPath','snapshotSHA256','fetchedAt'] if k in e}
def urlref(u):return ref(byurl[u])
def evidence_for(x):
 u=updates[x['facilityId']];t=targets[x['facilityId']];es=[ref(byurl[u['evidence']['sourceUrl']]),dict(t['evidence'])]+[ref(e) for e in checks[x['facilityId']]['officialLinkSources']]
 return es
hold={
0:('wrong-or-unproven-building','保存済み配布案内2020040800031は平日「市役所第２庁舎２階」、休日「本庁舎１階」を明確に分離。候補はtitle=北海道登別市役所の代表点で第２庁舎との対応を示していない。中央町6-11とトップページのフッター一致では承認不可。'),
13:('wrong-or-unproven-building','市配布案内は旭町4-5-6の「北庁舎3F」。候補featureは「苫小牧市役所」のみ。北庁舎の建物点である根拠がなく、本庁舎等と同住所でも流用不可。'),
24:('feature-identity-drift','公式iframeはたら丸館feature 0x5f0a97bf39299869:0xbe37fbb6a9e8b167を要求するが、採用された応答featureは道の駅いわない 0x5f0a97bf392a3ee1:0x19b0a18a41c64aaf。公式説明には向かい側のトイレ・分散駐車場がある。別featureの駅全体代表点をたら丸館の建物点と確定できない。名称変更/統合か別地点かは未確定。'),
32:('unproven-building','施設公式tec/は本館と別館ほっくるを区別し案内所は本館と明記。access/のfeatureは北斗市観光交流センターのみで、採用座標を本館の建物に対応させる追加根拠が不足。JR駅/別館を含む複合施設代表点としては理解できるがconfirmed不可。'),
33:('unproven-point-role','JSON-LDの対象はTransitSystem「レンタサイクル(旭川駅)」。説明と電話0166-26-6665はセンターを示すが、東コンコース前の貸出地点/駅代表点/センター建物点のどれかが不明。名称・電話の一致だけで建物位置としない。'),
41:('unproven-building','市配布先は副港市場1階カフェPotto。観光機構の数値qは温浴・市場・屋台等を含む副港市場全体で、候補の説明「市場建物点」を裏付ける棟指定がない。Pottoの入居棟と候補点の対応が必要。'),
49:('unproven-building-or-wing','町の配布案内は「てしお温泉『夕映』温泉側受付」。候補featureは夕映全体で宿泊・温浴側の対応が示されていない。窓口精度を求めるのではなく、温泉側が同じ建物点でよいかを確認してから採用する。'),
51:('address-conflict','同じ役場の施設名付き公式iframeはあるが、配布案内本文は新栄通8丁目1464番地の113、町トップ/フッターは1466-113。台帳の8丁目止まりでは不一致を解決しない。誤記の可能性を推定で訂正せず正しい所在地を確認する。'),
54:('route-endpoint-not-building','アクセスの経路到着地点がガーデンスパ十勝川温泉であることは確認できる。しかしスパ・工房・マルシェ等を持つ施設の経路終点を建物代表点と結び付ける根拠が不足。施設アクセス用途の候補として保持しconfirmedは保留。'),
56:('unproven-building','観光協会qは「富良野チーズ工房」の施設点。公式にはチーズ・アイスミルク・ピッツァ・体験工房と公園がある。「前庭の避難場所点とは区別」だけでは採用点の棟が確定しない。中五区は双方一致するが建物同定を補わない。'),
60:('unproven-building','公式アクセスiframeの施設名付き点と49-1は一致するが、鉄道資料館・売店・農産物直売所等を持つ道の駅全体のfeatureであり棟の対応が未記録。複合敷地のどの建物を代表するか確認が必要。'),
66:('unproven-building','北の道の駅ページは観光物産センター・直売店・公衆トイレ・隣接する百年記念館を区別。GoogleMapリンクはスタープラザ芦別全体。対象の観光物産センターの棟を示す点と確定できず、北4条東1-1一致だけでは採用不可。'),
71:('address-conflict','当直室と同じ役場点。配布案内1464-113と公式トップ1466-113の不一致を8丁目までの台帳表記で隠さない。正しい所在地と同棟の確認まで保留。')}
notes={
3:'市の配布段落のHUB HOKKAIDO SELECT SHOPリンクそのもの。Fビレッジ全体ではなくTHE LODGE2階、球場ガラス壁向かいの茶色い建物と明記される。蓋設置位置のiframeとは別。',
5:'市の配布案内が旧中央バス滝川ターミナル内1階を指定し、同ページiframeのたきかわ観光国際スクエアfeatureに栄町4-9-1がある。',
12:'同じaccess/原本のmapp.data.push内pois[0]は道の駅名・本町338・pointを保持し、同ページ施設欄は本町338-14、電話01392-2-3161、木古内駅南口正面を明記。保存済みpost-1762/が道の駅の観光案内カウンターでの配布を説明。枝番を機械的に落とした照合ではなく同一運営施設のページ内接続。台帳338-14を維持する。',
16:'協会個別案内がJR帯広駅エスタ東館2階を指定。地図feature自体も「エスタ帯広 東館2階 とかち観光情報センター」で、西館/駅全体と区別できる。',
18:'町の配布先1885-14と北の道の駅おうむ個別ページの地域交流センターが対応。施設名付きGoogleMap目的地を用い、ページ共通L.markerを用いていない。',
21:'施設個別ページのうとろ・シリエトク目的地とウトロ西186-8が対応。既存の配布終了状態の変更・再開承認はしない。',
23:'市の配布本文でAKABIRAベース・幌岡町54・電話0125-32-6760を指定し、その名前付き市公式markerのlocと一致。',
25:'運営者アクセスの市民交流施設ぷらっと内・東野幌本町6-43と「あい」featureが対応。元施設サイトもぷらっと内の当窓口を説明。',
27:'北の道の駅のとうべつ個別ページと運営者tobestの施設が当別太774-11で一致する施設名付き目的地。駐車場代表点等への読み替えはしない。',
31:'市のGET’S案内が東野幌町3-3 EBRI内を指定。EBRI自身のアクセスiframeのËBRI featureと対応し、建物単位として採用できる。',
35:'市配布案内は水道局庁舎1階管理員室、施設ページは東雲町3-2-5の2階建て専用庁舎と記載。市役所東雲町2-34の点と分離。',
36:'市配布ページのエルフィンパーク市民サービスコーナーへのリンクにこの目的地座標。中央6丁目209、JR北広島駅向かい側の当窓口を指定する。',
37:'市のゆめぽーと個別施設ページのstaticmap markersとリンクqが一致。観光協会の所在も親船町107の観光センター内。',
40:'町配布案内と観光協会個別ページがJR豊富駅となりの観光情報センター・駅前通・電話0162-82-2100で対応。q=nameの応答は住所ではなく同センターfeatureで駅代表点と区別。',
43:'運営者あい風の建物案内/フロア案内と公式iframeのあいろーど厚田98-2 featureが対応する。',
44:'市の配布案内と公式道の駅ページがもち米の里☆なよろ・風連町西町334-1を指定し、当施設への目的地リンクに一致。',
46:'環境プラザ自身が札幌エルプラザ2階と明記し、埋込featureは同建物の北8条西3丁目28。番地省略は入居建物名の直接一致で補われる。別棟を同住所扱いしていない。',
48:'施設運営サイトの公式iframeが上ノ国もんじゅ・原歌3の施設featureに接続。採用数値は表示中心ではなく同feature。',
50:'町の施設案内のふらっと★きたfeatureと東1条6丁目が対応。配布案内が役場裏の大きな建物と電話0162-82-2211を明記し、役場点ではないことを確認。',
53:'町の配布ページiframeが郷土資料館ここから・4条南3丁目1-41を指定。町の施設ページの住所と一致し、役場点と区別。',
58:'観光協会のぽっけ個別ページと町配布案内が温泉地区・電話0162-73-6850で対応。q=nameの応答はぽっけfeature。字温泉という広い住所の代表点を使っていない。',
59:'町のあすぱる施設ページ・配布案内・埋込featureが南1条西5丁目5-3で対応。多目的ホール等は当施設の内部機能として説明される。',
62:'市配布案内自体が本庁舎・花園2-11-15を指定して同水道局featureを埋込む。平日2階/休日1階を同建物として明示しており、市役所本庁舎等と混同しない。',
65:'市の配布案内がライスランドふかがわ1階総合案内所・広里59-7を明記。北の道の駅の同施設目的地に対応。',
68:'運営者ページに士別市大通東5丁目440-23を明記。同じページのiframeの羊のまち侍・しべつfeatureと住所が一致。',
69:'町施設案内と北の道の駅の個別案内が旭町の同施設・電話0158-29-3300で対応。町域ジオコードではなく同施設名の目的地リンク。旭町に任意の枝番は補わない。',
70:'はなふるアクセスの経路終点の名称が明示的に花ロードえにわ。経路終点ラベル自体にも南島松817番地18と花ロードえにわの名称があり、台帳の施設と対応する。828-3/823-3のセンターハウスへこの点を流用しない。'}
# Every decision is explicit; dictionary below is not a name-matching approval rule.
assert len(notes)==27
correction_indices={19,45,61,63}
reviews=[];corrections=[]
for x in xs:
 i=x['index'];fid=x['facilityId'];u=updates[fid];row={'facilityId':fid,'name':x['name'],'address':x['address'],'proposedCoordinate':u['coordinate'],'evidence':evidence_for(x),'sourceLocator':x['locator'],'hashAndLinkCheck':'pass','inspectionRef':str(R/'inspection.json')+'#index='+str(i),'corrections':[]}
 if '.csv' in x['sourceUrl']:
  row['decision']='保留';row['canIntegrateAsConfirmed']=False;row['csvRows']=checks[fid]['rawCsvRows'];row['reasonCodes']=['dataset-rights-or-crs','building-currentness']
  if '/227/' in x['sourceUrl']:
   r=row['csvRows'][0];row['reason']=f"原本行の出典は{r['出典']}。対応する旧P27/P34/P05公式配布条件は非商用・JGD2000。北海道規約の一般CC BYを第三者由来部分の権利処理済み証拠とは扱えず、再配布許諾の根拠がない。現在の名称住所の一致だけでは旧点の建物継続も証明しない。";row['licenseAssessment']='原典非商用。北海道再許諾の裏付け未確認。';row['crsAssessment']='原典JGD2000、北海道CSVへの変換履歴は未確認。JGD2011と記録しない。'
  elif '/1749/' in x['sourceUrl']:
   row['reason']='カタログは国土数値情報「市町村役場等及び公的集会施設」を編集とだけ記し原典年次を示さない。2022年作成のカタログ更新日2025年を各地点の更新日とみなせず、旧P05は非商用/JGD2000なので新P05-22のCC BY/JGD2011を継承できない。現施設の名称住所一致のみで旧点を現建物に昇格しない。';row['licenseAssessment']='原典版未特定。再配布可と未確定。';row['crsAssessment']='CSV/カタログに具体的CRS・変換履歴なし。'
  elif '/2235/' in x['sourceUrl']:
   row['reason']='2025年の市公共施設一覧で「富良野市複合庁舎」を指定しており旧庁舎点を避けた判断は妥当。しかし原本CSVの緯度経度以外に測地系・建物内代表点の定義が示されず、複合庁舎のどの建物を表すかの裏付けが不足。一般CC BYの確認だけではconfirmed条件を満たさない。';row['licenseAssessment']='北海道規約の一般CC BY 4.0を確認。第三者原典の特別制約はこのカタログには見当たらない。';row['crsAssessment']='自治体標準オープンデータ準拠の記載だけでCRSを断定しない。'
  else:
   row['reason']='R03-04-01の避難施設CSVで施設ID00000500・名称・住所74・電話0125-74-5574が町案内と一致。ただし避難場所/避難所兼用の点で、建物内点の定義・具体的測地系の根拠がない。施設名があるだけで建物点と断定しない。';row['licenseAssessment']='北海道規約の一般CC BY 4.0を確認。個別の第三者制約はカタログに見当たらない。';row['crsAssessment']='CSV/カタログでCRSを確定できない。'
  if any(k in x['name'] for k in ['守衛','警備','当直','宿直']):row['reason']+=' 特に当窓口が役場本体の同棟か別棟かは、住所・役場名の部分一致だけでは決めない。'
 elif i in hold:
  code,reason=hold[i];row.update(decision='保留',canIntegrateAsConfirmed=False,reasonCodes=[code],reason=reason)
 elif i in correction_indices:
  row.update(decision='要訂正',canIntegrateAsConfirmed=False,coordinateAcceptableAfterCorrection=True,reasonCodes=['metadata-correction'])
  if i in [61,63,19]:
   old=u['evidence']['verificationMethod']
   prefix='市公式配布案内／るもいプラザ公式施設ページが指定する施設名付き目的地。現在の住所に照合。表示中心を不採用。'
   assert old.startswith(prefix)
   newprefix=('釧路市公式配布案内 https://www.city.kushiro.lg.jp/kurashi/suidou/1004657/1014085.html の「釧路地区（夕日とタンチョウ）の配布場所地図」リンク https://maps.app.goo.gl/StpyysamtXeQvhMx9 が指定する釧路市上下水道部の施設目的地。公式本文の南大通2-1-121および平日経営企画課・休日守衛室と照合。応答feature 0x5f723d42d2fd79d9:0x3e93dd818052b9a7 の42.978677,144.3831971を使用し、表示中心144.3806222は不採用。' if i!=19 else 'るもいプラザ公式施設ページ https://rumoi.main.jp/shoplist/%e3%82%8b%e3%82%82%e3%81%84%e3%83%97%e3%83%a9%e3%82%b6/ のMAPはこちら https://goo.gl/maps/9N5kicx1tnbfZWJi6 が指定するるもいプラザの施設目的地。公式本文の開運町3丁目4番11号と照合。釧路市のリンクとは別であり、表示中心は不採用。')
   patch={'facilityId':fid,'target':'data/national/location-updates/north-hokkaido.json','field':'updates[facilityId='+fid+'].evidence.verificationMethod','old':old,'new':newprefix+old[len(prefix):],'coordinateChange':None}
   row['reason']='decide.pyの釧路/留萌を処理する共通ループで同じ説明を付けた誤り。公式ページ→短縮URL→最終URL→応答featureの接続は正しく、リンク誤適用ではない。地図応答には住所文字列がないため、住所は公式配布/施設本文から確認した。建物代表点は訂正後採用可能。'
  else:
   patch={'facilityId':fid,'target':'facility record (統合時。元north fragmentはplaces[id].name)','field':'name','old':x['name'],'new':'千歳市水道局庁舎2F総務課総務係窓口','coordinateChange':None}
   row['reason']='現行市配布案内は2階「総務課総務係窓口」だが台帳名は経営管理課。施設案内ページには旧経営管理課表記が残る。専用水道局庁舎・東雲町3-2-5の同建物位置は採用可能だが、現在の名称を照合済みとする説明には訂正が必要。'
  corrections.append(patch);row['corrections'].append(patch)
 else:
  assert i in notes;i_note=notes[i];row.update(decision='採用可能',canIntegrateAsConfirmed=True,reasonCodes=['official-named-building-connection'],reason=i_note,pointPrecision='建物代表点。窓口・階内位置/入口の実測精度は主張しない。')
 # Additional primary evidence to make important rejections independently reproducible.
 extras={0:['https://www.city.noboribetsu.lg.jp/docs/2020040800031/'],12:['https://kikonai.jp/post-1762/'],32:['https://hokutoinfo.com/tec/'],61:['https://www.city.kushiro.lg.jp/shisei/gaiyou/1006827/1006831.html'],63:['https://www.city.kushiro.lg.jp/shisei/gaiyou/1006827/1006831.html']}
 row['evidence'] += [urlref(v) for v in extras.get(i,[])]
 reviews.append(row)
urs=[]
for u in out['unresolved']:
 t=targets[u['facilityId']];refs=[ref(byurl[a['url']]) for a in u['attempts']]
 urs.append({'facilityId':u['facilityId'],'name':t['name'],'decision':'保留','canIntegrateAsConfirmed':False,'reason':u['reason'],'reviewConclusion':'既存の未解決状態を維持。今回新しい建物点の確定・住所の自動訂正はしない。取得失敗は同定根拠にしない。','evidence':refs})
lic={
 'portalTerms':ref(load(R/'manifest.json')[0]),
 'conclusion':'北海道規約第1条は提供団体が権利を持つ著作物のCC BY 4.0と数値等の適用除外を説明するが、第2条は第三者の権利処理を利用者に求める。第4条の他サイト規約との優先関係だけで原著作者の許諾範囲が変更されたと断定できない。個別の単一数値の著作物性/法的結論は断定しないが、汎用台帳への出典付き再配布を承認する根拠として不足。',
 'sourceTerms':[ref(e) for e in load(R/'manifest.json')[1:]],
 'oldSourceConditions':{'P27-H25':'非商用 / JGD2000。札幌市下水道科学館・天塩町ファミリースポーツセンター。','P34-H26':'非商用 / JGD2000。常呂総合支所2窓口。','P05-H22':'非商用 / JGD2000。函館市地域交流まちづくりセンター。P05-22と別版。','P28-H25':'非商用 / JGD2000。DBが混載する出典だが今回の採用72件にP28由来の原本行はない。'},
 'yakubaCsv':'21件。原典がP05との記載はあるが版・測地系を保存カタログから特定できない。P05-22を自動的に当てはめない。',
 'requiredResolution':'商用/再配布に使える別原典（新P05など）又は個別の公式建物マーカーに差し替え、現建物との継続・CRSを確認する。古い数値と同じだからという理由で出典を付け替えない。',
 'catalogEvidence':[urlref('https://www.harp.lg.jp/opendata/dataset/'+n+'.html') for n in ['227','1749','2235','1881']]}
discrepancies=[
 {'description':'locations READMEは旧施設点を現在の名称住所に照合して採用と記すが、decide.pyは北海道DBのH25/H26/H22を出典制約・CRS未記録のまま出力する。official-facility-index READMEの原典ライセンス/測地系を確認し一律採用しない方針と整合していない。','paths':[str(S/'README.md'),str(S/'decide.py'),'data/evidence/national/official-facility-index/README.md']},
 {'description':'READMEの「建物内の複数窓口」及び生成された名称住所照合済みという説明は、登別第2庁舎/苫小牧北庁舎を市役所代表点へ対応させる根拠にはならない。実データは棟不明の施設点も含む。','paths':[str(S/'README.md'),str(S/'decide.py'),'data/national/location-updates/north-hokkaido.json']},
 {'description':'decide.pyの釧路・留萌用共通説明が釧路2窓口にもるもいプラザ由来と読める文を付与する。実provenanceは釧路市公式→釧路市上下水道部であり本文の説明のみ不一致。留萌も個別出典に書き分ける訂正案を付した。','paths':[str(S/'decide.py'),str(S/'provenance.json'),'data/national/location-updates/north-hokkaido.json']},
 {'description':'千歳2階窓口は台帳及び旧施設案内の経営管理課と現行配布案内の総務課が不一致。「現施設の名称照合」済みという一律説明を維持できない。同建物であるため座標の誤りとは分類しない。','paths':['data/national/location-updates/north-hokkaido.json',str(S/'targets.json')]}
]
result={'schema':1,'reviewType':'independent-location-review','region':'north-hokkaido','reviewedAt':'2026-11-05','actorType':'ai','input':{'path':'data/national/location-updates/north-hokkaido.json','sha256':audit['inputSHA256']['data/national/location-updates/north-hokkaido.json']},'policy':'confirmedは対象建物との接続が説明できる位置のみ。採用可能は既存配布関係/状態の承認・変更を意味しない。要訂正も修正前は統合しない。','summary':dict(collections.Counter(r['decision'] for r in reviews)),'acceptedFacilityIds':[r['facilityId'] for r in reviews if r['decision']=='採用可能'],'correctionRequiredFacilityIds':[r['facilityId'] for r in reviews if r['decision']=='要訂正'],'heldFacilityIds':[r['facilityId'] for r in reviews if r['decision']=='保留'],'reviews':reviews,'unresolvedReviews':urs,'unresolvedPromoted':0,'licenseAndCrsReview':lic,'exactCorrections':corrections,'documentCodeDiscrepancies':discrepancies,'validationEvidence':str(R/'audit.json'),'limitations':['現地調査・建物ポリゴン測量ではない。保留には誤座標と断定したものと根拠不足を区別して記録。','元verify.pyはvalidation.jsonを書き換えるため実行せず、独立audit.pyで読取専用のhash/URL/数値検査を実施。機械検証の成功を意味的同定や許諾の証明にしない。','親の統合検証台帳やassemblerには一切書き込んでいない。']}
assert len(reviews)==72 and len(urs)==19
P=pathlib.Path('data/national/reviews/north-hokkaido.json');P.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(result['summary']);print('review',P)
