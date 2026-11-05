"""Read-only source verification; writes only the two authorized review destinations."""
import json, pathlib, hashlib, zipfile, io, re, datetime, collections, subprocess, math
D=pathlib.Path('data/evidence/issue7/review-kinki-west')
def read(p): return json.loads(pathlib.Path(p).read_text())
def sha(p): return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def dump(p,x): pathlib.Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
source='data/national/issue7/kinki-west.json'; inp=read(source); rows=read('data/evidence/issue7/kinki-west/coordinate-review.json')
ledger={x['id']:x for x in read('data/work/issue7-baseline/ledger.json')['places']}
assigned=read('data/work/issue7-baseline/assignments.json')['kinki-west']
inv={x['facilityId']:x for x in read('data/evidence/issue7/kinki-west/inventory.json')}
assert len(rows)==len(inp['updates'])==28
assert set(assigned)=={x['facilityId'] for x in inp['updates']+inp['unresolved']}
assert len(assigned)==len(set(assigned))==134
for p,h in read('data/work/issue7-baseline/hashes.json').items(): assert sha('data/work/issue7-baseline/'+p)==h
protected={source:sha(source),'cmd/builddata/ledger.go':sha('cmd/builddata/ledger.go')}
for p in pathlib.Path('data/evidence/issue7/kinki-west').rglob('*'):
 if p.is_file():protected[str(p)]=sha(p)
for p in pathlib.Path('data/work/issue7-baseline').glob('*'):
 if p.is_file():protected[str(p)]=sha(p)
refs={}
for x in read('data/evidence/issue7/kinki-west/fetch-log.json')+read('data/evidence/issue7/kinki-west/reused-references.json'):
 if 'path' in x:
  h=sha(x['path']);assert h==x['sha256'],x['path'];refs[x['path']]={'sha256':h,'fetchedAt':x.get('fetchedAt')};protected[x['path']]=h
z=zipfile.ZipFile('data/evidence/issue5/chubu/P05-22_GML.zip');members={}
for r in rows:
 m=r['sourceMember']
 if m not in members:
  a,b=m.split('/');inner=zipfile.ZipFile(io.BytesIO(z.read(a)));raw=inner.read(b);xml=inner.read(b.replace('.geojson','.xml')).decode()
  members[m]=(json.loads(raw),hashlib.sha256(raw).hexdigest(),xml)
reasons=[
'旧華甍は貸室手続き原本の今井町2丁目3-5とP05今井まちなみ交流センターが一致。移転告知は新施設3丁目8番8号を別記しており旧建物自体の点として採用する。',
'公式配布原本が市役所庁舎2階と狭山一丁目2384番地の1を明記。P05市役所の名称住所一致。狭山池博物館とは別施設として照合。',
'配布原本の庁舎1階西側出入口の宿直室と、交通案内・P05の白木1359-6を照合。同庁舎内の窓口として十分。',
'配布原本の公民館堅下分館（堅下合同会館）・大県3丁目9-19とP05公民館堅下分館が一致。市民文化センターやリビエールホールとは区別。',
'配布表が観光協会を高田町92-16市民交流館1階に特定。P05市民交流館を使用できる。同名用途別レコードの約0.3m差は建物代表点の判断を変えない。',
'配布原本は土日祝の市役所1階宿直室を明記。市役所案内の阿保1-1-1とP05一致。平日観光協会阿保4-1-4とは区別。',
'現配布原本の下戸田128番地の1・市役所2階208窓口とP05役所住所が一致。旧郷瀬町の住所ではなく移転後の所在地レコードである。',
'公式配布原本に西川辺165-3、平日役場下水道課、休日当直室を併記。P05役場と一致。',
'公式配布原本が尾崎町35-1の市役所地下1階守衛室を明記。鳥取の分室・カーナビ用住所とは区別できる。',
'公式配布原本の庁舎2階西フロア27番窓口と白木1359-6のP05役場が対応。同建物1階の休日窓口と共通の代表点を使用できる。',
'市公式はアステ市民プラザをアステ川西6階栄町25番1-601号、図書館公式は中央図書館を同ビル4・5階栄町25-1と明記。P05中央図書館を同じ建物の点として採用。',
'公式原本は休日当直室へ庁舎東玄関から入るよう明記。西川辺165-3の役場内であり独立守衛棟の推定を必要としない。',
'公式沿革は1994年開設の生涯学習センター＝アイセルシュラホール、2025年リニューアル後も3・4階に生涯学習機能を保持と説明。配布先1階とP05生涯学習センターは同建物。',
'公式配布原本が北新町41本庁舎2階を指定。P05市役所の名称住所が対応し、同番地の田園交響ホールは別用途・別点として除外。',
'配布原本は市役所13階、アクセス原本は荒本北一丁目1番1号を明記。P05市役所と対応。同じ庁舎22階の窓口と建物点を共用可能。',
'本館2階かしわらテラスの施設同定と2021年竣工は確認。ただしP05市役所1610が同住所の女性センター1611・フローラルセンター1612と約1mの同一点群を形成。原本は本館と1995年竣工の別館を区別し、配布HTMLの別館写真srcもfloralcenter.jpgである。2022年版という時点だけでは1610が新本館に更新されたことを確定できない。配置図と点の対応が残るため保留。',
'固定台帳の宿直室は本館1階、中町1-1。現一時中止案内も本館2階の経営総務課・中町1-1を記載し、P05役所と対応。現在配布中であるとの判断は行わない。',
'配布原本の田尻町立公民館・嘉祥寺1120番地2とP05公民館（自治体27362）の住所が一致。嘉祥寺375番地1の役場別館とは区別。',
'現配布原本・運営者施設概要のかしはらナビプラザ内膳町1-6-8とP05観光交流センターが一致。藤原京資料室やマンホール蓋の座標を使用しない。',
'現配布原本の休日窓口加西市民会館と運営者概要・アクセスの北条町古坂1-1が対応。P05市民会館を採用。役所付属棟北条町横尾1000とは別住所。',
'現中止告知の問い合わせ先は経営総務課、本館2階、中町1-1。固定台帳の施設とP05役所の名称住所が対応。点の補完に限る。',
'配布原本に吉川支所・吉川町大沢412、山田錦の館閉館日の窓口と明記。P05支所レコードに対応。吉安222の山田錦の館や同番地の健康福祉施設を選ばない。',
'配布原本にパープルホール本館1階事務所・北岡1-2-3と明記。P05名称にも本館を含み、施設案内の別施設北岡1-2-8と区別。',
'スワンホールと昆陽池2-1の施設同定は成立。ただし公式施設・運営者原本は中央公民館も同館内と明記する一方、P05中央公民館948はスワンホール947から約482m離れる。名称が完全一致する947を選ぶだけでは同一建物に対する数値競合を解消しない。946・1021の近接点や公式ページのll表示中心は補助情報に留まり、建物外形・公式目的点による判別を要する。',
'配布原本に福崎町役場上下水道課窓口、役場案内に南田原3116-1を確認。P05役場と一致。駅前・辻川の観光交流センターは別施設。',
'現配布原本の市役所22階展望ロビーとアクセス原本の荒本北一丁目1番1号が対応。13階と同庁舎のためP05市役所代表点を使用可能。',
'2026年10月1日移転告知に今井まちづくりセンター・今井町3丁目8番8号を明記。P05当該施設の名称住所と一致し旧華甍の点とは異なる。',
'現配布原本は本庁舎3階12番窓口、庁舎案内は2021年9月竣工、2021年11月広報は同月15・22日の業務開始を明記。2022年4月基準P05の本庁分類1・高砂市役所を名称住所と時点から現本庁舎に対応させる。西庁舎分類2の1290は別棟として除外。建物代表点としての合理的対応であり、各点の現地測量確認までは主張しない。'
]
assert len(reasons)==28
reviews=[]
for i,(r,u) in enumerate(zip(rows,inp['updates'])):
 fid=r['facilityId'];assert fid==u['facilityId'];assert fid in ledger
 assert r['name']==ledger[fid]['name'] and r['address']==ledger[fid]['address']
 geo,h,xml=members[r['sourceMember']];assert h==r['sourceMemberSHA256'];assert geo['crs']['properties']['name']=='urn:ogc:def:crs:EPSG::6668'
 f=geo['features'][r['featureIndex']];assert f==r['sourceFeature'];assert u['coordinate']==r['coordinate']==dict(zip(['lng','lat'],f['geometry']['coordinates']))
 assert u['scope']=='building';e=u['evidence'];assert set(e)=={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
 assert sha(e['snapshotPath'])==e['snapshotSHA256'];assert re.fullmatch(r'\d{4}-\d{2}-\d{2}',e['checkedAt']);datetime.date.fromisoformat(e['checkedAt'])
 idx=r['featureIndex'];node=re.search(r'<ksj:LocalGovernmentOfficeAndPublicMeetingFacility gml:id="P05_'+str(idx)+r'">(.*?)</ksj:LocalGovernmentOfficeAndPublicMeetingFacility>',xml,re.S)[1]
 assert '<ksj:Name>'+f['properties']['P05_003']+'</ksj:Name>' in node
 assert '<ksj:address>'+f['properties']['P05_004']+'</ksj:address>' in node
 pt=re.search(r'xlink:href="#([^"]+)"',node)[1];pos=re.search(r'<gml:Point gml:id="'+pt+r'">\s*<gml:pos>(.*?)</gml:pos>',xml,re.S)[1]
 assert list(map(float,pos.split()))==[u['coordinate']['lat'],u['coordinate']['lng']]
 sr=[]
 for s in r['currentSources']:
  assert sha(s['path'])==s['sha256'];sr.append({'sourceUrl':s['url'],'snapshotPath':s['path'],'snapshotSHA256':s['sha256'],'fetchedAt':s['fetchedAt']})
 old=r['priorDistributionEvidence'];assert sha(old['snapshotPath'])==old['snapshotSHA256']
 reviews.append({'facilityId':fid,'name':r['name'],'decision':'deferred' if i in [15,23] else 'accepted','reason':reasons[i], 'coordinate':u['coordinate'],'facilityIdentity':'matched','buildingPointCorrespondence':'unresolved-conflict' if i in [15,23] else 'reasonable-name-address-and-current-building-match','evidenceContract':'passed actual Go validateEvidence, including checkedAt YYYY-MM-DD','numericVerification':{'snapshotPath':e['snapshotPath'],'snapshotSHA256':e['snapshotSHA256'],'sourceMember':r['sourceMember'],'sourceMemberSHA256':h,'featureIndex':idx,'sourceFeature':f,'gmlFeatureId':'P05_'+str(idx),'gmlPointId':pt,'gmlPositionLiteral':pos,'crs':'EPSG:6668 / JGD2011','geojsonAxisOrder':['longitude','latitude'],'gmlAxisOrder':['latitude','longitude'],'transformation':'axis mapping only; no datum transformation or added precision','sourceLocatorExactMatch':e['sourceLocator']==f"{r['sourceMember']} $.features[{idx}] P05_003={f['properties']['P05_003']}; P05_004={f['properties']['P05_004']}; geometry.coordinates=[{u['coordinate']['lng']},{u['coordinate']['lat']}]; memberSHA256={h}"},'identitySources':sr,'priorDistributionSnapshot':old['snapshotPath'],'sourceConditionsReference':'data/evidence/issue7/review-kinki-west/source-conditions.json','nextRequiredSource': ('本館・別館の配置図とP05点1610の外形対応。フローラルセンターとの関係を明示して解消。' if i==15 else 'スワンホールの公式建物外形または目的地点。P05中央公民館948との数値競合を解消。' if i==23 else None)})
 assert reviews[-1]['numericVerification']['sourceLocatorExactMatch']
# Read primary product specification afresh from the PDF rather than trusting the text derivative.
pdf='data/evidence/national/official-facility-index/p05-spec.pdf';txt=subprocess.check_output(['pdftotext','-layout',pdf,'-']).decode();assert '6 データ品質' in txt and '8 メタデータ' in txt and '該当施設の建物外周内に' in txt
catalog='data/evidence/national/official-facility-index/p05.html';general='data/evidence/issue5/chubu/p05-terms.html';current='data/evidence/issue5/chubu/p05-catalog.html'
assert 'オープンデータ（CC_BY_4.0）' in pathlib.Path(catalog).read_text();assert 'PDL1.0' in pathlib.Path(general).read_text();assert '適用する利用規約に基づく（オープンデータ）' in pathlib.Path(current).read_text()
conditions={'individualP052022':{'license':'CC BY 4.0','snapshotPath':catalog,'snapshotSHA256':sha(catalog),'locator':'このデータの使用許諾条件 / オープンデータ（CC_BY_4.0）','preserveHistoricalIndividualDesignation':True},'currentGeneralTerms':{'license':'PDL1.0','effectiveDate':'2026-03-23','snapshotPath':general,'snapshotSHA256':sha(general),'currentCatalogPath':current,'currentCatalogSHA256':sha(current)},'requirements':['国土交通省・国土数値情報P05-22の出典と原典URL、適用ライセンスを表示する。','対象レコードの抽出と軸順対応を明記し、国が本成果を作成したとの表示をしない。','現在の一般規約PDLと保存済み個別CC BY指定を別記し、旧個別指定を消さない。'],'municipalOriginals':'HTMLは名称・住所・同建物の照合資料。P05の許諾を自治体HTMLに適用しない。座標事実の採用とHTML全文の公開再配布許諾は別であり、本レビューは後者を承認しない。','publicationAction':'none','specification':{'snapshotPath':pdf,'snapshotSHA256':sha(pdf),'chapter':6,'chapter8':'メタデータ','meaning':'品質基準として建物外周内の検査を規定。個別現況・移転・別棟・競合を自動的に証明するものではない。'}}
dump(D/'source-conditions.json',conditions)
corrections=list(inp['corrections'])
src='data/evidence/national/official-facility-index/sources.json';old=read(src)[0]['pointMeaning'];assert '8章' in old
corrections.append({'targetPath':src,'jsonPointer':'/0/pointMeaning','old':old,'new':old.replace('8章','6章「データ品質」'),'reason':'READMEと同じ誤った章参照が構造化出典にも残る。原PDFで6章を確認。','applied':False})
reuse='data/evidence/issue7/kinki-west/reused-references.json';rr=read(reuse);idx=next(i for i,x in enumerate(rr) if x['path']==pdf);meta=read(pdf+'.source.json')
corrections.append({'targetPath':reuse,'jsonPointer':f'/{idx}/fetchedAt','old':rr[idx]['fetchedAt'],'new':meta['fetchedAt'],'reason':'原本PDFと一致する既存.source.jsonに実取得時刻が存在。再読時刻で置き換えず原取得時刻を継承する。','evidencePath':pdf+'.source.json','applied':False})
rd='data/evidence/issue7/kinki-west/README.md';old='P05の利用条件はCC BY 4.0。';assert old in pathlib.Path(rd).read_text()
corrections.append({'targetPath':rd,'old':old,'new':'保存済みP05-2022個別ページ（data/evidence/national/official-facility-index/p05.html）はCC BY 4.0を指定している。一方、今回のカタログは適用する利用規約に基づくオープンデータと記載し、現行一般利用規約は2026年3月23日施行のPDL1.0である。旧個別CC BY指定を保持し、現在の一般規約とは区別する。','reason':'旧個別指定の原本参照を明示し、現在の一般PDLとの混同を避ける。','applied':False})
for i in [15,23]:
 u=inp['updates'][i];old=u['evidence']['verificationMethod']
 corrections.append({'targetPath':source,'jsonPointer':f'/updates/{i}/evidence/verificationMethod','facilityId':u['facilityId'],'old':old,'new':reasons[i]+' 未解消のため建物点として採用しない。','reason':'採用断定を保留根拠に訂正。更新候補をmanifestに適用しない。新座標は未確定のため捏造しない。','applied':False})
old='コードと文書の不一致は検出していない。';assert old in pathlib.Path(rd).read_text()
new='既存取得時刻の継承について文書とbuild.pyの実装に相違がある。build.pyは再利用仕様書PDFのfetchedAtを無条件にnullとするが、同PDFの.source.jsonには原取得時刻が存在する。7フィールド一致はEvidence全契約の検証ではないが、今回28件のcheckedAtは実Go検証に合格した。'
corrections.append({'targetPath':rd,'old':old,'new':new,'reason':'文書は既存取得メタデータを記録すると述べる一方、build.pyの汎用再利用ループはfetchedAtを無条件nullとしている。実コードと出力に従って相違を報告。','applied':False})
remaining=[{'facilityId':x['facilityId'],'decision':'deferred','reason':x['reason'],'investigationStatus':x['investigationStatus'],'reviewScope':'既存未解決区分を維持。候補28件と同等の独立全本文精査を実施したとは扱わない。','nextSource':x['nextSource']} for x in inp['unresolved']]
partial=sum(x['investigationStatus']=='new-fetch-and-p05-screening-partial' for x in remaining);assert partial==71 and len(remaining)==106
contract=subprocess.check_output(['go','run',str(D/'evidence_contract.go')]).decode();(D/'go-contract-result.txt').write_text(contract)
result={'schema':1,'reviewedAt':'2026-11-05','input':{'path':source,'sha256':sha(source)},'scope':'独立建物代表点レビュー。元成果・manifest・状態・関係は変更しない。','summary':{'assigned':134,'candidatesReviewed':28,'accepted':26,'deferredCandidates':2,'correctionRequiredCandidates':0,'originalUnresolved':106,'originalManuallyInvestigatedUnresolved':35,'originalPartiallyInvestigatedUnresolved':71,'allRemainingDeepReviewed':False},'acceptedIds':[x['facilityId'] for x in reviews if x['decision']=='accepted'],'deferredCandidateIds':[x['facilityId'] for x in reviews if x['decision']=='deferred'],'reviews':reviews,'remaining':remaining,'corrections':corrections,'codeDocumentDiscrepancies':[{'document':rd,'code':'data/evidence/issue7/kinki-west/build.py','claim':'既存取得メタデータの実取得時刻をreused-references.jsonに記録し、ないものはnull','actual':'汎用再利用ループはfetchedAtを無条件nullにする。p05-spec.pdf.source.jsonの実取得時刻が反映されない。','followed':'実コードのnull出力を事実として記録し、補正提案は別保存。'}],'evidenceDateContract':{'source':'cmd/builddata/ledger.go:121','required':'YYYY-MM-DD','validCandidates':28,'datetimeNegativeControlRejected':True,'execution':contract.strip()},'sourceDocumentDiscrepancies':['仕様書参照8章→6章。既存READMEの提案を確認しsources.jsonの同じ誤記も追加。','現行カタログ/一般PDLと旧個別CC BY指定の違いを明示する。'],'limitations':['建物代表点の判断であり入口・室内座標の測量確認ではない。','全施設の改修不存在を証明したものではない。','原本HTML全文の公開再配布許諾は認定しない。','残106件のうち71件の精査未完を維持。']}
pathlib.Path('data/national/issue7/reviews').mkdir(exist_ok=True)
dump('data/national/issue7/reviews/kinki-west.json',result)
for p,h in protected.items():assert sha(p)==h,p
validation={'candidateCount':28,'accepted':26,'deferred':2,'originalSnapshotsHashed':len(refs),'candidateCurrentSources':len({s['path'] for r in rows for s in r['currentSources']}),'allNumericValuesAndGMLIdsVerified':True,'allSevenFieldsAndActualGoContractPassed':True,'inputAndBaselineHashesUnchanged':True,'protectedFilesChecked':len(protected),'all134IdsClassifiedExactlyOnce':len({x['facilityId'] for x in reviews+remaining})==134,'partialUnresolved':71,'codeDocumentDiscrepancyCount':1}
dump(D/'validation.json',validation);dump(D/'source-hashes.json',refs);print(json.dumps(validation,ensure_ascii=False))
