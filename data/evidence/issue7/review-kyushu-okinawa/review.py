"""Independent read-only input verification; writes only this evidence dir and the review JSON."""
import pathlib,json,hashlib,zipfile,io,re,html,base64,datetime,subprocess,math
E=pathlib.Path('data/evidence/issue7/review-kyushu-okinawa')
I=pathlib.Path('data/national/issue7/kyushu-okinawa.json')
O=pathlib.Path('data/national/issue7/reviews/kyushu-okinawa.json')
def dump(p,x):p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def plain(p):
 t=pathlib.Path(p).read_text();t=re.sub(r'<!--.*?-->','',t,flags=re.S);t=re.sub(r'<(script|style)\b.*?</\1>','',t,flags=re.S);return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',t))).strip()
x=json.loads(I.read_text());p=json.load(open('data/evidence/issue7/kyushu-okinawa/coordinate-proof.json'));l=json.load(open('data/work/issue7-baseline/ledger.json'));places={v['id']:v for v in l['places']};assert len(x['updates'])==9 and len(x['corrections'])==1
now=datetime.datetime.now(datetime.timezone.utc).isoformat();hashes={}
def ref(s):
 path=s.get('snapshotPath',s.get('path'));h=s.get('snapshotSHA256',s.get('sha256'));assert sha(path)==h,path;hashes[path]=h
 return {'sourceUrl':s.get('sourceUrl',s.get('url')),'snapshotPath':path,'snapshotSHA256':h}
conditions=json.load(open('data/evidence/issue7/kyushu-okinawa/source-conditions.json'))
for s in conditions['reusedOriginals']:ref(s)
zip_path=x['updates'][0]['evidence']['snapshotPath'];z=zipfile.ZipFile(zip_path);members={};raw_checks=[]
for pref in ['40','42','43','46']:
 zipname=f'P05-22_{pref}_GML.zip';inner=z.read(zipname);zz=zipfile.ZipFile(io.BytesIO(inner));name=next(n for n in zz.namelist() if n.endswith('.geojson'));b=zz.read(name)
 members[pref]=(json.loads(b),json.loads(b,parse_float=str,parse_int=str),hashlib.sha256(b).hexdigest(),hashlib.sha256(inner).hexdigest(),name)
findings=[
 '運営者がナースパワーアリーナ＝熊本市総合体育館・青年会館、出水2-7-1を明示。P05総合体育館と対応。青年会館点は約4.7m差の併設機能点で、総合体育館を採用する判断は合理的。',
 '運営者のフロア案内で博多南駅前ビル1Fインフォメーションと中原2丁目120を確認。P05町民情報ステーションの同住所の建物と合理的に対応。駅構内や隣接広場への置換ではない。',
 '別IDのナカイチも同じ名称・番地・電話・駅前ビルを指す。建物点共有は合理的。配布関係のstatusが異なるためID統合・関係変更をしない。',
 '公式役場案内は蔵本郷1850番地6の3階17番窓口を水道課と記載。P05本庁1500を採用し、西館1508は不採用。',
 '公式配布本文で宰府三丁目2番3号の太宰府館を確認。2026-10-01～12-22の駅内観光案内所への一時変更は別建物。旧館点のみを整備しsuspended/reviewUntilを維持する判断は妥当。',
 '公式庁舎案内は国分シビックセンターを本館・別館・議会庁舎・公民館等の集合とし、総合窓口は行政庁舎本館1階と明記。P05には同住所でfeature626霧島市役所と630国分シビックセンターが約48m離れて存在する。原提案は626との対応を解決せず総称630を本館点とする。公式1階図・地理院外形を追加確認したが、連続した複合施設外形内であることだけでは630と本館棟の対応を確定できなかった。別館・複合施設との区分を解決するまで保留。室内窓口位置の精度は要求しない。',
 '現公式庁舎配置表の本庁2階に都市整備課を確認。別施設あんぼう21・旧スタジオ21は別表。加世田川畑2648のP05南さつま市役所点に対応。',
 '公式アクセスのiframeは地図中心!2d/!3dとは別の!3m3!1m2内にDMS目的地ラベル!2zを持つ。復号した原DMSから十進値を再計算して完全一致。施設案内・アクセス本文の1階佐賀工房と松原2丁目2-27に対応。',
 '観光協会の当該博物館詳細は十二町2290番地を明記し、施設専用iframeに数値q目的地と同住所ラベルを設定。qとllが等しくても採用根拠はq。住所検索結果やGoogle応答の抽出ではない。'
]
reviews=[];patches=[]
for i,(u,proof) in enumerate(zip(x['updates'],p)):
 assert u['facilityId']==proof['facilityId'];fid=u['facilityId'];place=places[fid];ev=ref(u['evidence']);assert set(u['evidence'])=={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
 row={'facilityId':fid,'status':'deferred' if i==5 else 'correction-required','coordinateDecision':'deferred' if i==5 else 'accepted','name':place['name'],'address':place['address'],'proposedCoordinate':u['coordinate'],'scope':'building','finding':findings[i],'evidence':ev,'goEvidence':{'fields':'exactly 7; strict decode passes','semanticValidation':'fails checkedAt date format; YYYY-MM-DD correction passes'},'requiredCorrectionIds':[f'date-update-{i}'],'preserveRelations':[r for r in l['relations'] if r['placeId']==fid]}
 if i<7:
  pref=proof['prefecture'];g,tokens,mh,zh,name=members[pref];idx=proof['featureIndex'];f=g['features'][idx];c=f['geometry']['coordinates'];assert u['coordinate']=={'lat':c[1],'lng':c[0]};assert f==proof['rawFeature'];assert mh==proof['memberSHA256']
  row['rawCoordinate']={'outerZipSHA256':sha(zip_path),'innerZipSHA256':zh,'geojsonSHA256':mh,'locator':f'P05-22_{pref}_GML.zip!{name}#/features/{idx}','feature':f,'numericTokens':tokens['features'][idx]['geometry']['coordinates'],'axisOrder':['longitude','latitude'],'crs':g['crs'],'transformation':'none; source longitude/latitude fields mapped to lng/lat'}
  row['license']='P05 individual CC BY 4.0; retain MLIT attribution, dataset URL, license URL, processing statement and no endorsement. Building HTML is separate.'
 else:
  text=pathlib.Path(ev['snapshotPath']).read_text();iframes=re.findall(r'<iframe\b[^>]+>',text);iframe=next(v for v in iframes if 'maps' in v);row['rawCoordinate']={'iframe':iframe,'crs':{'declaredInHTML':None,'interpretation':'Google Maps geographic latitude/longitude convention (WGS84 assumed); no explicit EPSG declaration in publisher HTML; not JGD2011 evidence'},'transformation':'DMS to decimal degrees' if i==7 else 'none'}
  if i==7:
   token=re.search(r'!2z([^!"&]+)',iframe).group(1);decoded=base64.urlsafe_b64decode(token+'='*((-len(token))%4)).decode();assert decoded=='33°15\'08.8"N 130°18\'01.5"E';calc={'lat':33+15/60+8.8/3600,'lng':130+18/60+1.5/3600};assert calc==u['coordinate'];row['rawCoordinate'].update(encodedLabel=token,decodedLabel=decoded,axisOrder=['latitude(N)','longitude(E)'],formula={'lat':'33 + 15/60 + 8.8/3600','lng':'130 + 18/60 + 1.5/3600'},computed=calc)
  else:
   q=re.search(r'[?&]q=([^&]+)',html.unescape(iframe)).group(1);m=re.match(r'([\d.]+),([\d.]+)',q);assert {'lat':float(m[1]),'lng':float(m[2])}==u['coordinate'];row['rawCoordinate'].update(rawQ=q,numericTokens=[m[1],m[2]],axisOrder=['latitude','longitude'])
  row['license']='Individual coordinate/address facts from publisher HTML; no open license or full-HTML external redistribution permission established. Google map response, tiles, imagery and database are not used for these coordinates.'
 if proof.get('buildingSource'):
  br=ref(proof['buildingSource']);text=plain(br['snapshotPath']);terms={0:['ナースパワー','出水2-7-1'],1:['中原2丁目120','1F TERMINAL'],2:['中原2丁目120'],3:['17番窓口','3階'],4:['12月22日','宰府三丁目'],5:['行政庁舎本館','行政庁舎別館','総合窓口'],6:['都市整備課','本庁'],7:['佐賀工房']}[i];snippets=[]
  for term in terms:
   m=re.search(re.escape(term),text)
   if m:snippets.append(text[max(0,m.start()-75):m.end()+130])
  row['buildingEvidence']={**br,'excerpts':snippets}
 else:row['buildingEvidence']={**ev,'finding':'当該ページのタイトル・所在地・電話と施設専用iframeを確認。'}
 patches.append({'id':f'date-update-{i}','targetPath':str(I),'jsonPointer':f'/updates/{i}/evidence/checkedAt','facilityId':fid,'old':u['evidence']['checkedAt'],'new':'2026-11-05','reason':'cmd/builddata/ledger.go validateEvidence uses time.Parse("2006-01-02", ...). Preserve detailed checked time in auxiliary metadata, not Evidence.','applied':False})
 reviews.append(row)
# Competing original features are explicitly retained, not hidden by exact name selection.
comp=[]
for pref,indices in [('43',[38,40]),('42',[1500,1508]),('46',[626,630,632,642])]:
 g,t,mh,zh,n=members[pref]
 for i in indices:comp.append({'locator':f'P05-22_{pref}_GML.zip!{n}#/features/{i}','geojsonSHA256':mh,'feature':g['features'][i]})
dump(E/'competing-features.json',comp)
u=x['corrections'][0];assert places[u['facilityId']]['address']==u['old'];a=ref(u['evidence']);assert '沖縄県国頭郡本部町字大浜８８１番地１' in plain(a['snapshotPath'])
patches.append({'id':'date-address-0','targetPath':str(I),'jsonPointer':'/corrections/0/evidence/checkedAt','facilityId':u['facilityId'],'old':u['evidence']['checkedAt'],'new':'2026-11-05','reason':'Evidence date-only validation','applied':False})
address={'facilityId':u['facilityId'],'status':'correction-required','addressDecision':'accepted','evidence':a,'finding':'固定台帳のexact old一致。運営者所在地は沖縄県国頭郡本部町字大浜８８１番地１。県名のみの訂正は妥当。coordinateは付与しない。','requiredCorrectionIds':['date-address-0'],'proposedCorrection':{**u,'applied':False},'correctedEvidence':{**u['evidence'],'checkedAt':'2026-11-05'}}
# Extract actual current Go struct AND semantic validator, preserving the input untouched.
r=subprocess.run(['go','run',str(E/'evidence-probe.go')],text=True,capture_output=True,check=True);(E/'go-validation.txt').write_text(r.stdout);assert r.stdout.count('original=invalid evidence checkedAt:')==10 and r.stdout.count('date-only=<nil>')==10
unresolved=[{'facilityId':v['facilityId'],'status':'deferred','reasonCategory':v['reasonCategory'],'reason':v['reason'],'reviewDepth':'existing deferral preserved; not independently exhausted','sourcePointer':f'/unresolved/{i}'} for i,v in enumerate(x['unresolved'])];assert len(unresolved)==65
# All original manifest references are verified where used. Fresh fetch dates are kept apart from Evidence dates.
checks={'checkedAt':now,'candidateCount':9,'addressCorrectionCount':1,'p05ExactMatches':7,'htmlExactMatches':2,'EvidenceStrictDecodePasses':10,'EvidenceSemanticFailuresBeforeCorrection':10,'EvidenceSemanticPassesAfterDateCorrection':10,'originalSnapshotHashes':hashes,'baselineDeclaredHashes':{k:sha(pathlib.Path('data/work/issue7-baseline')/k)==v for k,v in json.load(open('data/work/issue7-baseline/hashes.json')).items()}}
assert all(checks['baselineDeclaredHashes'].values())
protected=json.load(open(E/'protected-before.json'));changed=[k for k,v in protected.items() if sha(k)!=v];assert not changed,changed;checks['protectedInputFilesChecked']=len(protected);checks['protectedInputChanges']=changed
dump(E/'verification.json',checks)
accepted=[v['facilityId'] for v in reviews if v['coordinateDecision']=='accepted']
report={'schema':1,'reviewedAt':now,'role':'independent review sub-agent','input':{'path':str(I),'sha256':sha(I),'readmePath':'data/evidence/issue7/kyushu-okinawa/README.md','readmeSHA256':sha('data/evidence/issue7/kyushu-okinawa/README.md')},'scope':'9 coordinate candidates and 1 address correction; building representative points; no room/entrance surveying or universal no-reconstruction proof required','instructions':{'AGENTS':'User-provided AGENTS instructions read. No AGENTS.md file found in repository data/cmd trees or root/ancestor locations searched.','writes':'Only designated review JSON and new review evidence directory','distributionRelations':'immutable; all preserved','baseline':'immutable; do not apply address correction to fixed baseline'},'summary':{'coordinateCandidates':{'acceptedAsSubmitted':0,'correction-required':8,'deferred':1,'acceptedAfterExactDateCorrection':8},'addressCorrections':{'correction-required':1,'addressFactAccepted':1},'existingDeferralsPreserved':65},'acceptedIds':[],'acceptedCoordinateFactIds':accepted,'adoptableAfterExactCorrectionsIds':accepted,'deferredCandidateIds':[reviews[5]['facilityId']],'candidates':reviews,'addressCorrection':address,'exactCorrections':patches,'acceptedAddressCorrectionProposal':{'facilityId':u['facilityId'],'targetPath':u['targetPath'],'selector':u['selector'],'field':u['field'],'old':u['old'],'new':u['new'],'applyToFrozenBaseline':False,'instruction':'Parent may use exact old/new in its editable integration ledger; frozen baseline must remain untouched.'},'preservedDeferrals':unresolved,'sourceConditions':{'P05':{'decision':'individual CC BY 4.0 designation confirmed in both saved original and fresh HTML, not a commented-out label','sourceUrl':'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-2022.html','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','requirements':['国土交通省・データセット・出典URL・CC BY 4.0を表示','原値からlat/lngへ転記した加工を明示','国土交通省の承認を示唆しない'],'generalTerms':'Current general PDL1.0 applies absent individual rights indication; does not erase P05-specific CC BY. agreement_01 confirms CC BY compatibility and separate rules.'},'HTML':{'coordinateFacts':'Individual published numeric destination and address facts may be used for this evidence assessment. No site-wide open license inferred.','externalFullHTMLRedistribution':'not cleared by this review; copyrighted text, images, layout and embedded-map content have separate rights. Local audit preservation does not itself establish permission for external redistribution. Parent must separately resolve packaging; this does not by itself defer coordinate facts.','maps':'The two HTML-derived candidates use publisher-specified destination parameters; no Google map response was fetched. Review-only GSI tiles for civic building comparison are separate evidence, not source for new coordinates.'},'support':'data/evidence/issue7/kyushu-okinawa/source-conditions.json','freshSnapshots':'data/evidence/issue7/review-kyushu-okinawa/fetches.json'},'documentationCodeDiscrepancies':[{'document':'data/evidence/issue7/kyushu-okinawa/README.md','claim':'その他のコード仕様との不一致は見つかっていない / 厳密デコード10件で検証','code':'cmd/builddata/ledger.go:121','finding':'All 9 updates and 1 correction have timestamp checkedAt; actual validateEvidence accepts YYYY-MM-DD only. Existing verify-go.py extracts Evidence but never executes validateEvidence. Strict decoding success does not imply runtime validity.','resolution':'Follow code; 10 exact date corrections proposed. Existing outputs not modified.'},{'document':'data/evidence/issue5/west-south/README.md','claim':'ドキュメントと実装コードの食い違いはない','code':'cmd/builddata/ledger.go:17,88','finding':'Old west-south corrections[0..2].evidence contain fetchedAt outside current Evidence7; DisallowUnknownFields rejects it. Reconfirmed from raw JSON, as input README already noted.','resolution':'Follow Evidence7; no old artifacts modified.'}],'limitations':['国分の630/626と本館棟の対応は未確定。新座標を推測して置換しない。','既存65保留は維持。全残件の深掘り完了・原典不存在を主張しない。','施設HTML全文・画像の外部再配布許諾は本レビューでは確立していない。','全アプリの文書・実装監査は範囲外。'],'verificationArtifact':str(E/'verification.json'),'goValidationArtifact':str(E/'go-validation.txt'),'competingFeaturesArtifact':str(E/'competing-features.json'),'civicAdditionalEvidence':{'officialFloorMap':str(E/'civic-floor.jpg'),'GSI':str(E/'civic-gsi.json'),'finding':'GSI tile candidate pixel (23.634,57.227) lies within connected civic-complex outline. Official floor image distinguishes complex facilities/main building/council/annex. These do not georeference the named main-building wing sufficiently to resolve the distinct P05 points; do not treat entire complex membership as proof of main-building identity.'}}
dump(O,report);print(json.dumps(report['summary'],ensure_ascii=False));print('verified protected files',len(protected),'output',O)
