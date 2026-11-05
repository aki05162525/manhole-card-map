"""Offline reconstruction; writes only this research output, never the baseline."""
import json,hashlib,datetime,copy,re
from pathlib import Path
R=Path('data/evidence/issue5/kinki'); OUT=Path('data/national/issue5/kinki.json')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(p,d):Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
L=read('data/work/issue5-baseline/ledger.json'); F=read('data/work/issue5-baseline/full.json')
P={p['id']:p for p in L['places']}; rel={}
for r in L['relations']:
 if 24<=int(r['cardId'][:2])<=30:rel.setdefault(r['placeId'],[]).append(r)
T={i:p for i,p in P.items() if i in rel and not p.get('coordinate')}
old=read('data/national/location-updates/kinki.json'); U={u['facilityId']:u for u in old['unresolved']}
metadata={}
for path in ['data/evidence/national/kinki/manifest.json','data/evidence/national/locations-kinki/manifest.json','data/evidence/national/proposals-kinki/manifest.json']:
 for m in read(path):
  if m.get('snapshotPath'):metadata[m['snapshotPath']]={**m,'reusedManifest':path}
reused={}
def evidence(e):
 e=copy.deepcopy(e); path=e['snapshotPath']; assert sha(path)==e['snapshotSHA256'],path
 dest=R/'snapshots'/('reused-'+e['snapshotSHA256']+'.html')
 if not dest.exists():dest.write_bytes(Path(path).read_bytes())
 m=metadata.get(path,{})
 reused[str(dest)]={**m,'url':e['sourceUrl'],'snapshotPath':str(dest),'snapshotSHA256':sha(dest),'reusedFrom':path,'fetchedAt':m.get('fetchedAt'),'retrievalTimeKnown':bool(m.get('fetchedAt'))}
 e.update(snapshotPath=str(dest),checkedAt='2026-11-05',actorType='ai');return e
pairs={
 'facility:kinki-katano-guard':('facility:kinki-8914b9e6744511e117c2','公式配布表は平日窓口と休日警備員室をともに私市2丁目24番1号の上下水道部1階と明記。水道局施設ページのmarkerInfosのtitle=水道局を照合。市役所ではない。'),
 'facility:kinki-neyagawa-holiday':('facility:kinki-2d25fa4fd7e5424d29b7','配布案内の土日祝1階窓口と平日2階下水道事業室は同じ上下水道局庁舎。本町15番1号。地図qの目的点とll表示中心は別で、qを採用。配布は在庫切れ・再開未定のsuspendedを維持。'),
 'facility:kinki-toyono-guard':('facility:kinki-87988ebfde4fcebbf78a','配布案内が本庁舎3階と本庁舎1階警備室を区別し、共に余野414-1と明記。施設ページの豊能町役場popupに紐づくL.marker(latlng)。吉川支所ではない。'),
 'facility:kinki-yokkaichi-holiday':('facility:kinki-efdb8ded331038c52b06','配布場所欄は堀木一丁目3-18の上下水道局2階総務課、土日祝は夜間休日窓口と明記。その直後の地図リンクのplace目的点を照合。後段のマンホール設置場所ではない。')}
updates=[]; reviews=[]
for fid,(other,note) in pairs.items():
 p=P[other];e=evidence(p['evidence']);d=evidence(P[fid]['evidence']);c=p['coordinate']
 raw=Path(e['snapshotPath']).read_text();assert all(str(v) in raw for v in c.values())
 e['sourceLocator']+=' / '+note;e['verificationMethod']='AIが保存公式配布案内と座標原本を再照合し、同一建物の追加窓口と同定。住所検索・viewport・蓋座標は不使用。室内窓口の測量ではない。'
 updates.append(dict(facilityId=fid,coordinate=c,scope='building',evidence=e))
 reviews.append(dict(facilityId=fid,name=P[fid]['name'],address=P[fid]['address'],coordinate=c,coordinateOriginalValues=[str(c['lat']),str(c['lng'])],coordinateEvidence=e,distributionEvidence=d,buildingIdentification=note,sourceFacilityId=other,distributionStatuses=[r['status'] for r in rel[fid]],datum='Web地図の緯度経度（十進度）。原典に測地系の名称は明記されず、変換は実施しない。測量精度を主張しない。',license='明示的なオープンデータライセンスは未確認。自治体が掲載した数値と出典を候補化。OSM背景のライセンスを自治体マーカーに誤適用しない。HTML原本は監査資料。公開再配布・第三者地図数値の利用条件は親レビュー時に別途判断。',relocationConflict='保存済み当日公式配布案内と建物住所は一致。この原本間では移転・別棟競合なし。'))
proposalReasons={
'akashi-information':'ピオレ明石西館内の案内所。駅全体・東館の点を西館建物点として採用しない。西館の建物同定済み公式座標が必要。',
'fukusaki-ekimae':'福田302-11のフクちゃんプラザ。指定管理者のアクセス原本は住所確認用。埋込表示中心から建物点を作らない。',
'fukusaki-tsujikawa':'西田原1470-1のサキちゃんプラザ。辻川山公園全体点は使わず交流センター棟の公式座標を確認する。',
'habikino-visitor':'古市1-1-21の新ビジターセンター。旧古市駅前案内所1-1-19の座標は流用不可。',
'higashiosaka-lobby':'本庁舎22階と13階は同建物。追加取得した公式アクセスページは住所・交通案内を確認できたが建物目的点の数値がない。',
'imai-machizukuri':'今井町3丁目8番8号へ10月1日移転。華甍2-3-5の旧建物点を使わず、まちづくりセンターの座標原典が必要。',
'itami-gallery-temporary':'9月14日から旧伊丹市演劇ホール喫茶店跡の仮設店舗。JR伊丹駅構内の旧点は不適用。番地・仮設店舗棟の同定が未完。',
'karako-information':'唐古50番地の2の遺構展示情報館。公園全体点・道の駅・マンホールの座標は不適用。展示情報館棟の公式数値が必要。',
'kusatsu-cityhall':'本庁舎2階。草津市BODIK全138データセットのメタデータを確認したが今回の取得では本庁舎建物点を取得していない。防災マップの避難エリア点は転用しない。',
'kyoto-guard':'総合庁舎の公式紹介に施設マップid=1000001826へのリンクとlat=34.971/lng=135.75614がある。しかし表示引数と施設レコードを区別できるGIS原本が403。建物マーカーの座標としては保留。',
'sennan-annex':'樽井一丁目1番1号の別館2階。旧737番地と本庁舎の点は使わず別館棟を同定する必要がある。',
'tajiri-tourism':'りんくうポート北1番の観光案内所。港全体点・町役場の点は不適用。案内所の建物点が未確認。営業時間競合は座標調査では変更しない。',
'takasago-cityhall':'本庁舎3階12番窓口。建替え後の本庁舎棟に対応する公式座標を確認する必要がある。'}
unresolved=[]; classification=[]
for fid,p in T.items():
 d=evidence(p['evidence']); rs=rel[fid]
 item=dict(facilityId=fid,name=p['name'],address=p['address'],cardIds=sorted({r['cardId'] for r in rs}),prefCodes=sorted({r['cardId'][:2] for r in rs}),distributionStatuses=sorted({r['status'] for r in rs}),classification='update-candidate' if fid in pairs else 'unresolved',priorReview='regional-location-unresolved' if fid in U else 'additional-proposal',distributionEvidence=d)
 classification.append(item)
 if fid in pairs:continue
 reason=U[fid]['reason'] if fid in U else proposalReasons.get(fid.removeprefix('facility:kinki-'),'追加proposalの公式配布案内は保存済み。対象建物に紐づく座標原典は未取得。')
 nextSource={'url':d['sourceUrl'],'task':'この配布元が案内する対象施設「'+p['name']+'」の現住所「'+p['address']+'」に対応する公式施設GISの個別レコードまたは施設マーカー原典を確認。'}
 unresolved.append(dict(facilityId=fid,reason=reason,nextSource=nextSource,checkedAt='2026-11-05',actorType='ai',verificationMethod='固定台帳・旧地域調査・追加proposalを照合した残件分類。全URLを新規再取得したことは意味しない。',distributionEvidence=d,priorAttempts=U.get(fid,{}).get('attempts',[])))
corrections=[]
for fid in ['facility:kinki-395deea0ac07ef85eee7','facility:kinki-879b3bf5b89bc880cf5a'][:1]:
 row=next(x for x in unresolved if x['facilityId']==fid); new=proposalReasons['kyoto-guard'];oldreason=row['reason'];row['reason']=new
 ce=evidence({'sourceUrl':'https://www.city.kyoto.lg.jp/suido/page/0000309702.html','snapshotPath':'data/evidence/national/locations-kinki/snapshots/c792f5b0f6ae31fba7e7.html','snapshotSHA256':sha('data/evidence/national/locations-kinki/snapshots/c792f5b0f6ae31fba7e7.html'),'sourceLocator':'施設マップ（京都市上下水道局総合庁舎）href; id=1000001826','verificationMethod':'AI原本再読。URL数値の存在とマーカー採用可否を区別。'})
 corrections.append(dict(facilityId=fid,targetPath='data/national/location-updates/kinki.json',selector={'facilityId':fid,'field':'unresolved.reason'},old=oldreason,new=new,evidence=ce,kind='research-explanation-only-not-coordinate'))
# New GIS outcomes enrich specific unresolved records; no retry of denied URLs.
for row in unresolved:
 if row['facilityId']=='facility:kinki-5541e22064b914088d81':row['reason']+=' 追加調査: 大阪市GIS文化・観光CSVはTLS DH_KEY_TOO_SMALLで取得できず、暗号設定を弱めず保留。公開一覧はCC-BY/JGD2011を明記。';row['nextSource']={'url':'https://www.city.osaka.lg.jp/toshikeikaku/page/0000250227.html','task':'公式CSVの通常TLSでの復旧後、下水道科学館行の建物同定を確認。'}
 if row['facilityId'] in ['facility:kinki-6ad3133f41924d1d4b10','facility:kinki-7a7be1946c5a72e93e9f','facility:kinki-a85cfd517816a4d43b6b']:row['reason']+=' 大津市公共施設一覧40535の原本取得はHTTP 403。2021年時点の一覧であり現在の対象建物同定にも追加確認が必要。'
write(OUT,dict(schema=1,region='kinki',updates=updates,unresolved=unresolved,corrections=corrections))
write(R/'classification.json',classification);write(R/'coordinate-review.json',reviews);write(R/'reused-sources.json',list(reused.values()))
inputs=['data/work/issue5-baseline/ledger.json','data/work/issue5-baseline/full.json','data/national/location-updates/kinki.json','data/national/regions/kinki.json','data/national/tokyo-kinki-location-integration.json','data/evidence/national/locations-kinki/README.md','data/evidence/national/proposals-kinki/README.md','data/national/reviews/facility-point-scope.json']
ids=[x['facilityId'] for x in updates+unresolved];assert len(ids)==len(set(ids))==len(T)==192;assert set(ids)==set(T)
assert {r['cardId'] for rows in rel.values() for r in rows}<={c['id'] for c in F['cards']}
for m in reused.values():assert sha(m['snapshotPath'])==m['snapshotSHA256']
write(R/'validation.json',dict(schema=1,validatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),actorType='ai',targetCount=len(T),updateCandidateCount=len(updates),unresolvedCount=len(unresolved),correctionCount=len(corrections),allIdsUniqueAndCovered=True,allCardIdsInFull=True,coordinateOriginalValuesPresent=True,reusedHashesVerified=len(reused),unknownRetrievalTimes=[m['snapshotPath'] for m in reused.values() if not m['retrievalTimeKnown']],inputs=[dict(path=p,sha256=sha(p)) for p in inputs],scope='候補4施設の数値・同一建物確認、192件の排他分類。188件の位置確定や全URL再取得を意味しない。'))
print('targets',len(T),'updates',len(updates),'unresolved',len(unresolved),'snapshots',len(reused))
