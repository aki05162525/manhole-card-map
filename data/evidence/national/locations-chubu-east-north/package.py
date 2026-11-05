"""Package reviewed coordinate decisions; run from repository root (no network)."""
import json,pathlib,hashlib,shutil,datetime
R=pathlib.Path('data/evidence/national/locations-chubu-east-north')
def read(p):return json.loads(pathlib.Path(p).read_text())
def write(p,v):pathlib.Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
T=read(R/'targets.json');I=read(R/'source-inspection.json');D=read(R/'decisions.json');A=read(R/'research-index.json')
M=read(R/'manifest.json');cache={m['url']:m for m in M}
for m in read('data/evidence/national/chubu-east/manifest.json'):
 cache.setdefault(m['url'],m)
for p in R.glob('*-results.json'):
 for u,x in read(p).items():cache[u]=x['manifest']
# Preserve reused raw bytes with original retrieval time, never invent a new fetch.
def source(u):
 m=dict(cache[u]);p=m.get('snapshotPath')
 if p:
  raw=pathlib.Path(p).read_bytes();h=hashlib.sha256(raw).hexdigest();assert h==m.get('sha256',m.get('snapshotSHA256')),u
  if not p.startswith(str(R)+'/'):
   dest=R/('cached-'+hashlib.sha256(u.encode()).hexdigest()[:24]+pathlib.Path(p).suffix);dest.write_bytes(raw);m.update(snapshotPath=str(dest),reusedFrom=p)
  m['sha256']=h;m['urlHash']=hashlib.sha256(u.encode()).hexdigest();m.pop('reused',None)
 cache[u]=m
 return m
reasons={
1:'保存協会アクセスと福井市観光の復原町並を調査。観光JSON-LDは町並全体の地点で、台帳の復原町並受付（城戸ノ内町28-43）に対応する建物・入口地点を分離できない。広い史跡の代表点を受付点として採用しない。',
3:'舟橋村公式会館詳細で海老江147を確認。埋込地図は住所ラベルとviewportのみで、会館建物の数値markerを確定できない。中新川広域組合トップのGoogleリンクは国重242の別庁舎で不採用。',
4:'燕市公式市役所案内・アクセス・公開データを調査。吉田西太田1934の庁舎住所は一致するが、掲載案内図・施設地図入口から庁舎の明示数値markerを得られず、2階下水道課の目的地座標は未確定。',
6:'朝日みどりの里公式の物産会館・配置案内と県観光の道の駅を照合。物産会館は猿沢1215、県観光の道の駅は猿沢1212で複数棟構成。道の駅全体点を物産会館へ流用しない。再整備の記載は別途注意事項。',
13:'かほく市公式配布案内と観光公式アクセスを調査。対象は市役所宇野気ニ81の上下水道課。観光アクセスは地域案内または高松の観光協会であり当該庁舎の明示数値markerを確認できない。',
23:'燕市公式市役所案内・アクセス・公開データを調査。吉田西太田1934の庁舎住所は一致するが、案内図から数値は推定しない。1階夜間休日受付と同庁舎を同定したが庁舎の明示数値marker未取得。',
29:'キターレ公式アクセス・市公式案内を調査。市地図URLのlat/lngは検索モードの表示中心で施設markerではない。公式サイトでも河井町4-66-1の建物地点を明示する座標を確定できず。',
32:'能登ワインの県公式観光施設座標を発見したが、同ページ住所は旭ケ丘リ5番1、台帳・町配布案内はり5番6。地番の違いと配布建物の関係が未解消のため施設名だけで採用しない。',
33:'清津峡公式案内・県観光を調査。県観光の数値は清津峡渓谷トンネル全体の地点。エントランスPeriscopeはトンネル入口から離れた別施設であり、トンネル点をショップへ流用しない。',
34:'志賀町役場アクセスで末吉千古1-1の本庁舎を確認。埋込pbの!2d/!3dはviewportで、2階上下水道課の建物を指す明示数値markerを確認できない。富来支所とは区別。',
43:'かつやま恐竜の森公式アクセス・園内案内を調査。長尾山総合公園の広域案内と管理事務所建物を分離できない。サイトのGoogleリンクに含まれる別駐車場地点や公園代表点を管理事務所へ流用しない。',
47:'佐渡公式公共施設GISの佐和田行政サービスセンター（河原田本町394）は37.99825171390319,138.3218818549902、同住所の会館等GIS佐渡中央会館は38.00143338792895,138.31787263805097。現市民センター一覧と住所は一致するが約500mの矛盾を解消できず不採用。',
51:'高浜町公式上水道センター施設案内で東三松34-3-1を確認。本文に採用できる明示数値markerなし。フッターGoogleリンクは宮崎の町役場であり上水道センターではない。',
52:'射水市公式物産館施設ページと道の駅公式配置案内を調査。物産館の埋込地図place IDと短縮リンクが解決する道の駅全体place IDが異なる。物産館事務所の建物と全体代表点を区別できず不採用。',
53:'運営者のmachiminato.jp公式施設サイト・アクセスを確認。アクセスは交通経路の文章・案内図で数値markerなし。類似ドメインniigatafurumachi.comは運営主体が異なる第三者案内のため根拠不採用。',
59:'能登町公式コンセールのと・宇出津公民館案内で同建物住所を確認。Google地図qは名称文字列、llはviewportで数値目的地ではない。リンク先からも確実な施設feature座標を取得できず。',
60:'村上市公式荒川地区公民館案内で羽ケ榎104-25を確認。埋込地図のviewport以外に建物位置として採用できる明示座標を確認できない。別URLの施設案内探索も未解決。',
61:'燕市施設案内・県観光・燕市観光協会の個別詳細を照合。上諏訪9-9は一致するが県観光geoは未設定、協会埋込地図は住所ラベル付きviewport。住所代表点を史料館建物点へ格上げしない。',
62:'県公式観光の道の駅神林詳細を確認。九日市809の道の駅全体geoはあるが道路情報ターミナル棟と穂波の里直売所等の区別が付かず、全体点を対象棟に流用しない。',
65:'福井市上下水道局公式案内を確認。大手3-13-1の局庁舎への地図qは名称・住所文字列で数値marker未取得。公式ページ共通フッターの大手3-10-1市役所地点は別建物につき不採用。',
66:'長岡市公式配布案内・市民センター詳細・公式施設地図リンクを調査。旧施設大手通2-2-6の明示座標未取得。配布終了・後継案内があるため後継アオーレ地点を旧市民センターへ付けない。移転採否は担当外。',
75:'志賀町役場アクセスで本庁舎末吉千古1-1を確認。pb内数値はviewportで建物markerと見なさない。1階管理人室のある本庁舎を同定したが目的地座標未取得。',
76:'輪島市上下水道局の公式窓口案内を追加確認。河井町21部1（台帳21部1-1）までは確認できるが、当該局の建物を特定する明示数値markerを得られない。市役所やキターレの地点とは区別。',
77:'佐渡公式会館等GISの佐渡離島開発総合センター（佐渡中央会館）と公共施設GISの同住所河原田本町394の点が約500m離れる。現施設案内と住所を照合したが棟・旧位置・GIS誤登録のどれか判別不能。中央会館へ片方を無検証採用しない。',
81:'出雲崎町公式役場アクセス・配布案内を調査。川西140は一致するが埋込地図は住所ラベルのviewportのみ。役場建物に対応する数値markerを確定できない。'}
assert set(map(int,D))|set(reasons)==set(range(len(T)))
updates=[];unresolved=[];chains=[];audit=[]
for i,t in enumerate(T):
 urls=list(dict.fromkeys([p['url'] for p in I[i]['pages']]+A.get(str(i),[])))
 # Include direct support sources in facility index.
 if str(i) in D:
  d=D[str(i)];urls+= [d['url']]+([d['parentUrl']] if 'parentUrl' in d else [])
  m=source(d['url']);primary=source(d.get('parentUrl',d['url']));loc=d['locator']
  if 'parentUrl' in d:loc+='。展開先原本 '+m['snapshotPath']+' SHA256='+m['sha256']
  evidence={'sourceUrl':primary['url'],'snapshotPath':primary['snapshotPath'],'snapshotSHA256':primary['sha256'],'sourceLocator':loc,'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'AI原典照合。'+d['note']}
  updates.append({'facilityId':t['id'],'coordinate':{'lat':d['lat'],'lng':d['lng']},'evidence':evidence})
  chains.append({'facilityId':t['id'],'name':t['name'],'address':t['address'],'coordinateSource':m,'officialLinkSource':primary,'note':d['note']})
 else:
  ats=[]
  for u in dict.fromkeys(urls):
   m=source(u) if u in cache else None
   result=('原本確認 HTTP '+str(m.get('status')) if m else '保存済み個別調査記録参照')
   if m and m.get('error'):result+='; '+m['error']
   elif m and m.get('status')==200:result+='。'+reasons[i]
   ats.append({'url':u,'result':result})
  assert ats
  unresolved.append({'facilityId':t['id'],'attempts':ats,'reason':reasons[i]})
 audit.append({'index':i,'facilityId':t['id'],'name':t['name'],'address':t['address'],'result':'update' if str(i) in D else 'unresolved','sources':[source(u) for u in dict.fromkeys(urls) if u in cache]})
# Copy support chain for GIS ownership, current name/phone, CSV publication and marker semantics.
for u in list(cache):
 if any(s in u for s in ['soshiki/2002/30816','soshiki/2028/55004','opendata-sado','arcgis.com/','dxsuishinka/service/4773','shisetsu-detail-googlemap.js','_res/js/map.js']):source(u)
# Preserve every retrieved/cached raw referenced by research result and audit.
for u in list(cache):
 if any(u in read(p) for p in R.glob('*-results.json')):source(u)
candidate_url='https://www.city.shibata.lg.jp/shisetsu/kanko/kanko/1022382.html'
cm=source(candidate_url)
write(R/'pending-candidates.json',{'schema':1,'region':'chubu-east','candidates':[{'cardId':'15-208-D001','legacyPlaceId':'place:2a3c4c27a70d89172634','name':'蔵春閣','address':'新潟県新発田市諏訪町1丁目9番20号','coordinate':{'lat':37.94394573614766,'lng':139.33171525254366},'locationKind':'建物代表点。室内窓口ではない。','distributionState':'pending','evidence':{'sourceUrl':candidate_url,'snapshotPath':cm['snapshotPath'],'snapshotSHA256':cm['sha256'],'sourceLocator':'施設案内 蔵春閣 所在地・地図を表示する q','checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'施設名・諏訪町1丁目9番20号・施設詳細の数値qを照合。配布関係の確定ではない。'},'reason':'市公式は208表記が誤りで206が正しく208表記を配布しないと明示。既存地域監査のpendingを維持。位置候補のみ。'},{'cardId':'17-384-A001','legacyPlaceId':'place:d00e9800e202c1422c74','name':'志賀町役場（建物見出し）','distributionState':'pending','reason':'元監査の余分な建物見出し関係。独立窓口として承認せず、階別2施設の未解決調査を参照。座標なし。'}]})
used={m['url']:m for m in M}
for u,m in cache.items():
 if m.get('snapshotPath','').startswith(str(R)+'/'):used[u]=m
for m in used.values():m['urlHash']=hashlib.sha256(m['url'].encode()).hexdigest()
write(R/'manifest.json',list(used.values()));write(R/'facility-audit.json',audit);write(R/'evidence-chains.json',chains)
out={'schema':1,'region':'chubu-east','updates':updates,'unresolved':unresolved}
p=pathlib.Path('data/national/location-updates/chubu-east-north.json');p.parent.mkdir(parents=True,exist_ok=True);write(p,out)
print('updates',len(updates),'unresolved',len(unresolved),'manifest entries',len(used))
