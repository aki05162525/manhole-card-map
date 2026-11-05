import json, hashlib, re, io, zipfile, csv, html, datetime
from pathlib import Path
D=Path('data/evidence/issue7/review-south-kanto')
OUT=Path('data/national/issue7/reviews/south-kanto.json')
SRC='data/national/issue7/south-kanto.json'
def read(p): return json.loads(Path(p).read_text())
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p,v): Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
def pointer(doc,p):
 for k in p.split('/')[1:]: doc=doc[int(k)] if isinstance(doc,list) else doc[k]
 return doc
x=read(SRC); buildings={v['facilityId']:v for v in read('data/evidence/issue7/south-kanto/building-verification.json')}
ledger=read('data/work/issue7-baseline/ledger.json'); places={v['id']:v for v in ledger['places']}
assigned=read('data/work/issue7-baseline/assignments.json')['south-kanto']
actual=[v['facilityId'] for group in ['updates','unresolved'] for v in x[group]]
assert len(actual)==len(set(actual))==64
# Assignment representation is independently inspected rather than inferred from count.
if isinstance(assigned,dict): assigned=assigned.get('facilityIds',assigned.get('ids',assigned))
assert set(actual)==set(assigned)
protected={str(p):sha(p) for base in ['data/work/issue7-baseline','data/evidence/issue7/south-kanto','cmd/builddata','data/evidence/issue5/south-kanto'] for p in Path(base).rglob('*') if p.is_file()}
protected[SRC]=sha(SRC); protected['data/national/issue5/south-kanto.json']=sha('data/national/issue5/south-kanto.json')
save(D/'protected-before.json',protected)
for p,h in read('data/evidence/issue7/south-kanto/input-hashes.json').items(): assert sha(p)==h
for p,h in read('data/work/issue7-baseline/hashes.json').items(): assert sha(Path('data/work/issue7-baseline')/p)==h
refs={}
def check(s):
 p=s['snapshotPath']; h=sha(p); assert h==s['snapshotSHA256'],p
 refs[p]={'snapshotPath':p,'snapshotSHA256':h,'sourceUrl':s.get('sourceUrl',s.get('url'))}
 return refs[p]
# Check all supplied hashes, not merely the seven coordinate sources.
for filename in ['fetch-records.json','reused-source-index.json']:
 for s in read('data/evidence/issue7/south-kanto/'+filename):
  if s.get('snapshotPath'):check(s)
fields=['sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod']
code=Path('cmd/builddata/ledger.go').read_text()
struct=re.search(r'type Evidence struct \{.*?\n\}',code,re.S).group()
assert re.findall(r'json:"([^"]+)"',struct)==fields
extracted=[]; decisions=[]
reasons=[
 '区の配布案内は中央1丁目4番1号の本庁舎3階1番を明記。P05の江戸川区役所・中央1-4-1のPointと対応し、本庁舎の代表点として採用できる。',
 '協会アクセスのシリウス2階と、運営者の同一複合建物内の生涯学習センター、市の同住所一覧が対応する。P05生涯学習センターの点を同建物で共有でき、2階独自点は不要。',
 'CSVのID=131199000010は情報処理センター建物そのもの。区庁舎案内の同センター6階くらしと観光課に対応する。他部署の約13〜18m差は建物行の選択で個別解消し、平均しない。本館の点に置き換えない。',
 '固定入力の猫実1-1-1・市役所6階と市公式施設詳細の庁舎が対応する。現市施設詳細のq原値を優先する。旧道路整備課の継承を認定せず、既存relationのunknownとhoursをそのまま保持する。',
 '市配布案内の相模湖観光案内所と、個別LocalBusinessの同名称・与瀬1183（相模湖駅前）が対応する。施設固有Pointを建物代表点として採用できる。',
 '運営者と市配布案内は上宮田1450-4のセンターを指定し、DBの名称・住所・電話046-888-0588と対応する。上宮田1497の駅前案内所とは別施設であり共有しない。',
 '市配布案内と協会の駅構内・改札を出て左・ATM隣の案内所、DBの元町1-1・同名称・電話0467-82-3986が対応する。駅内の室内位置を精密測量する必要はない。'
]
for i,u in enumerate(x['updates']):
 fid=u['facilityId']; e=u['evidence']; check(e)
 assert set(e)==set(fields) and all(isinstance(e[k],str) and e[k] for k in fields)
 datetime.date.fromisoformat(e['checkedAt']); assert e['actorType']=='ai' and u['scope']=='building'
 b=buildings[fid]; sources=[check(s) for s in b['supportingSources']]
 p=Path(e['snapshotPath']); c=u['coordinate']; ex=b['extraction']
 if i<2:
  pref='13' if i==0 else '14'; idx=1642 if i==0 else 1159
  with zipfile.ZipFile(p) as z:
   with zipfile.ZipFile(io.BytesIO(z.read(f'P05-22_{pref}_GML.zip'))) as zz:g=json.loads(zz.read(f'P05-22_{pref}.geojson'))
  assert g['crs']['properties']['name']=='urn:ogc:def:crs:EPSG::6668'
  f=g['features'][idx]; assert f['geometry']['type']=='Point'
  assert f['geometry']['coordinates']==[c['lng'],c['lat']]
  raw={'featureIndex':idx,'feature':f,'crs':g['crs']}; axis='GeoJSON [longitude,latitude] -> lng/lat'; crs='JGD2011 EPSG:6668; untransformed'
  terms='P05: 保存利用規約のPDL1.0適用・出典表示・編集加工明記。元の座標系も保持。HTML等全体の一律再配布許諾とはしない。'
 elif i==2:
  rows=list(csv.DictReader(p.read_text(encoding='utf-8-sig').splitlines())); row=next(r for r in rows if r['ID']=='131199000010')
  assert row['名称']=='情報処理センター' and row['所在地_連結表記']=='東京都板橋区板橋2-65-6'
  assert [float(row['緯度']),float(row['経度'])]==[c['lat'],c['lng']]
  raw={'selectedRow':row,'sameAddressRows':[{k:r[k] for k in ['ID','名称','所在地_連結表記','緯度','経度']} for r in rows if '65-6' in r.get('所在地_連結表記','')]}
  axis='緯度 -> lat; 経度 -> lng'; crs='原典に測地系明記なし; untransformed'; terms='対象CSV掲載ページにCC BY 4.0。出典・ライセンスリンク・抽出加工表示を維持。施設紹介HTMLまでCC BYと扱わない。'
 elif i==3:
  pairs=re.findall(r'[?&]q=([0-9.]+),([0-9.]+)',html.unescape(p.read_text()))
  assert (str(c['lat']),str(c['lng'])) in pairs
  raw={'qPairs':pairs}; axis='q=latitude,longitude'; crs='原典に測地系明記なし; untransformed';terms='市自身がHTMLに記載した個別の数値事実。Google本体から抽出していない。HTML全文・画像・第三者地図の外部再公開を承認しない。'
 else:
  objs=[json.loads(t) for t in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>',p.read_text(),re.S)]
  obj=next(o for o in objs if o.get('@type')=='LocalBusiness'); assert obj['geo']['latitude']==c['lat'] and obj['geo']['longitude']==c['lng']
  raw={k:obj[k] for k in ['@type','name','address','telephone','geo']};axis='geo.latitude -> lat; geo.longitude -> lng';crs='原典に測地系明記なし; untransformed'
  terms='JAPAN47GOのaboutは文書等の無断転用・転載禁止と出版物等の事前連絡を記載。DB/API提供案内も確認。個別施設の座標2数値の事実利用とDB一括提供・原本全文の再公開は区別する。一般著作権記述のみでは当該点を保留しない。全文再公開や包括的法的許諾は認定しない。'
 extracted.append({'facilityId':fid,'source':check(e),'raw':raw,'axisOrder':axis,'coordinateSystem':crs,'numericMatch':True})
 decisions.append({'facilityId':fid,'name':places[fid]['name'],'decision':'accepted','coordinate':c,'scope':'building','reason':reasons[i],'evidence':e,'supportingSources':sources,'coordinateSystem':crs,'axisOrder':axis,'goEvidence':{'exactFields':fields,'resultReference':'data/evidence/issue7/review-south-kanto/go-validation.json'},'sourceUse':terms,'relationChanges':False})
# All supplied correction old values and basis hashes are independently checked.
corrections=[]
for c in x['corrections']:
 assert pointer(read(c['sourceFile']),c['path'])==c['old']; assert c['applied'] is False
 basis=c['basis'] if isinstance(c['basis'],list) else [c['basis']]
 for s in basis:check(s)
 corrections.append(dict(c,decision='accepted',oldMatches=True))
had='facility:kanto-south-281213c5dc294c44f2e5'
hadtext='市配布案内は秦野駅観光案内所を指定し、運営者は大秦町1-1 小田急マルシェ秦野1階・電話0463-80-2303を記載。JAPAN47GOも同名称・住所・電話と施設固有GeoCoordinatesを示す。「改札出て左」は階数を指定せず、1階表記との矛盾や移転を立証しない。建物代表点にはこの対応で十分であり、35.37028971/139.225494を追加候補として扱う。室内導線の精密な対応や一般的な転載規約だけを保留理由としない。'
for c in corrections:
 if c['facilityId']==had:c.update(decision='correction-required',proposedNew=c['new'],new=hadtext,reason='元案は相違未確認を座標保留に用いるが、名称・住所・電話が一致し、別棟・移転の積極的根拠は示されていない。')
additional=[]
for i,u in enumerate(x['unresolved']):
 fid=u['facilityId']
 for a in u['attempts']:
  if a.get('snapshotPath'):check(a)
 decisions.append({'facilityId':fid,'name':places[fid]['name'],'decision':'correction-required' if fid==had else 'deferred','reason':hadtext if fid==had else u['reason'],'reviewDepth':'targeted-source-review' if fid in [had,'facility:kanto-south-23883d07b60ef5d7bb0d','facility:kanto-south-integration-10'] else 'partition-and-hash-audit; original-unresolved-reason-retained; no-exhaustive-building-review','relationChanges':False})
 if fid==had:
  additional.append({'sourceFile':SRC,'path':f'/unresolved/{i}/reason','old':u['reason'],'new':hadtext,'applied':False,'reason':'階の矛盾・移転を認定せず、施設対応を評価する。'})
# Independently validate the concrete extra candidate required by the Hadano correction.
s=next(a for u in x['unresolved'] if u['facilityId']==had for a in u['attempts'] if '/a0fb6c4c-' in a['sourceUrl'])
obj=next(json.loads(t) for t in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>',Path(s['snapshotPath']).read_text(),re.S) if json.loads(t).get('@type')=='LocalBusiness')
assert obj['name']=='秦野駅観光案内所' and obj['telephone']=='0463-80-2303' and obj['geo']['latitude']==35.37028971 and obj['geo']['longitude']==139.225494
he={k:s[k] for k in ['sourceUrl','snapshotPath','snapshotSHA256']}
he.update(sourceLocator='script[type=application/ld+json] LocalBusiness=秦野駅観光案内所; 大秦町1-1; telephone=0463-80-2303; geo.latitude/geo.longitude。出典：日本観光振興協会 JAPAN47GO。2数値を抽出し変換なし。',checkedAt='2026-11-05',actorType='ai',verificationMethod='AIが市配布案内・運営者の大秦町1-1小田急マルシェ秦野1階とDBの名称・住所・電話を照合。建物代表点であり入口・室内の測量ではない。原典に測地系明記なし。原本全文の公開許諾は認定しない。')
hadu={'facilityId':had,'coordinate':{'lat':35.37028971,'lng':139.225494},'scope':'building','evidence':he}
save(D/'hadano-additional-candidate.json',hadu)
# Historical discrepancies: retain exact old/new for all six stale source descriptions.
oldb=read('data/evidence/issue5/south-kanto/building-verification.json'); oldu={u['facilityId']:u for u in read('data/national/issue5/south-kanto.json')['updates']}
stale=[]
for i,b in enumerate(oldb):
 fid=b['facilityId']
 if fid in oldu and 'P05' in oldu[fid]['evidence']['sourceLocator']:
  e=oldu[fid]['evidence']; assert 'JGD2011' in e['sourceLocator'] or 'JGD2011' in e['verificationMethod']
  stale.append(fid); additional.append({'sourceFile':'data/evidence/issue5/south-kanto/building-verification.json','path':f'/{i}/buildingIdentification','old':b['buildingIdentification'],'new':b['buildingIdentification'].split('。')[0]+'。同じIDのissue5 updatesのEvidenceには出典・JGD2011・抽出加工説明を追補済み。旧時点の追補待ちを現在の不足として扱わない。','applied':False})
assert len(stale)==6
findings=[{'id':'D1','kind':'documentation-code-mismatch','files':['data/evidence/issue5/south-kanto/validate.py','data/evidence/issue5/south-kanto/validation.json','data/evidence/issue5/south-kanto/README.md'],'finding':'旧validate.pyのchecksはJGD2011 CRS検証を列挙するが実装にCRS assertがない。コードに従い旧自動検証の範囲をFeature・数値一致までとする。issue7 validate.pyおよび本独立レビューはEPSG:6668を原ZIPでassertした。旧スクリプトは変更しない。'}, {'id':'D2','kind':'stale-documentation','facilityIds':stale,'finding':'issue5 building-verificationの6件は追補待ちを記載するが、issue5 updatesには出典・CRS・加工説明が存在する。新たな採用阻害要因ではない。exact old/newはadditionalCorrectionsに保存。'}, {'id':'R1','kind':'review-correction','facilityId':had,'finding':'「1階」と「改札出て左」は矛盾の証拠にならない。市・運営者・DBの施設対応は建物代表点には十分。元の7候補とは別に追加候補とEvidence7を保存し、旧理由訂正を修正する。'}]
# Correct the old automated check's inaccurate claim without modifying its source.
for file in ['data/evidence/issue5/south-kanto/validation.json']:
 doc=read(file)
 for i,v in enumerate(doc['checks']):
  if 'JGD2011 CRS' in v:additional.append({'sourceFile':file,'path':f'/checks/{i}','old':v,'new':'P05 original Feature values; CRS not asserted by this historical validate.py','applied':False})
additional.append({'sourceFile':'data/evidence/issue5/south-kanto/validate.py','locator':'report checks string literal','old':'P05 original Feature values and JGD2011 CRS','new':'P05 original Feature values; CRS not asserted by this historical validate.py','applied':False})
for c in additional:
 if 'path' in c:assert pointer(read(c['sourceFile']),c['path'])==c['old']
 else:assert c['old'] in Path(c['sourceFile']).read_text()
review={'schema':1,'checkedAt':'2026-11-05','actorType':'ai','input':{'path':SRC,'sha256':sha(SRC)},'scope':'独立レビュー。候補7件・訂正10件を詳細照合、割当64IDを全件列挙。その他残件の建物同定を全件深掘り完了したとは主張しない。','criteria':'配布施設の建物代表点で十分。入口・室内測量および全施設の改修なし証明は不要。既知の別棟・移転・競合のみ個別解消。','acceptedIds':[u['facilityId'] for u in x['updates']],'deferredIds':[d['facilityId'] for d in decisions if d['decision']=='deferred'],'correctionRequiredIds':[had],'summary':{'accepted':7,'deferred':56,'correction-required':1,'candidateUpdatesReviewed':7,'correctionsReviewed':10},'decisions':decisions,'corrections':corrections,'additionalCorrections':additional,'additionalCandidate':{'path':str(D/'hadano-additional-candidate.json'),'facilityId':had,'coordinateDecision':'accepted as building point','applicationDecision':'correction-required: revise unresolved classification and add candidate; not applied','axisOrder':'latitude/longitude named fields','coordinateSystem':'unspecified; untransformed','raw':{k:obj[k] for k in ['name','address','telephone','geo']}},'findings':findings,'preservedUrayasuRelations':[r for r in ledger['relations'] if r['placeId']=='facility:kanto-south-integration-legacy-urayasu'],'publication':'個別座標事実の利用判断と原本HTML全文・写真・DB一括の外部再公開は別。保存原本一括公開の許諾は認定しない。','limitations':['保存原本を基準にレビュー。現地確認・入口/室内測量ではない。','残件56件は原理由を保持し、全件深掘り・全出典網羅を主張しない。','manifest、元成果、既存ファイル、固定baseline、コード、配布状態には適用しない。']}
assert len(decisions)==64 and len({d['facilityId'] for d in decisions})==64
save(OUT,review);save(D/'numeric-checks.json',extracted);save(D/'source-hashes.json',list(refs.values()))
# Build a standalone Go probe using the actual Evidence and validateEvidence source verbatim.
func=re.search(r'func validateEvidence\(e Evidence\) error \{.*?\n\}',code,re.S).group()
probe='package main\nimport("bytes";"crypto/sha256";"encoding/hex";"encoding/json";"fmt";"net/url";"os";"strings";"time")\n'+struct+'\n'+func+'\nfunc hash(b []byte) string { s:=sha256.Sum256(b);return hex.EncodeToString(s[:]) }\nfunc main(){ b,err:=os.ReadFile("'+str(D/'evidence-input.json')+'");if err!=nil{panic(err)};var all []json.RawMessage;if err=json.Unmarshal(b,&all);err!=nil{panic(err)};for i,r:=range all{var e Evidence;d:=json.NewDecoder(bytes.NewReader(r));d.DisallowUnknownFields();if err=d.Decode(&e);err!=nil{panic(err)};if err=validateEvidence(e);err!=nil{panic(err)};fmt.Printf("%d passed\\n",i)} }\n'
(D/'evidence-probe.go').write_text(probe);save(D/'evidence-input.json',[u['evidence'] for u in x['updates']]+[he])
assert all(sha(p)==h for p,h in protected.items())
save(D/'validation.json',{'result':'passed','candidateNumericChecks':7,'additionalHadanoNumericCheck':1,'allIds':64,'hashedSources':len(refs),'correctionOldMatches':10,'additionalCorrectionOldMatches':len(additional),'protectedFilesUnchanged':len(protected),'goProbe':'pending execution','codeSHA256':sha('cmd/builddata/ledger.go'),'originalScriptsExecuted':False})
print(json.dumps({'summary':review['summary'],'sourcesHashed':len(refs),'protectedUnchanged':len(protected)},ensure_ascii=False))
