import json,pathlib,hashlib,datetime,copy,re,shutil
ROOT=pathlib.Path('data/evidence/issue5/north-kanto'); OUT=pathlib.Path('data/national/issue5/north-kanto.json')
def read(p):return json.loads(pathlib.Path(p).read_text())
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def write(p,d):pathlib.Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
now=datetime.datetime.now(datetime.timezone.utc).isoformat(); date=now[:10]
l=read('data/work/issue5-baseline/ledger.json');full=read('data/work/issue5-baseline/full.json');places={p['id']:p for p in l['places']}; rel={}
for r in l['relations']:
 if r['cardId'][:2] in ['08','09','10','11']:rel.setdefault(r['placeId'],[]).append(r)
targets={i:p for i,p in places.items() if i in rel and not p.get('coordinate')}
inputs=['data/work/issue5-baseline/ledger.json','data/work/issue5-baseline/full.json','data/national/regions/kanto-north.json','data/overrides/proposals/kanto-north.json','data/national/patches/kanto-north.json','data/national/reviews/kanto-north-itg-locations.json','data/national/reviews/chugoku-saitama-locations.json','data/national/reviews/facility-point-scope.json','data/national/location-updates/kanto-north-ibaraki-tochigi-gunma.json','data/national/location-updates/kanto-north-saitama.json','data/national/location-updates/official-facility-index.json']
inputs+= [str(p) for p in pathlib.Path('data/evidence/national').glob('*kanto-north*/README.md')]
inputhash=[{'path':p,'sha256':sha(p)} for p in inputs]
oldc={}; oldun={}; oldrev={}
for p in inputs:
 if '/location-updates/' in p:
  d=read(p)
  for u in d.get('updates',[]):oldc.setdefault(u.get('facilityId'),[]).append({'path':p,'value':u})
  for u in d.get('unresolved',[]):oldun.setdefault(u.get('facilityId'),[]).append({'path':p,'value':u})
 if '/reviews/' in p:
  d=read(p)
  for u in d.get('decisions',[])+d.get('reviews',[])+d.get('results',[]):oldrev.setdefault(u.get('facilityId'),[]).append({'path':p,'value':u})
fetch=read(ROOT/'fetch-records.json')+read(ROOT/'fetch-additional-records.json'); fresh={r['sourceUrl']:r for r in fetch if r.get('status')==200}
# Preserve byte-identical originals; cache copy time is not acquisition time.
cache={}
def evidence(e):
 if not e.get('snapshotPath'):return None
 p=pathlib.Path(e['snapshotPath'])
 if not p.exists():return {'originalPath':str(p),'missing':True}
 h=sha(p);key=(str(p),e.get('sourceUrl'))
 if key not in cache:
  dest=ROOT/('reused-'+h[:24]+p.suffix)
  if not dest.exists():shutil.copyfile(p,dest)
  cache[key]={'sourceUrl':e.get('sourceUrl'),'originalPath':str(p),'snapshotPath':str(dest),'snapshotSHA256':h,'expectedSHA256':e.get('snapshotSHA256'),'hashMatches':not e.get('snapshotSHA256') or h==e['snapshotSHA256'],'bytes':p.stat().st_size,'fetchedAt':None,'acquisitionTimeStatus':'原取得秒時刻はこのevidenceにない。checkedAtや今回のコピー時刻から補完しない。元取得記録はoriginalPathの隣接メタデータを参照。','checkedAt':date,'actorType':'ai','sourceLocator':e.get('sourceLocator',e.get('locator','原evidence参照')),'verificationMethod':'保存原本bytesのSHA256照合。hash一致は意味的・建物同定の承認ではない。'}
 return cache[key]
updates=[]; checks=[]
def add(fid,url,coord,locator,reason,identityurls):
 r=fresh[url];s=pathlib.Path(r['snapshotPath']).read_text(); assert all(str(v) in s for v in coord.values())
 ev={k:r[k] for k in ['sourceUrl','snapshotPath','snapshotSHA256']};ev.update(sourceLocator=locator,checkedAt=date,actorType='ai',verificationMethod=reason+' 室内・階・入口の測量ではなく建物代表点。親レビュー前の候補。',fetchedAt=r['fetchedAt'])
 updates.append({'facilityId':fid,'coordinate':coord,'scope':'building','evidence':ev})
 checks.append({'facilityId':fid,'sourceCoordinate':coord,'coordinateLiteralPresent':True,'buildingIdentity':reason,'identityEvidence':[fresh[u] for u in identityurls],'relocationCheck':'現行公式配布先名称・住所と建物案内を照合。同じ住所だけを理由に別棟へ転用していない。','crsReview':'原本のGoogle Maps宛てlat/lngを無変換で採録。Google用地理緯度経度として整合するが、自治体は原測量の測地系・精度を明記していない。JGD/WGSの実測保証をしない。','licenseReview':'公式公開ページのリンク内数値という事実を抽出。Googleから地図・座標データを追加取得していない。原本HTMLの再配布許諾やCCライセンス取得を意味しない。筑西の著作権条件は4dc6346baede4109ac63.html。候補の採用と原本の公開可否は親で確認。'})
url='https://www.city.chikusei.lg.jp/kurashi-tetsuzuki/gesuidou/page006377.html'
for suffix in ['95b25d7d3d1f8e92606f','943e6a0012c75808a6ab']:
 add('facility:kanto-north-'+suffix,url,{'lat':36.3052692,'lng':139.9794245},'配布場所の「筑西市役所本庁舎（筑西市丙360番地）」リンク !8m2!3d36.3052692!4d139.9794245。0x0:0x0で名前付きPOIではない。蓋設置場所節とは別。','公式配布記事の平日下水道課・休日1階総合案内は同じ建物内との明示と本庁舎フロア案内を照合。',[url,'https://www.city.chikusei.lg.jp/gyousei/soshiki-shisetsu/floor-map/page001123.html'])
add('facility:kanto-north-sakuragawa-makabe-water','https://www.city.sakuragawa.lg.jp/map.php?type=0',{'lat':36.2783968826407,'lng':140.091696381569},'公共施設ガイドマップ「桜川市役所 真壁庁舎」a[href] q=36.2783968826407,140.091696381569、飯塚911','現行カード配布記事は水道お客様センターを真壁庁舎2階と指定。施設案内の真壁庁舎の名称・飯塚911が一致し岩瀬・大和庁舎と区別。',['https://www.city.sakuragawa.lg.jp/kurashi/news/page006330.html'])
add('facility:kanto-north-kawajima-water','https://www.town.kawajima.saitama.jp/1825.htm',{'lat':35.9925196,'lng':139.4844419},'八ツ林バス停から川島町役場への徒歩経路リンク。2番目!1m5の目的地 !1d139.4844419!2d35.9925196。出発点と@表示中心は除外。','現行配布本文は川島町役場1階上下水道課でも配布と明記。役場交通アクセスの下八ツ林870-1の目的地を照合。さまちかの923とは別建物。',['https://www.town.kawajima.saitama.jp/6276.htm'])
updateids={u['facilityId'] for u in updates}; corrections=[]
rv=read('data/national/reviews/kanto-north-itg-locations.json')
for c in rv['exactCorrections']:
 if c['facilityId'] in updateids:
  c=copy.deepcopy(c);c['targetFile']=rv['sourceFile'];c['basis']={'sourceUrl':url,'snapshotPath':fresh[url]['snapshotPath'],'snapshotSHA256':fresh[url]['snapshotSHA256'],'sourceLocator':'本庁舎ラベルのリンクの0x0:0x0と!3d/!4d','checkedAt':date,'actorType':'ai','verificationMethod':'現行原本を再取得し旧原本と同hash・リンク構造を再検証。旧レビューのexact訂正を引き継ぐ。'};corrections.append(c)
unresolved=[]; inventory=[]
for fid,p in sorted(targets.items()):
 refs=[]
 for e in [p.get('evidence',{})]+[r.get('evidence',{}) for r in rel[fid]]+[c['value'].get('evidence',{}) for c in oldc.get(fid,[])]:
  if isinstance(e,dict):
   r=evidence(e)
   if r and r not in refs:refs.append(r)
 reasons=[x['value'].get('reason','') for x in oldrev.get(fid,[]) if x['value'].get('decision',x['value'].get('status'))!='accepted']+[x['value'].get('reason','') for x in oldun.get(fid,[])]
 reason=' / '.join(dict.fromkeys(filter(None,reasons))) or '旧原本の再分類のみ。現行配布建物と公開数値点の対応を追加確認できていないため未確定。'
 if fid.endswith('ab5de7e90313a0f18ac5'):reason='町座標36.436184923514126,139.90938283430177と県座標36.433598,139.915131の589.2m差が未解消。今回の町施設カテゴリ・県案内再取得でも対象建物点の独立証明に至らず、双方不採用。'
 if fid not in updateids:
  unresolved.append({'facilityId':fid,'reason':reason,'nextSource':{'url':p.get('evidence',{}).get('sourceUrl'),'required':'現行配布建物を特定する公式施設図・庁舎案内と建物に結び付く公式GIS/公開目的地点。別棟・敷地点・住所点・viewportを除外。競合がある場合は両原典の建物対応と更新時点。'},'checkedAt':date,'actorType':'ai','verificationMethod':'固定baseline対象を旧location-updates/reviewsと照合し原本hashを再検証。未再取得施設を現行Web再確認済みとは扱わない。','evidence':refs,'priorReviewReferences':[{'path':x['path'],'decision':x['value'].get('decision',x['value'].get('status')),'reason':x['value'].get('reason')} for x in oldrev.get(fid,[])],'priorAttempts':[x['value'].get('attempts',[]) for x in oldun.get(fid,[])]})
 inventory.append({'facilityId':fid,'name':p['name'],'address':p['address'],'cardIds':sorted({r['cardId'] for r in rel[fid]}),'classification':'candidate-building' if fid in updateids else 'unresolved','proposalFacility':fid in {x['id'] for x in read('data/overrides/proposals/kanto-north.json')['places']},'oldCandidates':oldc.get(fid,[]),'oldReviews':oldrev.get(fid,[]),'evidence':refs})
write(OUT,{'schema':1,'region':'north-kanto','updates':updates,'unresolved':unresolved,'corrections':corrections})
write(ROOT/'inventory.json',inventory);write(ROOT/'reused-originals.json',list(cache.values()));write(ROOT/'candidate-revalidation.json',checks)
assert len(updateids)==len(updates) and set(targets)==updateids|{x['facilityId'] for x in unresolved} and not updateids&{x['facilityId'] for x in unresolved}
assert all(x.get('hashMatches') for x in cache.values())
assert all(r['cardId'] in {c['id'] for c in full['cards']} for fid in targets for r in rel[fid])
write(ROOT/'verification.json',{'schema':1,'checkedAt':now,'actorType':'ai','targetCount':len(targets),'candidateCount':len(updates),'unresolvedCount':len(unresolved),'correctionCount':len(corrections),'proposalFacilityCount':sum(x['proposalFacility'] for x in inventory),'allTargetIdsPartitionedExactlyOnce':True,'allReferencedOriginalHashesMatch':True,'reusedOriginalCount':len(cache),'allCandidatesCoordinateLiteralsMatch':True,'baselineAndInputHashes':inputhash,'documentCodeDiscrepancies':[],'scopeLimitation':'全116件のID分類と旧根拠検査が完了。現行Web・建物点の確認完了は候補4件のみ。未確定112件は解決・全国座標確定を意味しない。'})
print(len(targets),len(updates),len(unresolved),len(corrections),len(cache))
