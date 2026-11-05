"""Offline build of issue #5 research candidates; never edits baseline or regional inputs."""
import json,pathlib,hashlib,datetime,zipfile,io,copy
R=pathlib.Path('.').resolve(); E=pathlib.Path('data/evidence/issue5/west-south'); OUT=pathlib.Path('data/national/issue5/west-south.json')
def read(p):return json.loads(pathlib.Path(p).read_text())
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def write(p,d):pathlib.Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def relative(p):
 p=pathlib.Path(p);return str(p.relative_to(R)) if p.is_absolute() else str(p)
def walk(d):
 if isinstance(d,dict):
  yield d
  for v in d.values():yield from walk(v)
 elif isinstance(d,list):
  for v in d:yield from walk(v)
# Preserve acquisition metadata from prior manifests; never turn checkedAt or mtime into fetchedAt.
meta={}
for p in pathlib.Path('data/evidence/national').rglob('*.json'):
 if not any(t in p.name for t in ['manifest','source','fetch','snapshot']):continue
 try:d=read(p)
 except Exception:continue
 for n in walk(d):
  sp=n.get('snapshotPath',n.get('path'))
  if isinstance(sp,str) and n.get('fetchedAt'):meta.setdefault(relative(sp),n)
reused={}; missing=[]
def preserve(n):
 sp=n.get('snapshotPath',n.get('path'));url=n.get('sourceUrl',n.get('url'))
 if not isinstance(sp,str) or not pathlib.Path(sp).is_file():return None
 sp=relative(sp);p=pathlib.Path(sp);h=sha(p)
 expected=n.get('snapshotSHA256',n.get('sha256'))
 if expected and expected!=h:raise ValueError(('hash mismatch',sp))
 if sp.startswith(str(E)+'/'):return {'sourceUrl':url,'snapshotPath':sp,'snapshotSHA256':h,'fetchedAt':n.get('fetchedAt')}
 dest=E/(h+p.suffix);dest.write_bytes(p.read_bytes())
 m=meta.get(sp,{})
 rec={'sourceUrl':url or m.get('url'),'snapshotPath':str(dest),'snapshotSHA256':h,'reusedFrom':sp,'fetchedAt':n.get('fetchedAt') or m.get('fetchedAt'),'acquisitionTimePolicy':'Original recorded time only; null means unavailable.','sourceLocator':n.get('sourceLocator','旧記録が参照する当該施設本文。target-audit.jsonのfacilityId別priorRecordsを参照。'),'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'旧原本bytesと記録済みSHA256を再照合。取得時刻は元メタデータを保持。座標採用の意味確認とは別の原本保全検査。'}
 reused[sp]=rec;return rec
inputs=['data/work/issue5-baseline/ledger.json','data/work/issue5-baseline/full.json','data/national/location-updates/chugoku-shikoku.json','data/national/location-updates/kyushu-okinawa.json','data/national/reviews/chugoku-saitama-locations.json','data/national/reviews/kyushu-okinawa-locations.json','data/evidence/national/locations-chugoku-shikoku/facility-audit.json','data/evidence/national/locations-kyushu-okinawa/unresolved-research.json','data/national/regions/chugoku-shikoku.json','data/national/regions/kyushu-okinawa.json','data/overrides/proposals/west-south.json','data/evidence/national/proposals-west-south/decisions.json']
inputproof=[{'path':p,'sha256':sha(p)} for p in inputs]
l=read(inputs[0]);full=read(inputs[1]);rels={}
for r in l['relations']:
 if 31<=int(r['cardId'][:2])<=47:rels.setdefault(r['placeId'],[]).append(r)
targets={p['id']:p for p in l['places'] if p['id'] in rels and not p.get('coordinate')}
old={k:[] for k in targets}
for p in inputs[2:]:
 for n in walk(read(p)):
  fid=n.get('facilityId')
  if fid in old and any(k in n for k in ['reason','decision','outcome','coordinate']):old[fid].append({'path':p,'record':n})
fetches=read(E/'fetches.json');fetched={r['url']:r for r in fetches if r.get('status')==200}
def current(url):
 n=fetched[url];return {'sourceUrl':url,'snapshotPath':n['snapshotPath'],'snapshotSHA256':n['snapshotSHA256'],'fetchedAt':n['fetchedAt'],'checkedAt':'2026-11-05','actorType':'ai','sourceLocator':'当該施設の名称・所在地・配布場所または庁舎移転の本文。具体的な照合箇所はbuildingIdentification/reasonを参照。','verificationMethod':'AIが今回取得した公式本文を読み、固定baselineと照合。取得時刻はHTTP応答bytesの実取得時刻。現地確認ではない。'}
# Extract exact unchanged P05 GeoJSON bytes, rather than reproducing a derived candidate value.
zm=read('data/evidence/national/official-facility-index/P05-22_GML.zip.source.json');zp=preserve(zm);z=zipfile.ZipFile(zm['path']);members={}
for pref in ['40','41','46']:
 zn=next(n for n in z.namelist() if n.endswith('_'+pref+'_GML.zip'));zz=zipfile.ZipFile(io.BytesIO(z.read(zn)));gn=next(n for n in zz.namelist() if n.endswith('.geojson'));b=zz.read(gn);p=E/gn;p.write_bytes(b);members[pref]=(p,json.loads(b),zn,gn)
for name in ['p05-spec.pdf','p05-license.html','p05.html','gsi-mapsheet-faq.html']:
 m=read('data/evidence/national/official-facility-index/'+name+'.source.json');preserve(m)
# Tuple: target, source feature index, distribution URL, building identity URL, identity finding.
selection=[
 ('facility:kyushu-fec63a8962497abb940f','41',431,'https://www.city.kanzaki.saga.jp/main/7553.html','https://www.city.kanzaki.saga.jp/main/12136.html','配布案内と施設概要の神埼情報館・神埼町鶴3456-4が一致。展示室等を含む当該建物のP05点。休館日の公式ページ間相違は別記。'),
 ('facility:kyushu-e06ac5856a6e4bded47a','41',361,'https://www.city.saga-kashima.lg.jp/main/15748.html','https://www.city.saga-kashima.lg.jp/main/21632.html','公式施設案内は2016年8月竣工の新世紀センター（第二庁舎）を明示。市役所総称点でなく同建物のP05点。配布先はこの建物1階環境下水道課。'),
 ('facility:kyushu-26485d92c27ac8317992','41',361,'https://www.city.saga-kashima.lg.jp/main/15748.html','https://www.city.saga-kashima.lg.jp/main/21632.html','配布案内が休日の宿日直室を新世紀センター1階と明示。平日窓口と同じ第二庁舎建物のP05点。'),
 ('facility:kyushu-786085478c88a34b14cc','46',657,'https://www.city-kirishima.jp/gesuidou/20180726.html','https://www.city-kirishima.jp/soumu/shise/annai/choshaannai/hayato.html','配布案内の第22弾平日2階下水道工務課と現行フロア案内の隼人市民サービスセンター・内山田1-11-11を同定。すこやか保健センター（1-10-33）と区別。'),
 ('facility:kyushu-837475cdb663a2c88d04','46',657,'https://www.city-kirishima.jp/gesuidou/20180726.html','https://www.city-kirishima.jp/soumu/shise/annai/choshaannai/hayato.html','第22弾休日1階お客様センター宿直室を同サービスセンター建物内と同定。第14弾の階不明の代替案内にこの階情報を流用しない。'),
 ('facility:ws-88a6c5a846ae640758','40',1691,'https://www.city.dazaifu.lg.jp/soshiki/22/22649.html','https://www.city.dazaifu.lg.jp/soshiki/22/22649.html','現行公式配布案内の休館日代替は市役所1階総合案内。住所観世音寺1-1-1は同原本の市役所欄とP05市役所レコードに一致。太宰府館や駅内観光案内所の点ではない。既存A/B関係だけを維持。')]
updates=[];proof=[]
for fid,pref,idx,du,iu,note in selection:
 p,d,zn,gn=members[pref];f=d['features'][idx];lng,lat=f['geometry']['coordinates'];loc=f'{zn}!{gn}#/features/{idx}'
 e={'sourceUrl':zm['url'],'snapshotPath':zp['snapshotPath'],'snapshotSHA256':zp['snapshotSHA256'],'sourceLocator':loc+'; '+f['properties']['P05_003']+' / '+f['properties']['P05_004'],'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'AI原典照合。P05製品仕様の建物内地点と現行配布原本・施設案内を照合。'+note+' 建物代表点であり室内窓口の測量ではない。JGD2011元数値を保持。'}
 updates.append({'facilityId':fid,'coordinate':{'lat':lat,'lng':lng},'scope':'building','evidence':e})
 proof.append({'facilityId':fid,'rawFeature':f,'memberPath':str(p),'memberSHA256':sha(p),'featureIndex':idx,'sourceLocator':loc,'distributionEvidence':current(du),'buildingEvidence':current(iu),'buildingIdentification':note,'crs':'EPSG:6668 / JGD2011; GeoJSON [longitude, latitude]','license':'国土交通省 国土数値情報P05-2022, CC BY 4.0; 座標抽出加工。国交省による承認を意味しない。','relocationReview':'2022-04基準。現行の名称・番地・建物案内と照合。閲覧した資料に当該建物からの移転告知なし。同住所での建替えの不存在を保証するものではない。'})
# Every baseline target is classified, including all 18 integrated proposal places.
updateids={u['facilityId'] for u in updates};unresolved=[];audit=[]
for fid,p in targets.items():
 sources=[]
 for n in [p.get('evidence',{}),*[r.get('evidence',{}) for r in rels[fid]]]:
  x=preserve(n)
  if x:sources.append(x)
 for rec in old[fid]:
  for n in walk(rec['record']):
   if 'snapshotPath' in n:
    x=preserve(n)
    if x:sources.append(x)
 reasons=[]
 for rec in old[fid]:
  n=rec['record'];reason=n.get('reason') or n.get('decision')
  if isinstance(reason,str) and len(reason)>15:reasons.append(reason)
 # Independent rejection takes precedence over original acceptance.
 for rec in old[fid]:
  if '/reviews/' in rec['path'] and rec['record'].get('reason'):reasons.insert(0,rec['record']['reason'])
 reason=reasons[0] if reasons else '追加proposal施設。公式配布関係の原本は保存済みだが、当該建物を特定する座標原典の照合が未完了。'
 nextsource=p.get('evidence',{}).get('sourceUrl')
 if fid not in updateids:
  unresolved.append({'facilityId':fid,'reason':reason,'nextSource':{'url':nextsource,'required':'現行配布先の建物名・棟を特定する公式施設GIS、フロア/配置案内、または建物単位の公開目的地点。既存失敗URLの反復ではなく不足する原典種別を追加。'},'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'固定baseline・旧位置追補・独立レビューの個別記録を再分類。新規Web確認の有無はauditを参照。未解決を調査済み確定点と扱わない。','evidence':list({x['snapshotPath']:x for x in sources}.values()),'priorReviewReferences':[{'path':r['path'],'facilityId':fid} for r in old[fid]]})
 audit.append({'facilityId':fid,'name':p['name'],'address':p['address'],'cardIds':sorted({r['cardId'] for r in rels[fid]}),'prefectureCodes':sorted({r['cardId'][:2] for r in rels[fid]}),'integratedProposal':fid.startswith('facility:ws-'),'classification':'candidate-update' if fid in updateids else 'unresolved','priorRecords':old[fid],'distributionEvidence':list({x['snapshotPath']:x for x in sources}.values())})
# Exact, review-only corrections: do not mutate original records.
corrections=[]
for fid,new in [('facility:kyushu-431427a75efc404fc5c1','宇美町役場 南館 上下水道課'),('facility:kyushu-056030efbe436e3617a8','宇美町役場 本館 警備室')]:
 corrections.append({'facilityId':fid,'targetPath':inputs[0],'selector':{'id':fid},'field':'name','old':targets[fid]['name'],'new':new,'reason':'配布公式原本が南館上下水道課と本館警備室を分離して明記。時刻の名称混入も除く。既存ID・配布条件は変えない。','evidence':current('http://www.town.umi.lg.jp/soshiki/10/14168.html')})
for u in unresolved:
 fid=u['facilityId']
 if fid in ['facility:kyushu-431427a75efc404fc5c1','facility:kyushu-056030efbe436e3617a8']:
  u['reason']='公式配布原本は南館上下水道課と本館警備室を区別。P05の宇美町役場点・同住所の地域包括支援センター点だけで各棟を確定できない。旧レビューの単なる数値不足より棟同定が先。'
 if fid=='facility:kyushu-51dfc976486b8b93581d':
  rr=next(r for r in read(inputs[5])['reviews'] if r['facilityId']==fid)
  new='旧レビュー時の関係処理待ちは固定baselineで対応済み。太宰府館はsuspended/reviewUntil=2026-12-22、臨時案内所は別ID facility:ws-571a1c21a1a6a8b166。現在配布先の位置整備として旧館点は採用しない。終了後復帰を推測しない。'
  corrections.append({'facilityId':fid,'targetPath':inputs[5],'selector':{'facilityId':fid},'field':'reason','old':rr['reason'],'new':new,'reason':'固定baselineの当該2施設の関係と再取得した公式移転案内を照合。','evidence':current('https://www.city.dazaifu.lg.jp/soshiki/22/22649.html')});u['reason']=new
 if fid in ['facility:cs-0a3fd9d830063e2ad7','facility:cs-93122d3bc481983632','facility:kyushu-7a9f8dae19665147953f','facility:ws-61c944585418f01447']:
  url='https://www.town.tadotsu.kagawa.jp/kakuka_tyousya/2370.html' if fid.startswith('facility:cs-') else 'https://www.tokunoshima-town.org/soumuka/zaisei/shinchosya01.html'
  u['evidence'].append(current(url));u['reason']+=' 今回再取得した新庁舎案内でも2022年移転を確認。P05基準2022年4月より後の移転であり、旧点の流用は不可。'
# Focused followup references for unresolved address/building cases.
focused={
 'facility:cs-85f80ce977bcdf56d4':(['https://www.city.setouchi.lg.jp/map/405.html','https://www.city.setouchi.lg.jp/soshiki/35/1990.html'],'再取得した施設ページは土師288-1、initlat=34.69969459401827、initlong=134.10324919623656。P05の土師291（34.70016725,134.1020908）と異なる。市地図JSは同値をmarker.positionに使うが、基準台帳住所との変更関係は未確定。住所訂正だけで同一建物と仮定しない。'),
 'facility:cs-7851aeb9671340371a':(['https://tsuwano-kanko.net/category1/loca/'],'現在の協会所在地は津和野駅内・後田イ66-1。基準台帳後田イ71-2との移転・同一性判定が残る。駅内の明示建物点と現配布原本の接続が必要。'),
 'facility:kyushu-e7eae1c92a37ac5f0745':(['https://www.city.nakama.lg.jp/site/kankou/19807.html','https://www.city.nakama.lg.jp/soshiki/8/1420.html'],'P05-22_40 feature1332に中間市役所（33.816699,130.709026）は存在する。現在の配布案内も中間1-1-1を明記するが、下水道課の棟対応を示す追加原本の確認を残す。数値不足だけを理由にせず棟同定を次の作業とする。'),
 'facility:ws-571a1c21a1a6a8b166':(['https://www.city.dazaifu.lg.jp/soshiki/22/22649.html'],'2026-10-01～12-22の現行配布先は西鉄太宰府駅構内の観光案内所。旧太宰府館のCSV/P05点をこの施設に流用しない。駅構内の当該建物の公開座標原典が未確保。')}
for u in unresolved:
 if u['facilityId'] in focused:
  urls,finding=focused[u['facilityId']];u['reason']=finding;u['evidence'] += [current(url) for url in urls]
for c in corrections:
 if c['targetPath']==inputs[0]:
  assert next(p for p in l['places'] if p['id']==c['facilityId'])[c['field']]==c['old']
 else:
  assert next(r for r in read(c['targetPath'])['reviews'] if r['facilityId']==c['facilityId'])[c['field']]==c['old']
# Explicit conflicts and currentness caveats for parent review.
notes=[{'facilityId':'facility:kyushu-fec63a8962497abb940f','type':'official-hours-conflict','finding':'配布ページ7553は年末12/29–31を除く9–17時。施設ページ12136は月曜（祝日の場合翌日）、12/29–1/3休館。建物同定は一致するが配布曜日の優先根拠は不足。位置候補のみ、関係時間を変更しない。','evidence':[current('https://www.city.kanzaki.saga.jp/main/7553.html'),current('https://www.city.kanzaki.saga.jp/main/12136.html')]}, {'facilityId':'facility:kyushu-786085478c88a34b14cc','type':'multiple-dataset-points','finding':'P05本庁・隼人庁舎feature656と隼人市民サービスセンター657は数m差。平均せず名称が配布施設と一致する657の元数値を採用。同じ建物のフロア原本で照合。'}, {'facilityId':'facility:ws-88a6c5a846ae640758','type':'multiple-dataset-points','finding':'BODIK市役所33.512788,130.5239とP05点33.512835,130.523876は数m差。平均せず建物内位置仕様が確認できるP05の元数値を採用。太宰府Cの移転期間と通常代替の適用関係は追加しない。'}]
for a in audit:
 fid=a['facilityId'];evidences=[]
 for pr in proof:
  if pr['facilityId']==fid:evidences += [pr['distributionEvidence'],pr['buildingEvidence']]
 for u in unresolved:
  if u['facilityId']==fid:evidences += [e for e in u['evidence'] if e.get('sourceUrl') in fetched]
 for c in corrections:
  if c['facilityId']==fid:evidences.append(c['evidence'])
 a['newWebEvidence']=list({e['snapshotPath']:e for e in evidences}.values())
 a['researchLevel']='focused-current-original-review' if evidences else 'prior-original-and-review-reclassification'
fullids={c['id'] for c in full['cards']}
assert all(r['cardId'] in fullids for fid in targets for r in rels[fid])
write(OUT,{'schema':1,'region':'west-south','updates':updates,'unresolved':unresolved,'corrections':corrections})
write(E/'coordinate-proof.json',proof);write(E/'target-audit.json',audit);write(E/'reused-snapshots.json',list(reused.values()));write(E/'input-hashes.json',inputproof);write(E/'parent-review-notes.json',notes)
# Revalidate exact source values, hashes, coverage and correction preconditions.
assert set(targets)==updateids|{u['facilityId'] for u in unresolved}
assert len(updates)+len(unresolved)==len(targets)==164
assert len({u['facilityId'] for u in updates+unresolved})==164
for u,pr in zip(updates,proof):
 f=read(pr['memberPath'])['features'][pr['featureIndex']];assert f==pr['rawFeature'];assert f['geometry']['coordinates']==[u['coordinate']['lng'],u['coordinate']['lat']]
for n in walk([updates,unresolved,proof,corrections,list(reused.values())]):
 if n.get('snapshotPath') and n.get('snapshotSHA256'):assert sha(n['snapshotPath'])==n['snapshotSHA256']
for p in inputproof:assert sha(p['path'])==p['sha256']
write(E/'validation.json',{'validatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actorType':'ai','targetCount':len(targets),'candidateUpdates':len(updates),'unresolved':len(unresolved),'corrections':len(corrections),'integratedProposalTargets':sum(p['integratedProposal'] for p in audit),'coverage':'pass: unique and disjoint; relations.cardId prefix31–47','rawCoordinateValueCheck':'pass: all P05 feature values exact','snapshotHashCheck':'pass','fixedInputsUnchanged':'pass','semanticBuildingCheck':'AI manual review recorded in coordinate-proof.json; hashes alone do not prove building identity','researchCompletion':'baseline classification complete; focused followup complete; unresolved facilities are not all coordinate-confirmed or all freshly fetched','documentCodeDiscrepancies':[]})
print('targets',len(targets),'updates',len(updates),'unresolved',len(unresolved),'corrections',len(corrections),'preserved',len(reused))
