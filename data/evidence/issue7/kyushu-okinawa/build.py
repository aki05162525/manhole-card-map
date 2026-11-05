"""Offline generation/verification. Writes only issue7 kyushu-okinawa artifacts."""
import json,pathlib,hashlib,zipfile,io,re,base64,datetime,html,collections
E=pathlib.Path('data/evidence/issue7/kyushu-okinawa');OUT=pathlib.Path('data/national/issue7/kyushu-okinawa.json')
def read(p):return json.loads(pathlib.Path(p).read_text())
def save(p,d):pathlib.Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def walk(d):
 if isinstance(d,dict):
  yield d
  for v in d.values():yield from walk(v)
 elif isinstance(d,list):
  for v in d:yield from walk(v)
ids=read('data/work/issue7-baseline/assignments.json')['kyushu-okinawa'];ledger=read('data/work/issue7-baseline/ledger.json');places={p['id']:p for p in ledger['places'] if p['id'] in ids}
for name,h in read('data/work/issue7-baseline/hashes.json').items():assert sha('data/work/issue7-baseline/'+name)==h
for name,h in read(E/'input-hashes.json').items():assert sha(name)==h
fetchfiles=['fetches.json','followup-fetches.json','extra-fetches.json','nakama-fetch.json','nakama-images-fetches.json','sports-fetch.json']
fetches=sum([read(E/n) for n in fetchfiles],[]);fetched={r['url']:r for r in fetches if r.get('status')==200}
for r in fetches:
 if r.get('snapshotPath'):assert sha(r['snapshotPath'])==r['snapshotSHA256']
checked=datetime.datetime.now(datetime.timezone.utc).isoformat()
priorpaths=['data/national/issue5/west-south.json','data/national/issue5/reviews/west-south.json','data/national/reviews/kyushu-okinawa-locations.json','data/national/location-updates/kyushu-okinawa.json','data/evidence/national/locations-kyushu-okinawa/unresolved-research.json']
prior=[(p,read(p)) for p in priorpaths];old={r['facilityId']:r for r in prior[0][1]['unresolved']};priorrecords={fid:[] for fid in ids}
for p,d in prior:
 for r in walk(d):
  if r.get('facilityId') in ids:priorrecords[r['facilityId']].append({'path':p,'record':r})
# Reference existing raw artifacts, never recopy them. Unknown original time stays null.
refs={}
for fid in ids:
 for r in walk([places[fid],priorrecords[fid]]):
  p=r.get('snapshotPath');h=r.get('snapshotSHA256')
  if p and h and p not in refs:
   exists=pathlib.Path(p).is_file();refs[p]={'snapshotPath':p,'snapshotSHA256':h,'exists':exists,'hashMatches':sha(p)==h if exists else False,'fetchedAt':r.get('fetchedAt'),'timeNote':'null means retrieval time not established here; checkedAt/mtime not substituted'}
zp='data/evidence/issue5/chubu/P05-22_GML.zip';zm=read('data/evidence/national/official-facility-index/P05-22_GML.zip.source.json');assert sha(zp)==zm['sha256'];z=zipfile.ZipFile(zp);members={}
for pref in range(40,48):
 zn=next(n for n in z.namelist() if n.endswith(f'_{pref}_GML.zip'));zz=zipfile.ZipFile(io.BytesIO(z.read(zn)));gn=next(n for n in zz.namelist() if n.endswith('.geojson'));b=zz.read(gn);members[str(pref)]={'zipMember':zn,'geojsonMember':gn,'memberSHA256':hashlib.sha256(b).hexdigest(),'data':json.loads(b)}
# Select only identified buildings, preserving P05 values exactly.
selection=[
 ('kyushu-015d01512ed3752919cd','43',40,'https://kc-sks.jp/soutai/index.html','県施設案内・現運営者がナースパワーアリーナ＝熊本市総合体育館・青年会館、出水2-7-1と明記。P05総合体育館を採用。青年会館feature38は約4.7m差の併設機能点で、別敷地の施設ではない。受付室を測位した値ではない。'),
 ('kyushu-3be846e318561ee431e9','40',1590,'https://cototoba.com/floor/','P05町民情報ステーションは中原2-120の情報拠点。現運営者は同番地の博多南駅前ビル1階ナカイチインフォメーションを明記。建物レベルで対応する駅前ビル点として採用。町民窓口と現在の窓口の位置一致までは主張しない。'),
 ('kyushu-3c3902d19243e599e3c4','40',1590,'https://cototoba.com/floor/','同じ博多南駅前ビル・中原2-120の別facilityId。P05情報ステーションの建物点を両IDに使用するが、ID・関係の統合は行わない。現運営者の1Fインフォメーションと同定。'),
 ('kyushu-4c93c76776a06838fe00','42',1500,'https://www.town.higashisonogi.lg.jp/gyoseijoho/annai/783.html','役場庁舎案内の3階17番窓口が水道課。現配布先の蔵本郷1850-6本庁舎と一致。P05西館feature1508を混同せず本庁feature1500を採用。新庁舎計画だけを理由に現庁舎を否定しない。'),
 ('kyushu-51dfc976486b8b93581d','40',1710,'https://www.city.dazaifu.lg.jp/soshiki/22/22649.html','宰府3-2-3の太宰府館そのものの建物点。2026-10-01～12-22は配布休止・別IDの駅内観光案内所へ臨時移転と再確認。既存suspended/reviewUntilを維持するため、旧館の建物位置を整備しても現配布先だとは主張しない。'),
 ('kyushu-a7f2c9a57f74387fbabb','46',630,'https://www.city-kirishima.jp/soumu/shise/annai/choshaannai/civiccenter.html','公式庁舎案内は1階総合窓口を記載。国分中央3-45-1の国分シビックセンターとP05固有施設を同定。公民館feature632や2017年の行政庁舎別館を総合窓口に代用しない。'),
 ('ws-a33e80c6dd86bf6e7f','46',756,'https://www.city.minamisatsuma.lg.jp/goshokai/gaiyo/e018900.html','現庁舎配置表は南さつま市本庁2階に都市整備課を明記。加世田川畑2648の本庁舎と一致。あんぼう21・旧スタジオ21など別施設から区別できる。')]
updates=[];proof=[]
def evidence(r,loc,method):
 return {'sourceUrl':r['url'],'snapshotPath':r['snapshotPath'],'snapshotSHA256':r['snapshotSHA256'],'sourceLocator':loc,'checkedAt':checked,'actorType':'ai','verificationMethod':method}
def fetched_for(fid):return [r for r in fetches if any(t['facilityId']==fid for t in r['targets'])]
for suffix,pref,i,url,note in selection:
 fid='facility:'+suffix;m=members[pref];f=m['data']['features'][i];lng,lat=f['geometry']['coordinates'];loc=f"{m['zipMember']}!{m['geojsonMember']}#/features/{i}"
 r=fetched[url];assert r['status']==200
 ev=evidence({'url':zm['url'],'snapshotPath':zp,'snapshotSHA256':sha(zp)},loc+'; '+f['properties']['P05_003']+' / '+f['properties']['P05_004'],'AI原本照合。'+note+' P05 JGD2011/EPSG:6668 [lng,lat]を転記、変換なし。CC BY 4.0、国土交通省の承認を意味しない。建物代表点。')
 updates.append({'facilityId':fid,'coordinate':{'lat':lat,'lng':lng},'scope':'building','evidence':ev})
 proof.append({'facilityId':fid,'kind':'P05','prefecture':pref,'featureIndex':i,'rawFeature':f,'memberSHA256':m['memberSHA256'],'sourceLocator':loc,'identityFinding':note,'buildingSource':evidence(r,'施設名・住所・本文内の庁舎/フロア案内',note),'currentSourceURLs':[x['url'] for x in fetched_for(fid)],'license':'P05 individual CC BY 4.0; official HTML rights are independent','fetchedAt':zm['fetchedAt']})
# Official HTML is the numerical source: no Google response data extracted.
fid='facility:kyushu-a4ba2e23eab057c818dc';r=fetched['https://www.sagabai.com/balloon-museum/main/21.html'];s=pathlib.Path(r['snapshotPath']).read_text();labels=[base64.urlsafe_b64decode(x+'='*((-len(x))%4)).decode() for x in re.findall(r'!2z([^!]+)',s)];assert '33°15\'08.8"N 130°18\'01.5"E' in labels
lat=33+15/60+8.8/3600;lng=130+18/60+1.5/3600;note='公式アクセスiframeの!2z目的地ラベル（33°15\'08.8"N 130°18\'01.5"E）を復号し十進度化。!2d/!3d表示中心は不使用。公式施設案内main/9.htmlは1階佐賀工房バルーンミュージアム店を明記。'
updates.append({'facilityId':fid,'coordinate':{'lat':lat,'lng':lng},'scope':'building','evidence':evidence(r,'アクセス地図 iframe pb !2z='+re.findall(r'!2z([^!]+)',s)[0],note)})
proof.append({'facilityId':fid,'kind':'official-DMS-marker','rawLabels':labels,'identityFinding':note,'buildingSource':fetched['https://www.sagabai.com/balloon-museum/main/9.html'],'sourceURL':r['url'],'calculation':'lat = 33 + 15/60 + 8.8/3600; lng = 130 + 18/60 + 1.5/3600'})
fid='facility:kyushu-e3d5be3b0b0c3ac9d446';r=fetched['https://www.ibusuki.or.jp/tourism/view/cocco/'];s=html.unescape(pathlib.Path(r['snapshotPath']).read_text());assert 'q=31.2320642,130.6442088(' in s;note='公式観光案内の当該博物館詳細、十二町2290と施設専用地図を照合。iframe qに明示された数値目的地点31.2320642,130.6442088を採用。ll表示中心や住所のジオコードを抽出した値ではなく、公開者が施設アクセスに指定した点。'
updates.append({'facilityId':fid,'coordinate':{'lat':31.2320642,'lng':130.6442088},'scope':'building','evidence':evidence(r,'当該博物館ページ iframe src maps?f=q ... q=31.2320642,130.6442088(鹿児島県指宿市十二町2290)',note)})
proof.append({'facilityId':fid,'kind':'official-coordinate-destination','sourceURL':r['url'],'rawLatitude':'31.2320642','rawLongitude':'130.6442088','identityFinding':note})
updateids={u['facilityId'] for u in updates};unresolved=[];audit=[];p05leads=[]
# Search every assigned facility against all eight original prefecture members.
for fid in ids:
 p=places[fid];matches=[]
 a=p['address'].replace('大字','').replace('字',''); nums=re.findall(r'\d+',a);key=nums[0] if nums else '';stem=re.split(r'[\d一二三四五六七八九]',re.sub(r'^.*?[市町村]','',a))[0]
 for pref,m in members.items():
  for i,f in enumerate(m['data']['features']):
   n=f['properties']['P05_003'];addr=f['properties']['P05_004'];same=(len(stem)>1 and stem in addr and key and key in re.findall(r'\d+',addr));named=len(n)>3 and n in p['name']
   if same or named:matches.append({'prefecture':pref,'featureIndex':i,'rawFeature':f,'match':'address-lead' if same else 'name-lead','notAutomaticallyAccepted':True})
 p05leads.append({'facilityId':fid,'addressSearchStem':stem,'number':key,'matches':matches})
 attempts=[{'type':'new-local-original-analysis','sourceUrl':zm['url'],'snapshotPath':zp,'snapshotSHA256':sha(zp),'outcome':f'九州沖縄8県P05原ZIPを新たに名称・番地照合。候補{len(matches)}行（弱い文字列一致を含む、未一致は施設不存在を意味しない）。個別結果はp05-leads.json。','checkedAt':checked}]
 for r in fetched_for(fid):
  attempts.append({'type':'new-http-retrieval','sourceUrl':r['url'],'finalUrl':r.get('finalUrl'),'fetchedAt':r['fetchedAt'],'status':r.get('status'),'error':r.get('error'),'snapshotPath':r.get('snapshotPath'),'snapshotSHA256':r.get('snapshotSHA256'),'purpose':next(t['purpose'] for t in r['targets'] if t['facilityId']==fid),'outcome':'取得原本を追加照合。HTTP成功だけで建物座標が確認済みとは扱わない。' if r.get('status')==200 else '取得失敗。本文を根拠に用いず、制限回避・同一URL反復はしない。'})
 reason=old.get(fid,{}).get('reason','旧proposalの座標原典照合未完了。');category='原典不足'
 if any(w in reason for w in ['別棟','管理棟','南館','本館','西別館','受付建物','広い公園','区別']):category='複数棟・建物同定未完了'
 if '移転' in reason:category='移転・旧新地点の対応未確定'
 if any(w in reason for w in ['利用条件','規約','ライセンス']):category='条件未確認'
 if fid=='facility:kyushu-e7eae1c92a37ac5f0745':
  category='複数棟・建物同定未完了';reason='今回の2026年4月更新庁舎案内と別館1階画像1485.jpgで下水道課は別館1階と確定（画像を目視確認）。P05中間市役所feature1332は本庁総称点で、この別館の数値点と同定できない。部署名・住所の一致だけでは採用しない。'
 if fid=='facility:kyushu-0457cc860e34e1f5a582':
  category='座標競合';reason='新P05照合で物産ホールfeature419と諫早商工会館ビルfeature518を発見。現運営者hallページは物産ホール＝商工会館1階、高城町5-10と同定するが、二点は約38m離れる。どちらが建物内か外形照合未完了のため採用しない。'
 if fid=='facility:ws-f5ea517afaab927bb9':
  category='移転・旧新地点の対応未確定';reason='現公式アクセスは知名1100。P05知名町役場feature1457は知名307の旧庁舎で不一致。追加取得した新アクセスのllは表示中心、qは役場名であり数値建物markerとは扱えない。'
 if fid in ['facility:kyushu-7a9f8dae19665147953f','facility:ws-61c944585418f01447']:
  category='移転・旧新地点の対応未確定';reason='現配布案内・新庁舎移転PDFを追加取得。2022年10月移転を再確認。P05 feature1373の住所は亀津7203だが位置はGDMap2旧点付近で、住所一致のみでは新庁舎との同定ができない。原図から新庁舎建物の数値を確定していない。'
 if fid not in updateids:
  reason+=' 今回の新規取得・P05原値照合の範囲では、採用できる現建物の数値原典を確定できなかった。室内窓口・入口の測量は要求していない。'
  unresolved.append({'facilityId':fid,'reasonCategory':category,'reason':reason,'nextSource':{'url':places[fid]['evidence']['sourceUrl'],'required':('別館1階の外形または公式GISの別館marker。' if 'e7eae1' in fid else p['name']+'（'+p['address']+'）を指す公開GIS/建物外形または公式施設marker。既取得の表示中心・旧地点の再利用では不足。')},'investigationStatus':'new-investigation-unresolved','attempts':attempts})
 audit.append({'facilityId':fid,'name':p['name'],'address':p['address'],'priorReason':old.get(fid,{}).get('reason'),'priorReasonCategory':('未再調査（追加proposal）' if old.get(fid,{}).get('reason','').startswith('追加proposal') else ('配布状態と建物位置の混同' if fid=='facility:kyushu-51dfc976486b8b93581d' else category)),'classification':'candidate-building' if fid in updateids else 'unresolved','newInvestigation':True,'newHTTPAttempts':len(fetched_for(fid)),'priorRecords':priorrecords[fid],'attempts':attempts})
# Exact proposal only; do not alter baseline or distribution status.
fid='facility:kyushu-475d355ad6294a2b61a8';r=fetched['https://motobufs.jp/access/'];assert '沖縄' in pathlib.Path(r['snapshotPath']).read_text()
corrections=[{'facilityId':fid,'targetPath':'data/work/issue7-baseline/ledger.json','selector':{'id':fid},'field':'address','old':places[fid]['address'],'new':places[fid]['address'].replace('沖和県','沖縄県'),'reason':'県名の誤字。現運営者アクセスの沖縄県本部町大浜881-1と照合。配布関係・番地・状態は変更しない。','evidence':evidence(r,'施設アクセスの住所欄','AIが運営者の住所表示と固定台帳を照合。')}]
result={'schema':1,'updates':updates,'unresolved':unresolved,'corrections':corrections};save(OUT,result)
save(E/'coordinate-proof.json',proof);save(E/'target-audit.json',audit);save(E/'p05-leads.json',p05leads);save(E/'reused-snapshots.json',list(refs.values()))
keys={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
for r in updates+corrections:assert set(r['evidence'])==keys;assert sha(r['evidence']['snapshotPath'])==r['evidence']['snapshotSHA256']
for u in updates:
 if next(p for p in proof if p['facilityId']==u['facilityId'])['kind']=='P05':
  p=next(p for p in proof if p['facilityId']==u['facilityId']);lng,lat=members[p['prefecture']]['data']['features'][p['featureIndex']]['geometry']['coordinates'];assert u['coordinate']=={'lat':lat,'lng':lng}
allids=[r['facilityId'] for r in updates+unresolved];assert len(allids)==len(set(allids))==len(ids);assert set(allids)==set(ids);assert all(a['newHTTPAttempts']>0 for a in audit)
assert all(x['exists'] and x['hashMatches'] for x in refs.values())
for c in corrections:assert places[c['facilityId']][c['field']]==c['old'] and c['old']!=c['new']
for name,h in read(E/'input-hashes.json').items():assert sha(name)==h
for r in read(E/'source-conditions.json')['reusedOriginals']:assert sha(r.get('path',r.get('snapshotPath')))==r.get('sha256',r.get('snapshotSHA256'))
save(E/'validation.json',{'checkedAt':checked,'assigned':len(ids),'candidates':len(updates),'unresolved':len(unresolved),'corrections':len(corrections),'allIDsClassifiedExactlyOnce':True,'allTargetsHaveNewHTTPAttempt':True,'allTargetsHaveNewP05Analysis':True,'newHTTPURLs':len(fetches),'newHTTPSuccess':sum(r.get('status')==200 for r in fetches),'rawHashesVerified':True,'reusedSnapshotsVerified':len(refs),'P05NumericValuesExact':True,'officialHTMLNumericExtractionVerified':True,'exactCorrectionOldValuesMatch':True,'evidenceSevenFieldsOnly':True,'fixedInputsUnchanged':True,'unresolvedCategories':dict(collections.Counter(u['reasonCategory'] for u in unresolved))})
print(json.dumps(read(E/'validation.json'),ensure_ascii=False,indent=2))
