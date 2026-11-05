"""Build a separate Issue #5 candidate report. Never write baseline or regional inputs."""
import json,hashlib,pathlib,copy,zipfile,io,datetime,re
R=pathlib.Path('data/evidence/issue5/north'); OUT=pathlib.Path('data/national/issue5/north.json')
def read(p):return json.loads(pathlib.Path(p).read_text())
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def write(p,d):pathlib.Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def walk(x):
 if isinstance(x,dict):
  yield x
  for v in x.values():yield from walk(v)
 elif isinstance(x,list):
  for v in x:yield from walk(v)
l=read('data/work/issue5-baseline/ledger.json');places={p['id']:p for p in l['places']};rels={}
for r in l['relations']:
 if r['cardId'][:2] in ('01','02','03','04','05','06','07'):rels.setdefault(r['placeId'],[]).append(r)
target={i:places[i] for i in sorted(rels) if not places[i].get('coordinate')}
hr=read('data/national/reviews/north-hokkaido.json');hu=read('data/national/location-updates/north-hokkaido.json');tu=read('data/national/location-updates/north-tohoku.json');ti=read('data/national/tohoku-location-integration.json')
oldrows={x['facilityId']:x for x in hr['reviews']+hr['unresolvedReviews']+tu['unresolved']}
oldupdates={x['facilityId']:x for x in hu['updates']+tu['updates']}
cs={x['facilityId']:x for x in read('data/national/location-updates/official-facility-index.json')['candidates']}
inputs=['data/work/issue5-baseline/ledger.json','data/work/issue5-baseline/full.json','data/work/issue5-baseline/manifest.json','data/national/reviews/north-hokkaido.json','data/national/location-updates/north-hokkaido.json','data/national/location-updates/north-tohoku.json','data/national/location-updates/official-facility-index.json','data/national/tohoku-location-integration.json','data/overrides/regions/north.json','data/overrides/proposals/north.json']
write(R/'input-hashes.json',[{'path':p,'sha256':sha(p)} for p in inputs])
# Original retrieval metadata is inherited; an unknown retrieval time is never synthesized.
metadata={}
for p in list(pathlib.Path('data/evidence/national').glob('**/*manifest.json'))+list(pathlib.Path('data/evidence/national/official-facility-index').glob('*.source.json')):
 try:
  for x in walk(read(p)):
   path=x.get('snapshotPath',x.get('path'))
   if path and (x.get('fetchedAt') or x.get('savedAt')):metadata[path]={**x,'retrievalRecord':str(p)}
 except (ValueError,UnicodeError):pass
fresh=read(R/'fetch-records.json')+read(R/'fetch-support-records.json')
for x in fresh:metadata[x.get('snapshotPath','')]=x
byurl={x['url']:x for x in fresh if x.get('snapshotPath')}
reused={}
def preserve(e):
 e=copy.deepcopy(e);src=e.get('snapshotPath',e.get('path'))
 if not src:return e
 expected=e.get('snapshotSHA256',e.get('sha256'));assert pathlib.Path(src).exists(),src
 h=sha(src);assert not expected or h==expected,(src,h,expected)
 if src.startswith(str(R)+'/'):return e
 dst=R/'originals'/(h+pathlib.Path(src).suffix);dst.parent.mkdir(exist_ok=True)
 if not dst.exists():dst.write_bytes(pathlib.Path(src).read_bytes())
 m=metadata.get(src,{})
 reused[src]={'sourcePath':src,'snapshotPath':str(dst),'snapshotSHA256':h,'url':e.get('sourceUrl',e.get('url',m.get('url'))),'fetchedAt':m.get('fetchedAt'),'savedAt':m.get('savedAt'),'retrievalRecord':m.get('retrievalRecord'),'finalUrl':m.get('finalUrl'),'timeNote':'元の実取得時刻を保持。不明値はnull。再利用を再取得とはしない。'}
 e['snapshotPath']=str(dst);e['snapshotSHA256']=h
 return e
def evfresh(url,locator):
 x=byurl[url];return {'sourceUrl':url,'snapshotPath':x['snapshotPath'],'snapshotSHA256':x['snapshotSHA256'],'sourceLocator':locator,'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'AIが取得した公式本文の配布先・住所・建物名を照合。現地確認ではない。'}
def dist(fid):return [preserve(x['evidence']) for x in rels[fid]]
updates=[];audits={};corrections=[]
# Four metadata corrections: retain exact old/new; original files remain untouched.
for c in hr['exactCorrections']:
 fid=c['facilityId'];u=copy.deepcopy(oldupdates[fid]);rr=oldrows[fid]
 if c['field']=='name':assert places[fid]['name']==c['old']
 else:
  assert u['evidence']['verificationMethod']==c['old'];u['evidence']['verificationMethod']=c['new']
 u['evidence']=preserve(u['evidence']);u['scope']='building';updates.append(u)
 evidence=[preserve(x) for x in rr['evidence']]
 corrections.append({**c,'evidence':evidence,'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'旧レビューの完全old値を原候補または固定ledgerに再照合し、原本hash・公式リンクと施設目的地数値を再検証。','sourceLocator':rr['sourceLocator']})
 audits[fid]={'method':'metadata-correction','buildingIdentity':rr['reason'],'sourceCoordinate':rr['proposedCoordinate'],'sourceLocator':rr['sourceLocator'],'evidence':evidence,'distributionEvidence':dist(fid),'licenseAndCrs':'公式の施設目的地リンク。Google地図の測地系を地図表示の緯度経度として扱い測量精度は主張しない。CC BYデータとは扱わない。第三者地図由来の利用条件を親が確認すること。'}
# P05-22 uses an independent, newer CC BY 4.0 source; no re-licensing of H22/H25/H26.
zmeta=read('data/evidence/national/official-facility-index/P05-22_GML.zip.source.json')
zref=preserve({'sourceUrl':zmeta['url'],'snapshotPath':zmeta['path'],'snapshotSHA256':zmeta['sha256']})
z=zipfile.ZipFile(zref['snapshotPath'])
policy=[]
for file in ['p05.html','p05-license.html','p05-spec.pdf','gsi-mapsheet-faq.html']:
 m=read('data/evidence/national/official-facility-index/'+file+'.source.json');policy.append(preserve({'sourceUrl':m['url'],'snapshotPath':m['path'],'snapshotSHA256':m['sha256']}))
P='facility:north-'
configs=[
('12b6e6080ef6e1e816a7','12b6e6080ef6e1e816a7','https://www.city.bibai.hokkaido.jp/site/suidou/29785.html','https://www.city.bibai.hokkaido.jp/soshiki/18/','市役所上下水道課窓口。現配布表の西3条南1-1-1とP05美唄市役所が一致。庁舎案内PDFの1階上下水道課を照合。'),
('proposal-bibai-duty','12b6e6080ef6e1e816a7','https://www.city.bibai.hokkaido.jp/site/suidou/29785.html','https://www.city.bibai.hokkaido.jp/soshiki/18/','配布表が同住所の市役所当直室を明記。庁舎案内PDFも1階当直室を示し、本庁舎建物の点を使用。'),
('3060a04659dcedce64b9','3060a04659dcedce64b9','https://www.city.kitami.lg.jp/administration/life/detail.php?content=9605','https://www.city.kitami.lg.jp/administration/detail.php?content=8822','現配布案内は常呂総合支所内・当直室（正面玄関右横階段下）を明記。P05常呂総合支所・常呂323と接続。'),
('33d210dca3f1918726f9','33d210dca3f1918726f9','https://www.city.kitami.lg.jp/administration/life/detail.php?content=9605','https://www.city.kitami.lg.jp/administration/detail.php?content=8822','現配布案内は常呂総合支所内の常呂上下水道課窓口。総合支所施設案内も常呂323でP05同一建物名と一致。'),
('343aa74f33ff03c6fa0a','343aa74f33ff03c6fa0a','https://www.hakobura.jp/features/56','https://hakomachi.com/','函館公式観光案内の地域交流まちづくりセンター1階カウンター、末広町4-19と現指定管理者の施設名住所を照合。P05の同センター点。'),
('c5a98d056047559d8981','c5a98d056047559d8981','https://www.city.koriyama.lg.jp/site/jougesuidou/5690.html','https://www.city.koriyama.lg.jp/soshiki/185/index-2.html','特定環境保全公共下水道カードの湖南公民館・福良字家老9390-4が現配布本文と公民館案内で一致。P05同公民館点。駅前の蓋位置は不使用。'),
('564d6cb018ca701ab673','564d6cb018ca701ab673','https://www.city.fukushima-date.lg.jp/soshiki/25/68027.html','https://www.city.fukushima-date.lg.jp/soshiki/30/index-2.html','現配布本文と梁川総合支所案内の青葉町1が一致。P05梁川総合支所点。市本庁舎の舟橋180は問い合わせ先であり不使用。'),
('716c305f4ea78c959505','564d6cb018ca701ab673','https://www.city.fukushima-date.lg.jp/soshiki/25/68027.html','https://www.city.fukushima-date.lg.jp/soshiki/30/index-2.html','公式が観光案内所を梁川総合支所1階と明記。P05支所建物点を使用。名称の似た別の観光施設を採らない。')]
for short,base,url,support,note in configs:
 fid=P+short;d=cs[P+base]['datasetPoint'];zz,memberloc=d['locator'].split('!');member,index=memberloc.split('#/features/');bb=zipfile.ZipFile(io.BytesIO(z.read(zz))).read(member);assert hashlib.sha256(bb).hexdigest()==d['memberSHA256'];features=json.loads(bb);feature=features['features'][int(index)];assert feature==d['rawFeature'];co={k:d['coordinate'][k] for k in ['lat','lng']};assert feature['geometry']['coordinates']==[co['lng'],co['lat']]
 e={**zref,'sourceLocator':d['locator'],'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':note+' 国土数値情報P05-22の建物外周内検査仕様に基づく建物代表点。緯度経度の原数値を保持（EPSG:6668/JGD2011、原配列は経度・緯度）。2022年4月基準と現行公開案内を照合。室内位置の測量ではない。'}
 updates.append({'facilityId':fid,'coordinate':co,'scope':'building','evidence':e})
 evidence=[evfresh(url,'配布場所・施設名・番地・対象窓口'),evfresh(support,'施設名・所在地')]
 if 'bibai' in short or short.startswith('12b6'):evidence.append(evfresh('https://www.city.bibai.hokkaido.jp/uploaded/attachment/6449.pdf','1階庁舎案内：上下水道課・当直室'))
 audits[fid]={'method':'P05-22','buildingIdentity':note,'sourceCoordinate':co,'datasetPoint':d,'evidence':evidence,'distributionEvidence':dist(fid),'datasetEvidence':policy,'license':'CC BY 4.0 / 国土交通省 国土数値情報（市町村役場等及び公的集会施設 2022）','crs':'EPSG:6668 / JGD2011','relocationReview':'現行公式案内で同一名称・住所の対象建物を確認。参照した現行案内に移転・別棟指定なし。無告知の同住所建替えまで保証しない。'}
# Additional proposal counters explicitly located inside an already identified building.
shared=[('proposal-ishidoriya-duty','8da9db2c5cc58d40b221','公式配布表は石鳥谷総合支所1階警備員室・八幡第4地割161と明記。'),('proposal-ohasama-duty','008e2585ad57dd933bf1','公式配布表は大迫総合支所1階警備員室・大迫第2地割51番地4と明記。'),('proposal-motomiya-guard','0028d3c0cf4b1c5c46ea','公式配布案内は本宮市役所の休日警備員室、西側ATM裏入口と明記。別棟の記載なし。'),('proposal-otaru-duty','dc7b25bac2387c1d4172','公式配布案内は水道局本庁舎の休日1階当直室と明記。市役所本館の点ではない。')]
for short,base,note in shared:
 fid=P+short;b=P+base;assert places[b].get('coordinate');u=copy.deepcopy(oldupdates[b]);u['facilityId']=fid;u['scope']='building';u['evidence']=preserve(u['evidence']);u['evidence']['verificationMethod']=note+' '+u['evidence']['verificationMethod'];updates.append(u)
 audits[fid]={'method':'same-building-explicit','buildingIdentity':note,'sourceFacilityId':b,'sourceCoordinate':u['coordinate'],'sourceLocator':u['evidence']['sourceLocator'],'distributionEvidence':dist(fid),'licenseAndCrs':'既存の公式施設マーカーを使用。第三者地図由来の場合はCC BYとは扱わない。地図表示用緯度経度で室内の実測を主張しない。'}
# Google response extraction is not automatically reusable as an independent mapping dataset.
terms=read(R/'terms-fetch-record.json')
termsev={'sourceUrl':terms['url'],'snapshotPath':terms['snapshotPath'],'snapshotSHA256':terms['snapshotSHA256'],'checkedAt':'2026-11-05','actorType':'ai','sourceLocator':'Restrictions on Use / copy the content; mapping-related dataset','verificationMethod':'Google Maps追加規約の複製・地図データセット関連制限を確認。公式リンクであることだけでは独立台帳への再利用許諾を証明しない。違法性は断定しない。'}
licenseheld={u['facilityId']:u for u in updates if 'google.' in u['evidence']['sourceUrl'] or 'goo.gl' in u['evidence']['sourceUrl']}
updates=[u for u in updates if u['facilityId'] not in licenseheld]
for fid in licenseheld:
 audits[fid]['decision']='coordinate-identified-license-unresolved'
 audits[fid]['licenseEvidence']=termsev
# Each remaining ID retains the actual old reason; proposal gaps are distinguished from failed fetches.
selected={u['facilityId'] for u in updates};unresolved=[];classification=[]
for fid,p in target.items():
 evid=[preserve(p['evidence'])]+dist(fid);old=oldrows.get(fid,{})
 for e in old.get('evidence',[]):
  if e.get('snapshotPath'):evid.append(preserve(e))
 if fid in oldupdates:evid.append(preserve(oldupdates[fid]['evidence']))
 if fid in selected:
  classification.append({'facilityId':fid,'name':p['name'],'cardIds':sorted({r['cardId'] for r in rels[fid]}),'classification':'candidate','review':audits[fid]});continue
 reason=ti['deferred'].get(fid,old.get('reason'))
 if fid in licenseheld:
  reason='施設建物と原典数値の対応は再検証済み。Google Maps応答から取得した座標について、独立した地図台帳への再利用許諾は確認できない。公式がリンクしたことは座標の再配布ライセンスではないため保留。説明・名称の訂正は別途correctionsに保持。'
  evid.append(termsev)
 if not reason:
  reason='追加proposalの配布先・施設住所の証拠は存在するが、当該建物の数値原典と利用条件・測地系・移転後の建物同一性の照合は未完了。近隣施設や住所中心で補完しない。'
 extra={}
 if fid in licenseheld:extra['unapprovedCandidate']=licenseheld[fid]
 if fid==P+'5146ae8cc4fb697aa46b':
  reason+=' 追加確認：市公式新庁舎建設事業は2022-09-26開庁を明示。P05-22の2022年4月基準より後であり、P05同住所点も新庁舎点と証明できない。'
  evid.append(evfresh('https://www.city.furano.hokkaido.jp/life/docs/2020061000014.html','新庁舎が令和4年9月26日開庁'))
 if fid in cs:extra['unapprovedP05Candidate']=cs[fid]['datasetPoint']
 if fid in oldupdates:extra['unapprovedOldCoordinate']=oldupdates[fid]['coordinate']
 n={'facilityId':fid,'reason':reason,'nextSource':{'url':rels[fid][0]['evidence']['sourceUrl'],'needed':'この配布案内に対応する現施設の建物名付き公式座標・庁舎/敷地配置図。既存理由の移転・番地・別棟・利用条件を解決してから再判定。'},'evidence':evid,'checkedAt':'2026-11-05','actorType':'ai','sourceLocator':'固定ledgerのfacilityIdとcardId、旧地域レビューの同facilityId','verificationMethod':'旧保留理由と固定ledgerの所属関係・証拠hashを再確認。全件の新規Web取得・建物同定完了を意味しない。','priorReview':old,'attempts':old.get('attempts',[]),**extra}
 if fid in licenseheld:
  n['nextSource']['needed']='自治体が独立に公開する施設建物の座標原本・再利用可能な公式GIS、またはGoogle由来データを当該台帳で再利用できる明示許諾。Googleへの再取得を繰り返しても許諾問題は解決しない。'
 unresolved.append(n);classification.append({'facilityId':fid,'name':p['name'],'cardIds':sorted({r['cardId'] for r in rels[fid]}),'classification':'unresolved','reason':reason})
oldpolicy=copy.deepcopy(hr['licenseAndCrsReview'])
for e in walk(oldpolicy):
 if e.get('snapshotPath') and e.get('snapshotSHA256'):e.update(preserve(e))
result={'schema':1,'region':'north','updates':sorted(updates,key=lambda x:x['facilityId']),'unresolved':unresolved,'corrections':corrections}
write(OUT,result);write(R/'classification.json',classification);write(R/'candidate-audit.json',audits);write(R/'original-records.json',list(reused.values()));write(R/'policy.json',{'policyEvidence':policy,'oldLicenseAndCrsReview':oldpolicy,'documentCodeDiscrepancies':hr['documentCodeDiscrepancies'],'notes':['H25/P27、H26/P34、H22/P05をP05-22のCC BY 4.0に読み替えない。','対象全件の分類完了と座標全件確定は別。未解決IDの新規調査をすべて実施したとは主張しない。','Google由来点は親の利用条件レビュー対象。自動manifest採用禁止。']})
print('targets',len(target),'updates',len(updates),'unresolved',len(unresolved),'corrections',len(corrections),'originals',len(reused))
