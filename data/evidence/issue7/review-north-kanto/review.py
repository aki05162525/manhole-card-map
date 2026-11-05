import json, pathlib, hashlib, zipfile, io, re, html, datetime
ROOT=pathlib.Path('.')
OUT=ROOT/'data/evidence/issue7/review-north-kanto'
def read(p):return json.loads(pathlib.Path(p).read_text())
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def save(p,d):pathlib.Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def text(p):
 t=pathlib.Path(p).read_text(errors='replace');t=re.sub(r'<!--.*?-->','',t,flags=re.S);t=re.sub(r'<(script|style)\b[^>]*>.*?</\1>','',t,flags=re.S)
 return ' '.join(html.unescape(re.sub('<[^>]+>',' ',t)).split())
proposal='data/national/issue7/north-kanto.json';p=read(proposal)
inv={x['facilityId']:x for x in read('data/evidence/issue7/north-kanto/investigation.json')}
ledger=read('data/work/issue7-baseline/ledger.json');places={x['id']:(i,x) for i,x in enumerate(ledger['places'])}
assigned=read('data/work/issue7-baseline/assignments.json')['north-kanto']
allids=[x['facilityId'] for k in ['updates','unresolved'] for x in p[k]]
assert len(allids)==len(set(allids))==112 and set(allids)==set(assigned)==set(inv)
base={str(f):sha(f) for f in pathlib.Path('data/work/issue7-baseline').rglob('*') if f.is_file()}
for f,h in read('data/work/issue7-baseline/hashes.json').items():assert sha('data/work/issue7-baseline/'+f)==h
fields=set(re.findall(r'json:"([^"]+)"',pathlib.Path('cmd/builddata/ledger.go').read_text().split('type Evidence struct {')[1].split('}')[0]));assert len(fields)==7
hashes={}; errors=[]
def check(e):
 if e.get('snapshotPath') and e.get('snapshotSHA256'):
  f=e['snapshotPath'];h=hashes.setdefault(f,sha(f));assert h==e['snapshotSHA256'],f
for f in ['fetch-records.json','additional-fetch-records.json','targeted-fetch-records.json']:
 for e in read('data/evidence/issue7/north-kanto/'+f):check(e)
for x in inv.values():
 for e in x.get('oldEvidenceReferences',[]):check(e)
z=zipfile.ZipFile('data/evidence/issue5/chubu/P05-22_GML.zip')
notes={
'186aaf0b34375b1f039d':'配布記事のアキュム記念デザイン欄に中央1-1-1の烏山庁舎日直室。まちづくり課と同一庁舎。山あげ会館で配る別デザインと区別。',
'1bfeb40ad99d60b3f386':'配布記事の市役所1階29番水道お客様センターと研究学園1-1-1を確認。記事が別途明記する蓋の位置は不使用。',
'25dc369fdbc22580ba80':'配布記事に磯原1630の庁舎1階総合受付。守衛室・市民課との同建物共有を明記。',
'29bd0325065029394d6b':'配布記事は庁舎1階守衛室と明示。独立した守衛小屋の推測は不要。同住所の市役所点。',
'2b7f825239f662031410':'市配布記事は水戸芸術館アートショップコントルポアン、五軒町1-6-8。館のアクセスも同住所・館内店舗を確認。',
'3c73ebb9bfe12f0c6aa9':'配布記事は馬頭555の役場西側日直室。平日の小川1065とは別の対象で、P05の馬頭の役場に対応。',
'4276a35dc1985599c530':'配布記事の氏家2771市役所当直室とP05同名同番地が一致。氏家2190-7卯の里庁舎および旧住所featureと区別。',
'4a157c5ae1e556e15835':'配布記事は木曜・祝日に東6丁目1番8号の中央公民館。蓮田市の同名同番地P05を確認。',
'73f40ac43cb2acd57ac6':'下水道組合の配布記事は取手駅前窓口、新町1-9-1リボンとりで3階。P05同窓口の点。取手支所という台帳接頭語を別建物の根拠にしない。',
'8c9c3d00b39e57cb61d7':'配布先4階と休日1階は同じ新庁舎。ただし市広報2021年5月号p16は新庁舎を旧庁舎の東側に図示。地理院標準地図z18/232871/102656で候補pixel(85.96,74.40)は現在の庁舎外形の西北側の外。2022年基準だけでは移転追随を保証できず採用保留。',
'8f14586e294c59e7ff50':'市配布記事と施設専用ページは草加宿芭蕉庵で一致。HTML initParam_Mapの値が市配信JSでLatLngからMarker.positionに渡る。住所表記訂正とは分離して当該施設の建物代表点として採用可。',
'91edb2f2494934178388':'配布記事は渋川908-21中央公民館。施設案内が渋川東部公民館併設を明記。P05の坂下町表記を含む同番地の中央公民館点。',
'a2c53ffd48e2697dd556':'配布記事の天王崎観光交流センター「コテラス」麻生419-1とP05が一致。白帆の湯との併設表記は同棟の証明に使わず、温泉421-3点を除外。',
'b9794de4ce6f43340943':'市配布記事の山あげ会館（観光協会）金井2-5-26とP05が一致。在庫切れ・休館日など関係状態は変更しない。',
'c0a593ee1ebbefef4ded':'原本文は下野田560コミュニティセンター1階上下水道課事務室内を明記。町施設計画は1986年役場と1982年コミュニティセンターを別施設として記録。候補P05#846は役場、同センター#826は約3m差で競合し、同番地だけで配布建物を確定できない。',
'caa883741cf60ee761be':'新庁舎1階守衛室の存在・同建物共有は確認できるが、平日窓口と共有するP05点が地理院地図の現庁舎外形外。新旧配置の既知差を未解消のため保留。入口の精密位置不足を理由にしていない。',
'd7702132db50cd3bea9d':'市配布記事は2022年7月から佐野市観光物産会館、金井上町2519。配布開始はP05基準後だが建物の新設とは書かれておらず既存同館点と合理的に一致。',
'e6fe57b579c1126842f3':'配布記事の平日窓口は小川1065の小川出張所。P05同名同番地で休日の馬頭庁舎とは別。',
'e9c407539fac35ab201d':'市配布記事はサプラ2階市民窓口ステーション。専用案内の小柴5丁目1番地2・サプラスクエアサプラ2階によりP05小柴5-1-22Ｆを5-1-2と2Fの連接として照合。5-1-22番地への読み替えを排除。',
'f18e4d75a432181f8829':'町配布記事は草津町役場3階上下水道課、末尾の役場所在地は草津28。P05同役場同番地で対応。',
'fdb8db5be17ae5e5d52a':'配布記事は平日氏家2190-7卯の里庁舎。P05同庁舎・同番地で本庁氏家2771点と明確に区別。',
'ffe180a6b3c0c8434319':'市配布記事の平日まちづくり課は中央1-1-1烏山庁舎1階。日直室と同一P05建物点の共有可。',
'kitaibaraki-shiminka':'配布記事は第2・第4日曜に庁舎1階市民課窓口。磯原1630総合受付・守衛室と同建物。曜日条件は保持。',
'shibukawa-sewerage':'配布記事は定期清掃時に第二庁舎下水道課。施設専用記事は石原6番地1の2階下水道課を明記しP05#576に一致。本庁石原80の#602は不使用。'}
deferred={'8c9c3d00b39e57cb61d7','caa883741cf60ee761be','c0a593ee1ebbefef4ded'}
reviews=[];patches=[]
for n,u in enumerate(p['updates']):
 fid=u['facilityId'];key=fid.removeprefix('facility:kanto-north-');x=inv[fid];idx,place=places[fid]
 assert place['name']==x['name'] and place['address']==x['address'];assert 'coordinate' not in place
 assert any(r['placeId']==fid for r in ledger['relations']);assert set(u['evidence'])==fields;assert u['scope']=='building';check(u['evidence'])
 raw=None
 if 'selectedP05' in x:
  archive,rest=u['evidence']['sourceLocator'].split('!');member,number=rest.split('#/features/')
  b=zipfile.ZipFile(io.BytesIO(z.read(archive))).read(member);d=json.loads(b);raw=d['features'][int(number)]
  assert raw==x['selectedP05']['feature'];assert hashlib.sha256(b).hexdigest()==x['selectedP05']['memberSHA256']
  lng,lat=raw['geometry']['coordinates'];assert u['coordinate']=={'lat':lat,'lng':lng}
 else:
  h=pathlib.Path(u['evidence']['snapshotPath']).read_text();assert "'lat':'35.8364752846319','lon':'139.80710998177528'" in h
  js=pathlib.Path('data/evidence/issue7/north-kanto/b7052a3bfa2c9097901194ab.html').read_text();assert 'new google.maps.LatLng(o.lat,o.lon)' in js and 'marker=new google.maps.Marker({position:e})' in js
 status='deferred' if key in deferred else 'accepted'
 refs=[{k:a[k] for k in ['sourceUrl','snapshotPath','snapshotSHA256'] if k in a} for a in x['attempts'] if a.get('snapshotPath') and a.get('kind')=='new-web-fetch']
 snippets=[]
 for a in refs:
  if not a['snapshotPath'].endswith('.html'):continue
  t=text(a['snapshotPath']);terms=['配布場所','配付場所','配布 場所','コミュニティセンター','小柴5丁目','石原6番地','住所 草加市','五軒町']
  spans=[]
  for term in terms:
   for m in list(re.finditer(re.escape(term),t))[:4]:
    k=m.start()
    if all(abs(k-j)>180 for j in spans):spans.append(k)
  if spans:snippets.append({'snapshotPath':a['snapshotPath'],'excerpts':[t[max(0,k-30):k+700] for k in spans[:5]]})
 rec={'facilityId':fid,'name':place['name'],'status':status,'reason':notes[key],'candidateCoordinate':u['coordinate'],'baselineCoordinate':None,'baselinePlaceIndex':idx,'sourceReferences':refs,'rawP05Feature':raw,'checks':{'idAndLedgerMatch':True,'relationExists':True,'evidenceExactlyGoSevenFields':True,'snapshotHashesMatch':True,'rawCoordinateMatches':True},'exactCoordinateProposal':{'targetFile':'data/work/issue7-baseline/ledger.json','path':f'/places/{idx}/coordinate','old':None,'oldPresent':False,'new':u['coordinate'] if status=='accepted' else None,'apply':False,'note':'固定入力は変更禁止。親が採用先へ反映する場合の値比較のみ。'},'textEvidence':snippets}
 if status=='deferred':
  patch={'targetFile':proposal,'path':f'/updates/{n}','op':'remove','old':u,'new':None,'apply':False,'reason':notes[key]};patches.append(patch);rec['exactCandidateCorrection']=patch
 reviews.append(rec)
c=p['corrections'][0];idx,place=places[c['facilityId']];assert c['path']==f'/places/{idx}/address' and place['address']==c['old'];check(c['evidence'])
correction={**c,'status':'deferred','apply':False,'reason':'市配布記事と施設専用案内は新表記で一致し座標対象の同定はできる。ただし旧145番地1が誤りなのか地番表記なのか、その住居表示5番1号との対応を示す原典未確認。訂正と表記統一を区別し、今回は住所変更を保留。','acceptedCoordinateIndependently':True}
licenseNotes={'P05':'個別2022年ページはCC_BY_4.0、JGD2011/(B,L)、基準2022年4月。一般規約の制限付・非商用区分を本データへ一律適用しない。出典・加工表示を維持。','municipality':'自治体が配信する施設座標・住所という事実の利用と、HTML・写真・PDF全文の外部再公開許諾は別。P05のCC BYを自治体原本に拡張しない。本レビューは公開を承認しない。','CRS':'P05はJGD2011 EPSG:6668の経緯度原数値をそのまま保持。WGS84への精密変換・測量精度を主張しない。草加は自治体JSのLatLng利用を確認、明示EPSG記載はない。'}
discrepancies=[{'document':'data/evidence/issue5/north-kanto/README.md','claim':'文書と実装コードの食い違いは、今回読んだ範囲では発見していない','code':'data/evidence/issue5/north-kanto/assemble.py:39 / cmd/builddata/ledger.go:17','finding':'旧assemble.pyはEvidenceにfetchedAtを追加するがGo Evidenceは7フィールドで厳密デコード。今回はGoの7フィールドに従う。Issue7候補24件は一致。'}]
report={'schema':1,'reviewedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reviewer':'independent-ai-review','scope':'建物代表点。入口・室内精度不要。候補24件・住所訂正1件を独立レビュー。','candidateInputSHA256':sha(proposal),'counts':{'accepted':21,'deferred':3,'correction-required':0,'addressCorrectionsDeferred':1,'unresolvedNotDeepReviewed':88},'acceptedIds':[r['facilityId'] for r in reviews if r['status']=='accepted'],'deferredIds':[r['facilityId'] for r in reviews if r['status']=='deferred'],'reviews':reviews,'corrections':[correction],'exactOldNewCorrectionProposals':patches,'sourceConditions':licenseNotes,'documentCodeDiscrepancies':discrepancies,'handoffOnly':True,'automaticallyApprovedOrApplied':False,'remaining88':'分類集合とhashを検証したのみ。全件深掘り済みとは認定しない。','additionalFindings':['investigation.oldEvidenceReferences内の共通GKP原本sourceLocatorには担当施設以外の水戸観光案内所の値を継承した行がある。各採用判断はこのlocatorに依存せず個別自治体原本とP05に基づく。','P05基準年は全featureの建物変更追随を保証しない（小山）。','吉岡P05名称包含検索は配布本文のコミュニティセンターを取り落としていた。']}
assert len(reviews)==24 and len(report['acceptedIds'])==21
supplemental=[
 {'sourceUrl':'https://www.city.oyama.tochigi.jp/data/doc/1693885429_doc_6_0.pdf','snapshotPath':str(OUT/'oyama-202105.pdf'),'snapshotSHA256':sha(OUT/'oyama-202105.pdf'),'sourceLocator':'広報おやま2021年5月号 p16 新旧庁舎配置図; p9 開庁日','purpose':'既知の新旧庁舎の位置関係'},
 {'sourceUrl':read(OUT/'oyama-gsi.json')['url'],'snapshotPath':str(OUT/'oyama-gsi.png'),'snapshotSHA256':sha(OUT/'oyama-gsi.png'),'sourceLocator':'z18 tile x232871 y102656; candidate pixel (85.96136495471,74.40004997700453)','purpose':'候補点は橙色庁舎外形の西北側の外。地図更新時刻は不明。代替座標は抽出していない。'},
 {'sourceUrl':read(OUT/'yoshioka-source.json')['url'],'snapshotPath':str(OUT/'yoshioka-plan.pdf'),'snapshotSHA256':sha(OUT/'yoshioka-plan.pdf'),'sourceLocator':'PDF p3 表1 対象施設の現況 / 対象施設の活用状況','purpose':'役場1986年度・コミュニティセンター1982年度の別施設'},
]
for r in reviews:
 if r['facilityId'].endswith(('8c9c3d00b39e57cb61d7','caa883741cf60ee761be')):r['supplementalEvidence']=supplemental[:2]
 if r['facilityId'].endswith('c0a593ee1ebbefef4ded'):
  r['supplementalEvidence']=supplemental[2:]
  b=zipfile.ZipFile(io.BytesIO(z.read('P05-22_10_GML.zip'))).read('P05-22_10.geojson')
  r['competingP05Feature']={'sourceLocator':'P05-22_10_GML.zip!P05-22_10.geojson#/features/826','feature':json.loads(b)['features'][826],'notApprovedAsReplacement':True}
report['additionalEvidence']=supplemental
report['sourceConditionEvidence']=read(OUT/'fetch-records.json')
save('data/national/issue7/reviews/north-kanto.json',report)
save(OUT/'verification.json',{'checksPassed':True,'candidateCount':24,'candidateP05Count':23,'candidateMunicipalityMarkerCount':1,'assignedCount':112,'snapshotHashes':hashes,'baselineHashes':base,'inputHashes':{proposal:sha(proposal),'data/evidence/issue7/north-kanto/investigation.json':sha('data/evidence/issue7/north-kanto/investigation.json')},'baselineKnownHashesMatch':True,'allRawCoordinatesMatch':True,'allEvidenceFieldsMatchGo':True,'allIDsAndRelationsMatch':True,'correctionOldMatches':True,'semanticReviewIsSeparate':True})
for f,h in base.items():assert sha(f)==h
print(json.dumps(report['counts']));print('verified snapshot files',len(hashes))
