import json,hashlib,zipfile,re,copy,datetime
from pathlib import Path
D=Path('data/evidence/issue5/south-kanto'); OUT=Path('data/national/issue5/south-kanto.json')
def read(p):return json.loads(Path(p).read_text())
def write(p,x):Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
L=read('data/work/issue5-baseline/ledger.json'); full=read('data/work/issue5-baseline/full.json')
relations={}
for r in L['relations']:
 if r['cardId'][:2] in ['00','12','13','14']:relations.setdefault(r['placeId'],[]).append(r)
T={p['id']:p for p in L['places'] if p['id'] in relations and not p.get('coordinate')}
P={p['id']:p for p in L['places']}
review=read('data/national/reviews/facility-point-scope.json'); rv={r['facilityId']:r for r in review['results']}
old={}; old_updates={}
for part in ['tokyo','kanagawa','chiba']:
 f=f'data/national/location-updates/kanto-south-{part}.json'; d=read(f)
 for u in d['unresolved']:old[u['facilityId']]={**u,'reviewPath':f}
 for i,u in enumerate(d['updates']):old_updates[u['facilityId']]={**u,'reviewPath':f,'updateIndex':i}
# Original retrieval times are inherited only from recorded metadata, never mtime.
manifest_records=[]
for f in Path('data/evidence/national').rglob('*manifest*.json'):
 try:d=read(f)
 except Exception:continue
 def walk(x):
  if isinstance(x,dict):
   if x.get('snapshotPath') and (x.get('fetchedAt') or x.get('retrievedAt')):manifest_records.append((str(f),x))
   for v in x.values():walk(v)
  elif isinstance(x,list):
   for v in x:walk(v)
 walk(d)
refs={}
def register(e):
 if not isinstance(e,dict):return
 p=e.get('snapshotPath')
 if not p:return
 p=str(Path(p).relative_to(Path.cwd())) if Path(p).is_absolute() else p
 if p in refs:return
 h=sha(p); expected=e.get('snapshotSHA256',e.get('sha256'))
 if expected:assert h==expected,(p,h,expected)
 matches=[(f,r) for f,r in manifest_records if r['snapshotPath']==p]
 x={'sourceUrl':e.get('sourceUrl',e.get('url')),'snapshotPath':p,'snapshotSHA256':h,'checkedAt':'2026-11-05','actorType':'ai'}
 if matches:
  f,r=matches[0];x.update(fetchedAt=r.get('fetchedAt',r.get('retrievedAt')),retrievalRecord=f)
  if r.get('timestampNote'):x['timestampNote']=r['timestampNote']
 else:x.update(fetchedAt=None,timestampNote='原取得時刻に対応する保存取得記録未確認。mtimeから推定しない。')
 refs[p]=x
updates=[]; corrections=[]; readings=[]
# Six P05 building records: preserve original JGD2011 values and explicit attribution.
zpath='data/evidence/national/kanto-south-locations-kanagawa/202bb7bb6256b7f5b65e.zip'
with zipfile.ZipFile(zpath) as z:g= json.loads(z.read('P05-22_14.geojson'))
assert '6668' in str(g['crs'])
features=[]
for c in review['evidenceCorrections']:
 fid=c['facilityId']
 if fid not in T or fid not in rv or rv[fid]['status']!='correction-required':continue
 u=old_updates[fid]; e=copy.deepcopy(c['new']); coord=u['coordinate']
 fs=[(i,f) for i,f in enumerate(g['features']) if f['geometry']['coordinates']==[coord['lng'],coord['lat']]]
 assert len(fs)==1
 i,f=fs[0];features.append({'facilityId':fid,'featureIndex':i,'feature':f,'crs':g['crs']})
 updates.append({'facilityId':fid,'coordinate':coord,'scope':'building','evidence':e})
 corrections.append({'facilityId':fid,'sourceFile':u['reviewPath'],'path':f"/updates/{u['updateIndex']}",'old':{k:v for k,v in u.items() if k not in ['reviewPath','updateIndex']},'new':updates[-1],'reason':rv[fid]['reason'],'evidence':rv[fid]['sourcesRead']})
 for s in rv[fid]['sourcesRead']:register(s)
 readings.append({'facilityId':fid,'buildingIdentification':rv[fid]['reason'],'coordinateOriginal':f['geometry']['coordinates'],'coordinateSystem':'EPSG:6668 (JGD2011), no transformation','sourceLocator':f'P05-22_14.geojson features[{i}]','license':'国土数値情報現行PDL1.0。出典・加工明記。','sources':rv[fid]['sourcesRead']})
# Same-building transfers explicitly supported by primary descriptions.
transfers=[('facility:kanto-south-integration-urayasu-chisui','facility:kanto-south-11b09628dba123927a22','市公式配布原本は治水課を市役所6階・猫実1-1-1と明記。施設原本の市役所目的地qと同じ市役所建物。旧道路整備課の現配布状態は承認しない。'),('facility:kanto-south-integration-12','facility:kanto-south-cb4883502585afce7159','市公式配布原本は綾瀬市役所5階を指定。早川550番地の市役所CSV行に対応。2026-11-24からの予定窓口であり、現在配布中への変更ではない。'),('facility:kanto-south-d39f7191733284005f01','facility:kanto-south-bcb38ab8fb7efae35fc4','観光協会accessは101号室と105号室をともに三鷹駅前協同ビルと明記し、両施設が入るビルの共通駐輪場も説明。観光案内所の建物代表点をBASEへ共有。室内窓口点ではない。')]
mitaka={'sourceUrl':'https://kanko.mitaka.ne.jp/about/accsess.html','snapshotPath':'data/evidence/national/kanto-south-locations-tokyo/53cb5b3c54ec417d7cf5.html'}
for fid,ref,reason in transfers:
 e=copy.deepcopy(P[ref]['evidence']);e['sourceLocator']+=' '+reason;e['verificationMethod']='AIが保存原本の配布窓口・建物名称・所在地と座標原典を再照合。'+reason
 updates.append({'facilityId':fid,'coordinate':P[ref]['coordinate'],'scope':'building','evidence':e});register(e)
 sources=[T[fid]['evidence']]+[r['evidence'] for r in relations[fid]]+[P[ref]['evidence']]
 if 'd39f719' in fid:sources.append(mitaka)
 for s in sources:register(s)
 readings.append({'facilityId':fid,'buildingIdentification':reason,'coordinateOriginal':P[ref]['coordinate'],'sources':sources,'coordinateSystem':'原典のlat/lng（明示測地系なし）。変換していない。','license':'既存採用済み公式施設原典の最小座標値を再利用。原本HTMLの一般転載許諾を主張しない。'})
 if fid in old:corrections.append({'facilityId':fid,'sourceFile':old[fid]['reviewPath'],'path':'/unresolved[facilityId='+fid+']/reason','old':old[fid]['reason'],'new':reason,'reason':'建物代表点で十分という今回基準と、原本の同一建物明記に基づく再判定。','evidence':sources})
accepted={u['facilityId'] for u in updates}
extra={
 'integration-01':'新窓口は上下水道局1階。局庁舎の建物固有座標原典を未確認。',
 'integration-02':'宿直対応は上下水道局庁舎内。旧萱田町事務所座標を転用しない。局庁舎の建物固有座標原典が必要。',
 'integration-05':'南庁舎1階。旧レビューの市役所全体点では南庁舎を区別できず、守衛室と共通の棟別根拠不足。',
 'integration-06':'情報処理センター6階。区役所本庁舎の点と区別した同センター建物の公開数値原典が未確認。',
 'integration-08':'ヴェルニー公園管理事務所。公園全体やティボディエ邸を事務所棟へ転用しない。',
 'integration-09':'本庁舎3階広報課。公式本庁舎の数値原典の追加照合が残る。別館等の点を転用しない。',
 'integration-10':'三浦海岸駅改札前の追加案内所。上宮田1450-4の観光インフォメーションセンターとの同一建物を未確認。',
 'integration-11':'第二駐車場南側のイベント窓口。文化会館本館位置を配布建物位置として使えない。建物として扱えるかも要確認。',
 'integration-adachi-tourism-association':'観光交流協会の現行窓口は確認済みだが、旧産業振興課との関係継承は不明。対象入居建物の公開座標原典との照合が残る。',
 'integration-legacy-urayasu':'旧道路整備課は現配布継承不明。現行治水課の座標を旧窓口の現配布確認として適用しない。',
 'integration-legacy-yachiyo-0':'旧給排水相談課窓口は現配布継承不明。お客様センターへの単純改称を推定しない。',
 'integration-legacy-yachiyo-1':'旧萱田町事務所の配布関係はended。現局庁舎へ旧施設の座標を上書きしない。'}
unresolved=[]
for fid,p in T.items():
 register(p['evidence'])
 for r in relations[fid]:register(r['evidence'])
 if fid in accepted:continue
 reason=rv[fid]['reason'] if fid in rv else old.get(fid,{}).get('reason')
 if not reason:reason=extra[fid.removeprefix('facility:kanto-south-')]
 sources=[p['evidence']]+[r['evidence'] for r in relations[fid]]
 if fid in rv:sources+=rv[fid]['sourcesRead']
 if fid in old:
  for a in old[fid].get('attempts',[]):
   if a.get('snapshotPath'):sources.append(a)
 for s in sources:register(s)
 unresolved.append({'facilityId':fid,'name':p['name'],'cardIds':[r['cardId'] for r in relations[fid]],'reason':reason,'nextSource':{'sourceUrl':relations[fid][0]['evidence']['sourceUrl'],'required':'現配布窓口の入居建物と対応する自治体・施設運営者の建物固有Point/座標原典。旧保留の別棟・利用条件・移転問題を解消する資料。'},'priorReviewPath':('data/national/reviews/facility-point-scope.json' if fid in rv else old.get(fid,{}).get('reviewPath','data/evidence/national/kanto-south-integration/README.md')),'evidence':p['evidence'],'sourcesReused':sources,'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'固定台帳と旧個別レビュー・根拠hashを再確認。保留理由を維持。新たに全URLを再取得したものではない。'})
# Yokohama building identity and marker now established; permission remains unresolved.
fetched=read(D/'fetch-records.json')
for r in fetched:
 p=Path(r['snapshotPath']);r['snapshotPath']=str(p.relative_to(Path.cwd())) if p.is_absolute() else str(p)
 refs[r['snapshotPath']]={**r,'checkedAt':'2026-11-05','actorType':'ai'}
y=next(u for u in unresolved if '4ecb948' in u['facilityId'])
y['reason']='現配布先は市公式本文とJR側原本でJR横浜タワー2階アトリウムと確認。運営者が埋め込むJR横浜タワー固有featureから35.4667112,139.622346を取得。建物同定は解消したが、運営者の複製・転載等禁止とGoogle由来点の抽出再利用条件を解消しておらず公開採用は保留。307原本や旧高島JAPAN47GOを根拠にしない。'
y['coordinateCandidate']={'lat':35.4667112,'lng':139.622346}
y['nextSource']={'sourceUrl':'https://www.city.yokohama.lg.jp/','required':'JR横浜タワーまたは現観光案内所のオープンデータ建物点、または取得済み原典の再利用・原本公開条件の確認。'}
y['newSources']=fetched
y['sourceLocator']='9dd88c43dcc7b0d888c7f3c2.raw initEmbed selected entity 0x60185df37260a54f:0xe8c02dbd33b79558 / JR横浜タワー / 南幸１丁目１−１ / [35.4667112,139.622346]。URL pb viewport 139.62015731522243 は不採用。'
y['verificationMethod']='AIが市配布原本、JR施設本文、運営者iframe参照、取得先entityの名称住所と座標配列を突合。WGS84との明示は原本にない。座標変換なし。アットヨコハマの案内所点35.466635,139.622393は約10m差、室内窓口と建物代表点の差として記録し混合しない。'
write(D/'fetch-records.json',fetched)
write(D/'targets.json',[{'facility':p,'relations':relations[fid],'classification':'update-candidate' if fid in accepted else 'unresolved'} for fid,p in T.items()])
write(D/'source-index.json',list(refs.values()));write(D/'building-verification.json',readings);write(D/'p05-extracted-records.json',features)
write(OUT,{'schema':1,'region':'south-kanto','updates':updates,'unresolved':unresolved,'corrections':corrections})
write(D/'baseline-hashes.json',{p:sha(p) for p in ['data/work/issue5-baseline/ledger.json','data/work/issue5-baseline/full.json']})
print({'targets':len(T),'updates':len(updates),'unresolved':len(unresolved),'corrections':len(corrections),'sources':len(refs)})
