"""Offline packaging. Writes only the new issue5/chubu artifacts, never source inputs."""
from pathlib import Path
import json,hashlib,zipfile,io,datetime,copy,re
R=Path('data/evidence/issue5/chubu'); OUT=Path('data/national/issue5/chubu.json')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def dump(p,d):Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
ledger=read('data/work/issue5-baseline/ledger.json');full=read('data/work/issue5-baseline/full.json')
rels={}
for x in ledger['relations']:
 if 15<=int(x['cardId'][:2])<=23:rels.setdefault(x['placeId'],[]).append(x)
target={p['id']:p for p in ledger['places'] if p['id'] in rels and not p.get('coordinate')}
assert len(target)==138
inputs=['data/work/issue5-baseline/ledger.json','data/work/issue5-baseline/full.json','data/overrides/proposals/chubu.json','data/national/regions/chubu-east.json','data/national/regions/chubu-west.json']
old={};oldUpdates={};reviews={}
for suffix in ['chubu-east-north','chubu-east-south','chubu-west']:
 p=f'data/national/location-updates/{suffix}.json';inputs.append(p);d=read(p)
 for u in d['unresolved']:old[u['facilityId']]={'path':p,'record':u}
 for u in d['updates']:oldUpdates[u['facilityId']]={'path':p,'record':u}
for path,key in [('data/national/reviews/chubu-west-locations.json','reviews'),('data/national/reviews/facility-point-scope.json','results')]:
 inputs.append(path)
 for x in read(path)[key]:
  if x['facilityId'] in target:reviews[x['facilityId']]={'path':path,'record':x}
# Index actual historical retrieval metadata. No invented timestamps for inherited sources.
meta={}
def walk(x):
 if isinstance(x,dict):
  p=x.get('snapshotPath',x.get('path'));ts=x.get('fetchedAt',x.get('retrievedAt'))
  if p and ts:meta.setdefault(p,x)
  for y in x.values():walk(y)
 elif isinstance(x,list):
  for y in x:walk(y)
for p in Path('data/evidence/national').glob('**/*.json'):
 if p.stat().st_size<10000000:
  try:walk(read(p))
  except (ValueError,UnicodeError):pass
sources={};checks=[]
def preserve(e):
 p=e.get('snapshotPath');expected=e.get('snapshotSHA256')
 if not p or not Path(p).exists():return None
 actual=sha(p)
 if expected:assert actual==expected,(p,expected,actual)
 if p not in sources:
  original=meta.get(p,{})
  dest=R/'reused'/(actual+Path(p).suffix);dest.parent.mkdir(exist_ok=True)
  if not dest.exists():dest.write_bytes(Path(p).read_bytes())
  sources[p]={'sourceUrl':e.get('sourceUrl',original.get('url')), 'snapshotPath':str(dest),'snapshotSHA256':actual,'reusedFrom':p,'fetchedAt':original.get('fetchedAt',original.get('retrievedAt')),'retrievalTimeStatus':'recorded' if original.get('fetchedAt',original.get('retrievedAt')) else 'unknown-not-invented','checkedAt':'2026-11-05','actorType':'ai'}
 return sources[p]
def newev(key,locator):
 d=read(R/(key+'.source.json'));assert d.get('status')==200
 return {k:d[k] for k in ['sourceUrl','snapshotPath','snapshotSHA256','fetchedAt']}|{'sourceLocator':locator,'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'AIが取得した公式原本の施設名・住所・入居建物と配布窓口を照合。室内測量ではない。'}
zipmeta=read('data/evidence/national/official-facility-index/P05-22_GML.zip.source.json');zp=zipmeta['path'];assert sha(zp)==zipmeta['sha256'];z=zipfile.ZipFile(zp)
# Original national ZIP retained byte-for-byte (includes nested prefectural original ZIPs).
copyzip=R/'P05-22_GML.zip'
if not copyzip.exists():copyzip.write_bytes(Path(zp).read_bytes())
dump(R/'P05-22_GML.zip.source.json',zipmeta|{'path':str(copyzip),'reusedFrom':zp,'actorType':'ai','checkedAt':'2026-11-05'})
selected=[
 ('facility:chubu-east-0ec1549ca80513ef50b8',15,826,'tsubame-card','第5弾／平日・燕市役所2階20番窓口・吉田西太田1934'),
 ('facility:chubu-east-4af15accba6e0c303389',15,826,'tsubame-card','第5弾／土日祝・燕市役所1階夜間休日受付・吉田西太田1934'),
 ('facility:chubu-east-b0499212fbe7ed94fa2a',15,772,'murakami-card','荒川地区のマンホールカード／荒川地区公民館・羽ケ榎104-25'),
 ('facility:chubu-east-aeb7a0221c19b68a47dc',20,1529,'chikuma-card','Turkey!／上山田文化会館・上山田温泉三丁目1番地1'),
 ('facility:chubu-oyabe-water-counter',16,569,'oyabe-card','第17弾／年末年始を除く定休日の市役所上下水道課窓口・本町1番1号'),
 ('facility:chubu-west-5c2eca0bf60a3cf39536',22,437,'numazu-card','第1号／平日・本庁舎1階総合案内（水道部庁舎は別棟）'),
 ('facility:chubu-iwata-water-counter',22,825,'iwata-card','休館日の配布／磐田市福田400・福田支所2階'),
 ('facility:chubu-yoshida-water-counter',22,1837,'yoshida-card','しらすの窓口定休日／吉田町役場2階上下水道課・住吉87')
]
updates=[];records=[]
for fid,pr,i,key,loc in selected:
 assert fid in target
 nested=f'P05-22_{pr}_GML.zip';member=f'P05-22_{pr}.geojson';zz=zipfile.ZipFile(io.BytesIO(z.read(nested)));b=zz.read(member);d=json.loads(b);f=d['features'][i];assert '6668' in str(d['crs'])
 lng,lat=f['geometry']['coordinates'];assert f['geometry']['type']=='Point'
 locator=f'{nested}!{member}#/features/{i}'
 e={'sourceUrl':zipmeta['url'],'snapshotPath':str(copyzip),'snapshotSHA256':zipmeta['sha256'],'sourceLocator':locator+'; '+f['properties']['P05_003']+' / '+f['properties']['P05_004']+'; coordinates=[longitude,latitude]','checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'AIがP05-22原本GeoJSONの名称・住所付き建物Pointを現行公式配布案内の対象建物と照合。EPSG:6668/JGD2011の原数値をlat/lngへ順序変更し、座標変換はしていない。住所ジオコード・viewport・蓋座標ではない。室内窓口測量は不要。'}
 supporting=[newev(key,loc)]
 for k,ll in ({'murakami-card':[('arakawa-facility','荒川地区公民館所在地・施設紹介')],'chikuma-card':[('chikuma-facilities','上山田文化会館・上山田温泉3-1-1')],'numazu-card':[('numazu-office','市役所・御幸町16-1／庁舎案内')]}).get(key,[]):supporting.append(newev(k,ll))
 u={'facilityId':fid,'coordinate':{'lat':lat,'lng':lng},'scope':'building','evidence':e,'supportingEvidence':supporting,'datasetEvidence':{'publisher':'国土交通省','dataset':'国土数値情報 市町村役場等及び公的集会施設データ P05-22','referenceDate':'2022-04','originalCRS':'EPSG:6668 / JGD2011','originalAxisOrder':'longitude, latitude','processing':'原本featureの抽出とlat/lngへの順序組替え。座標変換なし。国がこの配布施設追補を作成したとの意味ではない。','memberSHA256':hashlib.sha256(b).hexdigest(),'license':'現行カタログ：適用する利用規約に基づく（オープンデータ）。現行規約：PDL1.0（2026-03-23施行）。旧資料のCC BY4.0記載のみで現行条件を説明しない。','catalogEvidence':newev('p05-catalog','座標系・使用許諾条件・主な品質情報'),'termsEvidence':newev('p05-terms','附則／出典・編集加工の記載'),'attribution':'出典：国土交通省「国土数値情報 市町村役場等及び公的集会施設データ」 https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-v3_0.html を加工して作成。'},'identityReview':{'name':target[fid]['name'],'address':target[fid]['address'],'datasetName':f['properties']['P05_003'],'datasetAddress':f['properties']['P05_004'],'finding':'現行公式が指定する配布先の入居建物と公的施設Pointの建物を照合。別棟・敷地全体への横展開なし。','relocation':'取得した現行配布案内に当該建物からの移転表示なし。将来移転や同住所建替え不存在の保証ではない。','limits':'2022年基準の代表点。室内・入口・センチメートル精度を主張しない。'}}
 # Name/address assertions audited below, not score-based automatic adoption.
 updates.append(u);records.append({'facilityId':fid,'locator':locator,'rawFeature':f,'memberSHA256':hashlib.sha256(b).hexdigest(),'crs':d['crs']})
# Preserve old reasons; latest independent review takes precedence over older proposal claims.
unresolved=[];classification=[];adopted={u['facilityId'] for u in updates}
for fid,p in target.items():
 ev=preserve(p['evidence']);rr=reviews.get(fid);oo=old.get(fid);prev=[]
 for rel in rels[fid]:
  if rel.get('evidence'):preserve(rel['evidence'])
 if rr:
  row=rr['record'];reason=row.get('reason',row.get('buildingScope',{}).get('reason',''));prev.append(rr)
  for ee in row.get('sourcesRead',[]):preserve(ee)
  if row.get('primaryEvidence'):preserve(row['primaryEvidence'])
 if oo:
  prev.append(oo)
  if not rr:reason=oo['record']['reason']
 if not rr and not oo:reason='追加proposal施設または旧追補に未解決行のない施設。配布原典は保持したが、現行の対象建物を指す再利用条件・測地系付き座標原典との照合が未完了。旧施設の点や名称・住所だけで補完しない。'
 if fid in adopted:status='candidate-update'
 else:
  status='unresolved'
  nextsource={'url':p['evidence']['sourceUrl'],'required':'現行配布先建物の施設詳細・棟別GISまたはオープンデータ（明示座標・測地系・利用条件）。旧失敗URLの単純再試行ではなく関連施設ページ/別公的原典を優先。'}
  unresolved.append({'facilityId':fid,'reason':reason,'nextSource':nextsource,'cardIds':[r['cardId'] for r in rels[fid]],'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'固定ledgerの所属relationsと旧地域追補・独立レビューを再分類。旧原本は再利用であり今回全URLを再取得したという意味ではない。','distributionEvidence':p['evidence'],'priorResearch':prev,'reusedSnapshot':ev})
 classification.append({'facilityId':fid,'name':p['name'],'cardIds':[r['cardId'] for r in rels[fid]],'prefectureCodes':sorted({r['cardId'][:2] for r in rels[fid]}),'classification':status,'priorReview':rr['record'].get('decision',rr['record'].get('status')) if rr else None,'hasPriorUnresolved':bool(oo),'fromProposal':any(x['id']==fid for x in read('data/overrides/proposals/chubu.json')['places'])})
corrections=[]
for fid,rr in reviews.items():
 row=rr['record']
 if row.get('decision')=='correction-required' or fid in ['facility:chubu-east-23bfc837f9708f3a5bff','facility:chubu-east-3309d6639e95492f62ff','facility:chubu-east-dade89399c684a92a0fa']:
  oldrow=oldUpdates.get(fid)
  if not oldrow:continue
  olde=oldrow['record']['evidence'];newe=copy.deepcopy(olde);newe['verificationMethod']='旧採用説明を撤回。'+row['reason']+' 座標は未承認。'
  newe['sourceLocator']=olde['sourceLocator']+'（数値の存在だけでは配布建物の同一性を証明しない）'
  corrections.append({'facilityId':fid,'targetFile':oldrow['path'],'selector':{'facilityId':fid,'field':'evidence'},'old':olde,'new':newe,'reason':row['reason'],'evidence':[{'snapshotPath':rr['path'],'snapshotSHA256':sha(rr['path'])}],'coordinateAction':'旧候補は採用しない。新updatesがある場合のみ独立した原典による別候補として親レビュー。'})
  corrections[-1]['evidence']+=row.get('sourcesRead',[])
  if row.get('primaryEvidence'):corrections[-1]['evidence'].append(row['primaryEvidence'])
  if '佐渡市役所' in row.get('name',''):
   corrections[-1]['evidence'] += [newev('sado-offices','金井市民センター／第2庁舎1階'),newev('sado-new-office','市報さど2023年11月号p.2／2023-11-06開庁・現庁舎となり')]
# Stronger contemporaneous evidence for Sado: 2023 opening is later than P05 2022.
for u in unresolved:
 if u['facilityId'] in ['facility:chubu-east-23bfc837f9708f3a5bff','facility:chubu-east-3309d6639e95492f62ff']:
  u['reason']+=' 今回取得の市報2023年11月号p.2は防災拠点庁舎が2023-11-06開庁、千種232の現庁舎となりと明記。P05-22の同番地Pointを現在の本庁舎に置き換えることも不可。'
  u['supportingEvidence']=[newev('sado-offices','金井市民センター／第2庁舎1階／0259-63-3843'),newev('sado-new-office','市報さど令和5年11月号p.2／11月6日開庁／現庁舎となり')]
  u['nextSource']={'url':'https://www.city.sado.niigata.jp/soshiki/2028/55002.html','required':'2023年新庁舎と旧庁舎の棟別地物ID・座標を示す現行公式GIS。総合案内・宿日直室の入居先照合。'}
# Archive source specification and provenance, with original timestamps only.
for name in ['p05-spec.pdf','p05.html','p05-license.html','gsi-mapsheet-faq.html']:
 p='data/evidence/national/official-facility-index/'+name
 md=read(p+'.source.json');preserve({'snapshotPath':p,'snapshotSHA256':md['sha256'],'sourceUrl':md['url']})
inputs+=['data/evidence/national/official-facility-index/README.md','data/national/location-updates/official-facility-index.json']
# Re-extract existing P05 leads without promoting their ranking to building approval.
p05leads={}
for c in read('data/national/location-updates/official-facility-index.json')['candidates']:
 if c['facilityId'] not in target:continue
 dp=c['datasetPoint'];nested,loc=dp['locator'].split('!');member,idx=loc.split('#/features/')
 zz=zipfile.ZipFile(io.BytesIO(z.read(nested)));b=zz.read(member);f=json.loads(b)['features'][int(idx)]
 assert hashlib.sha256(b).hexdigest()==dp['memberSHA256'] and f==dp['rawFeature']
 p05leads.setdefault(c['facilityId'],[]).append(dp)
for u in unresolved:
 if u['facilityId'] in p05leads:
  u['additionalCoordinateLeads']=p05leads[u['facilityId']]
  u['leadDisposition']='P05原本の数値・レコードhashは照合済み。これは旧保留理由を解消したという意味ではない。現行建物同定、移転・複数棟・競合の追加確認が必要。'
  u['nextSource']['coordinateDataset']='国交省P05-22（原本とCRS・利用条件を今回保全済み）。上記候補の建物と現行配布先の一致を施設別に確認する。'
dump(R/'p05-additional-leads.json',p05leads)
result={'schema':1,'region':'chubu','updates':updates,'unresolved':unresolved,'corrections':corrections,'checkedAt':'2026-11-05','actorType':'ai','targetDefinition':'固定ledger座標なしplacesかつrelations.cardId都道府県コード15〜23。追加proposalでledger採用済みの施設を含む。','researchStatus':'全対象分類済み。重点原典の再取得・再照合を完了。全施設の座標確定または全URL再取得ではない。','counts':{'targets':len(target),'updates':len(updates),'unresolved':len(unresolved),'corrections':len(corrections)},'documentationCodeDiscrepancies':[]}
dump(OUT,result);dump(R/'classification.json',classification);dump(R/'p05-records.json',records);dump(R/'reused-sources.json',list(sources.values()));dump(R/'input-hashes.json',[{'path':p,'sha256':sha(p)} for p in inputs]);print(result['counts'])
