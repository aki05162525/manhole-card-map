import json, pathlib, hashlib, re, zipfile, io, html, math
R=pathlib.Path('.')
D=R/'data/evidence/issue7/review-tokai'
def read(p): return json.loads(pathlib.Path(p).read_text())
def sha(p): return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def save(p,x): pathlib.Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
src='data/national/issue7/tokai.json'; x=read(src)
support=read('data/evidence/issue7/tokai/supporting-evidence.json')
fields=re.findall(r'json:"([^"]+)"',pathlib.Path('cmd/builddata/ledger.go').read_text().split('type Evidence struct {')[1].split('}')[0])
assert len(fields)==7
assigned=read('data/work/issue7-baseline/assignments.json')['tokai']
assert len(x['updates'])==17 and len(x['corrections'])==9
ids=[u['facilityId'] for u in x['updates']+x['unresolved']]
assert len(ids)==len(set(ids))==52 and set(ids)==set(assigned)
protected=read('data/evidence/issue7/tokai/input-hashes.json')
for p,h in protected.items(): assert sha(p)==h,p
for p,h in read('data/work/issue7-baseline/hashes.json').items(): assert sha('data/work/issue7-baseline/'+p)==h,p
hashes={}
def walk(o):
 if isinstance(o,dict):
  if 'snapshotPath' in o and 'snapshotSHA256' in o:
   p=o['snapshotPath'];h=sha(p);assert h==o['snapshotSHA256'],p;hashes[p]=h
  for v in o.values():walk(v)
 elif isinstance(o,list):
  for v in o:walk(v)
walk(x);walk(support);walk(read('data/evidence/issue7/tokai/rights-review.json'))
for p,h in read('data/evidence/issue7/tokai/referenced-snapshot-hashes.json').items():assert sha(p)==h,p;hashes[p]=h
z=zipfile.ZipFile('data/evidence/issue5/chubu/P05-22_GML.zip')
raws={r['facilityId']:r for r in read('data/evidence/issue7/tokai/p05-records.json')}
checks=[]
for u in x['updates']:
 id=u['facilityId']; e=u['evidence'];c=u['coordinate']
 assert set(e)==set(fields) and all(e.values()) and e['actorType']=='ai' and u['scope']=='building'
 n={'facilityId':id,'coordinate':c,'snapshotPath':e['snapshotPath'],'snapshotSHA256':sha(e['snapshotPath']),'evidenceFieldsMatchGo':True}
 if id in raws:
  r=raws[id];a,b=r['locator'].split('!');member,idx=b.split('#/features/');idx=int(idx)
  zz=zipfile.ZipFile(io.BytesIO(z.read(a)));raw=zz.read(member);j=json.loads(raw);f=j['features'][idx]
  assert f==r['rawFeature'] and hashlib.sha256(raw).hexdigest()==r['memberSHA256'] and j['crs']==r['crs']
  assert c==dict(zip(['lng','lat'],f['geometry']['coordinates']))
  xml=zz.read(member.replace('.geojson','.xml')).decode()
  rec=re.search(r'<ksj:LocalGovernmentOfficeAndPublicMeetingFacility gml:id="P05_'+str(idx)+r'">(.*?)</ksj:LocalGovernmentOfficeAndPublicMeetingFacility>',xml,re.S)[1]
  pt=re.search(r'xlink:href="#([^"]+)"',rec)[1]
  pos=re.search(r'<gml:Point gml:id="'+pt+r'">\s*<gml:pos>([^<]+)',xml)[1]
  glat,glng=map(float,pos.split());assert abs(glat-c['lat'])<1e-7 and abs(glng-c['lng'])<1e-7
  assert f['properties']['P05_003'] in rec and f['properties']['P05_004'] in rec
  n.update(rawFeature=f,crs=j['crs'],sourceAxisOrder='GeoJSON longitude,latitude; GML latitude,longitude',transformation='axis reordering only; no WGS84 transformation',memberSHA256=r['memberSHA256'],locator=r['locator'],gmlPosition=pos,gmlPoint=pt,gmlWithin1e7Degree=True)
 else:
  t=pathlib.Path(e['snapshotPath']).read_text()
  if 'nakabashi' in id:
   m=re.search(r'var gConf\s*=\s*\{lat:([\d.]+),lng:([\d.]+)',t);assert c==dict(zip(['lat','lng'],map(float,m.groups()))) and 'q='+m[1]+','+m[2] in t
   n['rawNumbers']=list(m.groups());n['sourceAxisOrder']='gConf lat,lng; iframe q latitude,longitude'
  elif '8b10b99e9d58aaa58550' in id:
   def marker(t):
    m=re.search(r"label: '4',\s*name: (\".*?\"),\s*lat: Number\('([\d.]+)'\),\s*lng: Number\('([\d.]+)'\)",t)
    assert json.loads(m[1])=='飛騨古川まちなか観光案内所'
    return {'lat':float(m[2]),'lng':float(m[3])}
   assert marker(t)==c
   assert marker(pathlib.Path('data/evidence/national/locations-chubu-west/ab548fdcccd6faf9a5538375.html').read_text())==c
   n['oldAndNewMarkerMatch']=True;n['rawNumbers']=[str(c['lat']),str(c['lng'])];n['sourceAxisOrder']='explicit lat/lng properties'
  else:
   row=next(row for row in re.findall(r'<tr.*?</tr>',t,re.S) if '0000000030' in row)
   cells=[html.unescape(re.sub('<[^>]+>','',v)).strip() for v in re.findall(r'<td[^>]*>(.*?)</td>',row,re.S)]
   assert cells[3]=='水道部庁舎' and cells[8]=='静岡県沼津市御幸町2-20'
   assert c=={'lat':float(cells[14]),'lng':float(cells[15])}
   n['rawRow']=cells;n['sourceAxisOrder']='table 緯度 then 経度'
  n.update(crs='not explicitly stated in source',transformation='none; published web-map latitude/longitude, not a survey or claimed WGS84 conversion')
 checks.append(n)
corrections=[]
for i,c in enumerate(x['corrections'],1):
 p=c['targetPath']
 if c.get('textReplacement'):
  assert pathlib.Path(p).read_text().count(c['old'])==1
 else:
  v=read(p)
  if 'jsonPointer' in c:
   for token in c['jsonPointer'].strip('/').split('/'):v=v[int(token)] if isinstance(v,list) else v[token]
  else:v=next(v for v in v['places'] if v['id']==c['facilityId'])[c['selector']['field']]
  assert v==c['old'],p
 corrections.append(dict(c,reviewOperationId='tokai-correction-'+str(i),status='accepted',oldValueVerified=True,applied=False,reviewReason=('水道部庁舎の名称・電話とAED住所2-20が一致。本庁16-1を訂正。固定入力への適用は禁止。' if i>=8 else '旧原本にも名称付きmarkerが存在する。' if i in [5,6] else '元proposalは寄って宮休業時の臨時配布。庁舎移転を示さない。')))
reasons=[
'現行配布案内の福田400・福田支所2階とP05福田支所が一致。休館日代替という配布関係は座標承認と別。',
'市原本が上下水道課を太田町1900の分庁舎と明示。P05も分庁舎であり本庁の点の流用ではない。',
'施設個別ページの本町1-2、中橋観光案内所とid4827が対応。iframe place目的地qとgConfが同値。一般規約は開放許諾ではなく、採用判断は単独座標事実に限る。',
'市施設原本が市民センターを穂積公民館・体育館の複合施設と明示。配布住所別府1300-3とP05穂積公民館が一致。建物代表点として合理的であり1階内部測量は要求しない。',
'観光協会原本が相生町1-1-6産業振興センター1Fと明示。P05収容建物点を採用。観光目的地34.99063742782774,137.01125979423523との約31m差は保持するが、目的地側の建物内位置は不明であり建物内位置検査対象のP05を優先する。',
'町の配布案内・役場所在地六之井1468-1とP05池田町役場が一致。別棟移転を示す証拠は今回の原本にない。',
'配布案内の水道部1階守衛室とAED ID30の水道部庁舎を名称・電話934-4851で対応付け。AED1階自動ドア前の公開点は建物代表として十分。統合コピーの住所2-20訂正を必須とする。',
'配布案内の本庁1階総合案内と御幸町16-1市役所P05点が対応。階図は別館と総合案内を区別し、本庁AED点も近傍。2-20の水道部とは別建物。',
'元22-207-C001 proposalは寄って宮休業時の臨時配布。現行逆さ富士案内の当直室は弓沢町150の市役所。庁舎移転という旧保留理由は撤回可能。',
'旧・新モデルコース73のlabel4はまちなか観光案内所の名称と同一数値を持つ。市原本壱之町8-3と一致し駅横金森町8-32とは異なる。',
'市原本の宮田300番地2・巣南庁舎下水道課とP05 880が一致。879との約4m差は同住所同建物名称の重複で建物代表精度で競合しない。880を保持し平均しない。',
'町配布案内の納米里549ウエルピアと公開施設情報の健康づくりセンターが対応し、P05同名同住所を採用。役場とは区別。',
'市配布原本は永田町1丁目100番地の北口守衛室。市1階図の北口に警備員室（夜間休日受付）があることを独立目視。P05富士市役所の建物代表点でよく県総合庁舎と混同しない。',
'市下水道課原本は弓沢町150、市役所5階。現行配布案内とも一致。臨時配布proposalを庁舎移転と読んだ旧理由は採用しない。',
'配布原本の長泉町役場・中土狩828・電話055-989-5524と連絡先原本の上下水道課本館2階が対応。P05役場を本館代表として採用。',
'市原本は水道部庁舎2階水道総務課、電話一覧は同課庶務係934-4851。AEDの同電話・建物名・2-20で対応。1階点を2階窓口の精密点とはしない。統合コピーの住所訂正必須。',
'町配布原本はしらすの窓口定休日の吉田町役場2階上下水道課、住吉87。P05同名同住所と一致。代替配布条件は変更しない。'
]
entries=[]
for u,n,s,reason in zip(x['updates'],checks,support,reasons):
 assert u['facilityId']==s['facilityId']
 entries.append({'facilityId':u['facilityId'],'status':'accepted','coordinateDecision':'accepted','scope':'building','coordinate':u['coordinate'],'reason':reason,'evidence':u['evidence'],'verification':n,'identitySources':[{'snapshotPath':r['snapshotPath'],'snapshotSHA256':r['snapshotSHA256'],'sourceUrl':r['url']} for r in s['newSources'] if 'snapshotPath' in r], 'requiredCorrectionIds':[c['reviewOperationId'] for c in corrections if c.get('facilityId')==u['facilityId']]})
for u in x['unresolved']:
 entries.append({'facilityId':u['facilityId'],'status':'deferred','reviewDepth':'classification-only; no independent exhaustive investigation','reason':'今回の独立深掘り対象は17候補。残件は候補未成立として保留を維持。以下は提出者の記録であり調査完了の認定ではない。','submittedReason':u['reason'],'nextSource':u.get('nextSource')})
rights=read('data/evidence/issue7/tokai/rights-review.json')
rights['independentReview']={'P05':'個別カタログの使用許諾は適用規約に基づくオープンデータ。一般規約は個別条件の優先を明記。商用利用禁止文はHTMLコメント内であり現行表示の個別条件として採用しない。出典、抽出・施設対応・軸順加工、国の制作物でない旨を維持。仕様書の建物外周内検査を建物点選択根拠とするが個別測量済みとはしない。','numazuAED':'個別データセットの市利用規約リンクとPDF4節のCC BY4.0を確認。対象行に追加制限なし。市名、題名、ライセンス、加工内容の表示を維持。','nakabashi':'一般規約に広い無許諾利用禁止があることを確認。オープンライセンス、許諾取得済み、規約無効とは判断しない。このレビューは公表された当該施設の座標事実1組を採用可能とする限定的判断。文章・写真・HTML全体の公開再配布を承認しない。','hidaFurukawa':'名称付き単独markerの座標事実の採用。一般ポリシーからオープンライセンスを推定しない。','snapshotPublication':'監査用保全と一般公開再配布は別。原本HTML全体の公開再配布許諾はこのレビューの対象外であり承認していない。'}
result={'schema':1,'reviewedAt':'2026-11-05','actorType':'ai','reviewType':'independent','input':{'path':src,'sha256':sha(src)},'criteria':'現施設と原典建物の合理的対応、建物代表点。入口・室内測量、2022以後改修なしの一律証明は不要。既知移転・別棟・座標競合は個別評価。','summary':{'candidateCount':17,'accepted':17,'deferred':35,'correctionRequired':0,'acceptedCorrectionOperations':9},'acceptedFacilityIds':[u['facilityId'] for u in x['updates']],'decisions':entries,'corrections':corrections,'integrationRequirements':['9訂正を親の統合先へ適用。固定baselineは変更禁止。','沼津2窓口は座標acceptedだが住所2-20訂正を統合の必須条件とする。','座標承認は配布状態やrelationsの新規承認・変更を意味しない。','原本HTML全体の公開再配布はこの採否から許諾済みと扱わない。'],'documentationCodeDiscrepancies':[],'sourceRecordDiscrepancies':['富士宮の臨時配布を庁舎移転とした旧理由4か所と旧README1か所。','飛騨古川markerなしとした旧理由2か所。','沼津水道部2施設の台帳住所16-1とAED建物住所2-20。'],'limitations':['残35件は一意ID分類と提出保留理由を確認したのみ。全件深掘り済みとはしない。','保存原本を再読した独立レビュー。今回の新規ネットワーク取得・現地確認なし。','HTML/AED数値のCRSは原本で明記されず、測量精度とWGS84変換を主張しない。'],'rightsReviewPath':str(D/'rights-review.json'),'validationPath':str(D/'validation.json')}
save(D/'rights-review.json',rights)
save(D/'snapshot-hashes.json',hashes)
save('data/national/issue7/reviews/tokai.json',result)
save(D/'validation.json',{'success':True,'assignedIds':52,'candidatesChecked':17,'p05GeojsonAndGmlChecked':13,'htmlCoordinatesChecked':4,'exactCorrectionsChecked':9,'sourceHashesChecked':len(hashes),'goEvidenceFields':fields,'protectedInputHashesMatch':True,'coordinateChecks':checks,'documentationCodeDiscrepancies':[]})
print(json.dumps(result['summary']), 'hashes',len(hashes))
