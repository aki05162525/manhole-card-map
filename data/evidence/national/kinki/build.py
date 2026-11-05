"""Reproduce the Kinki fragment from immutable baseline and explicit reviewed decisions.
Run from repository root: python data/evidence/national/kinki/build.py
Never approves fetched pages automatically; decisions.py and approved_coordinates.py are review inputs.
"""
import json,pathlib,hashlib,collections,urllib.parse
from decisions import DECISIONS
from relation_hours import H
from approved_coordinates import COORDINATES, DMS_COORDINATES
R=pathlib.Path('data/evidence/national/kinki')
full=json.load(open('data/work/national-input/full.json')); quality=json.load(open('data/work/national-input/quality.json'))
cards=[c for c in full['cards'] if '24'<=c['id'][:2]<='30']; cp={c['id']:c for c in cards}; base={p['id']:p for p in full['places']}
rels=[r for r in full['relations'] if r['cardId'] in cp]; ms={m['url']:m for m in json.load(open(R/'manifest.json'))}; candidates=json.load(open(R/'coordinate-candidates.json'))
assert len(cards)==191 and len(rels)==263 and set(cp)==set(DECISIONS)
# Explicit identity merges, reviewed same physical counter; do not merge different floors/windows.
groups=[['129ffa1ab731e3dda85e','6b223834d1d20ac42d00'],['efdb8ded331038c52b06','ea29752d2aa0d101e6bf'],['989d5e47870093dfad9c','c21e85daab2bdd58d4f2'],['981f92e7ecb53d46d9ca','e6b0ae7612b51c2f669e'],['ce0f123ef5e185dce8c9','869d62037545d82e7fa3'],['5ef4b8538c8df02b55f4','2a93872bfc0b665b05f1'],['677fb9a18c933486a439','6e82fd6da022cb804e43'],['608e56a7ed0f7036b2a5','25c64819200f5c4b3c74'],['52945aa1816499e04704','0c299f4b7c2b47e4eb76'],['c5d10ff37b683a499161','5f81bd4a275725429d9d'],['9f39963fd788d29d7a00','9f4b65105dd72b2a9f6e'],['aa58d39ff7470acf878c','d429237e18b13845834b'],['e5b8e80cdd4564099f87','3dbfbd267a4410f311b2']]
alias={ 'place:'+a:'place:'+g[0] for g in groups for a in g }
# Building headings accidentally extracted separately from two genuine windows.
excluded={ 'place:'+p:'建物見出しの独立抽出。同じカードの平日窓口・休日窓口を個別採用し、建物を第三窓口にしない。' for p in ['3b4cbb23cc2491bc7452','a98778ce41a9719c6619','409a7670d18868d73e02']}
excluded.update({'place:23e5e276a7868c21e7a0':'現行公式ははびきのビジターセンター。旧古市駅前観光案内所との同一性・住所対応が未確定。新窓口proposal。','place:82667b8bd5200610cbd7':'現行配布先は樽井1-1-1市役所別館2階。旧樽井737の窓口へ誤対応できないため移転proposal。'})
fix={
 'place:65bebcfcae7710dc09bc':{'address':'大阪府高槻市野見町6-8'},
 'place:879b3bf5b89bc880cf5a':{'address':'京都府京都市右京区太秦安井一町田町14'},
 'place:18b924bdc253e8565fd8':{'address':'兵庫県川西市中央町12番1号 市役所3階13番'},
 'place:9f39963fd788d29d7a00':{'name':'加東市役所 商工観光課（3階）','address':'兵庫県加東市社50番地','phone':'0795-43-0530'},
 'place:87988ebfde4fcebbf78a':{'name':'豊能町役場 本庁舎3階 建設課（都市計画グループ）','address':'大阪府豊能郡豊能町余野414-1'},
 'place:e8f5928bb47e34e7e8d4':{'name':'わかやま歴史館 2階歴史展示室','address':'和歌山県和歌山市一番丁3番地'},
 'place:e5b8e80cdd4564099f87':{'name':'大阪府立狭山池博物館 受付','address':'大阪府大阪狭山市池尻中二丁目'},
 'place:5d377b6a926c0d1e6fa1':{'name':'京都府立洛西浄化センター公園 サービスセンター管理棟'},
 'place:c75fe5e57c94810e2724':{'name':'日本のへそ日時計の丘公園オートキャンプ場 管理棟'},
 'place:0f86b9f28ca3800b81c4':{'name':'芦屋市役所 北館地下1階警備室'},
 'place:5cade60bb6200407cec5':{'name':'芦屋市役所 東館1階下水道課'},
 'place:65aca194bc92a930cdd3':{'name':'市川町役場 当直室（東玄関呼出）'},
 'place:90a0a649350346399dcc':{'phone':'0594-21-5416'},
 'place:d8ae994ed35d69a0dfb1':{'phone':'072-937-2321'},
 'place:c5cb26a1af3a611b70b7':{'phone':'0794-72-0180'},
}
for id in ['place:507fc6c8fa978e4618f2','place:6f8549ee753cbea13b34']:fix[id]={'address':'大阪府四條畷市中野本町1-1'}
# Supplemental evidence read in addition to the primary distribution article.
extra={
 '26-208-A001':['https://www.city.muko.kyoto.jp/uploaded/image/5644.jpg'],
 '26-208-B001':['https://www.city.muko.kyoto.jp/uploaded/image/5643.jpg'],
 '27-100-B001':[u for u in ms if 'clearwater-osaka.jp/%e5%96%b6' in u],
 '28-207-B001':['http://itami-kankou.com/gallery'], '28-207-C001':['http://itami-kankou.com/gallery'],
 '27-231-A001':['https://sayamaikehaku.osakasayama.osaka.jp/?p=6824','https://sayamaikehaku.osakasayama.osaka.jp/?page_id=49'],
 '27-231-B001':['https://sayamaikehaku.osakasayama.osaka.jp/?p=6824','https://sayamaikehaku.osakasayama.osaka.jp/?page_id=49'],
 '28-214-A001':['http://www.city.takarazuka.hyogo.jp/suido/1001460/1030074.html'],
 '29-344-A001':['https://ikaruga-kanko.com/news/details.php?pid=1791782102'],
 '27-362-A001':['https://tajiri-tourism.com/']}
# Additional counters cannot be silently mapped onto legacy IDs. Parent integration proposals only.
proposals={
 '24-202-C001':['土日祝：四日市市上下水道局 夜間休日窓口（堀木一丁目3-18）、8:30～17:15、年末年始除く。'],
 '25-206-A001':['交流館休館時の市役所2階上下水道総務課。9:00～16:45、12/29～1/3ほか指定日を除く。'],
 '26-100-A001':['上下水道局総合庁舎の休日守衛室。総合受付と別窓口。'],
 '26-344-A001':['宇治田原町総合文化センター事務室（岩山沼尻46-1）。9～17時、火曜・12/28～1/4休館。'],
 '27-215-A001':['休日1階窓口は未抽出（現行在庫切れ休止）。'],
 '27-222-A001':['はびきのビジターセンター。9～17時、木曜（祝日は営業）・12/29～1/3休業。旧窓口との同一性未確定。'],
 '27-227-A001':['土日祝：市役所22階展望ロビー9～23時。13階とは別窓口。'],
 '27-228-A001':['火水：泉南市役所別館2階下水道課（樽井1-1-1）9～17:30。旧樽井737とは別の移転先。'],
 '27-230-A001':['上下水道部1階の平日窓口と休日警備員室の分割を要する。'],
 '27-321-A001':['閉庁日：本庁舎1階警備室、9～17:30。3階建設課とは別窓口。'],
 '27-362-A001':['田尻町観光協会（りんくうポート北1）。町公式配布9～17時に対し施設営業時間9～15時。追加と時間相違の解決が必要。'],
 '28-203-A001':['天文科学館休館日：あかし案内所。受付時間・座標は要追加確認。'],
 '28-207-B001':['土日祝：観光物産ギャラリー仮設店舗（旧伊丹市演劇ホール喫茶店跡）。2026/9/14移転、JR伊丹駅から200m。'],
 '28-207-C001':['観光物産ギャラリー仮設店舗（旧伊丹市演劇ホール喫茶店跡）。2026/9/14移転、旧駅構内へ誤対応禁止。'],
 '28-216-A001':['高砂市役所本庁舎3階12番 上下水道部経営総務室。平日8:30～17:15、12/29～1/3除く。'],
 '28-443-A001':['フクちゃんプラザ9～19時、年末年始ほか臨時休館。サキちゃんプラザ平日10～17時、土日祝10～18時、水曜・年末年始ほか休館。'],
 '29-205-A001':['今井まちづくりセンター（今井町3丁目8番8号）、2026/10/1から移転、9～16:30、12/29～1/3休業。'],
 '29-363-A001':['唐古・鍵遺跡史跡公園内 遺構展示情報館9～16:30。追加窓口・座標確認。']}
# Preserve established IDs if a facility was previously approved.
pilot=json.load(open('data/work/national-input/places.json')); existing={a:p['id'] for p in pilot['places'] for a in p.get('legacyIds',[])}
def fid(a):return existing.get(a,'facility:kinki-'+a.split(':')[1])
def evidence(u,loc,method):
 m=ms[u];assert m.get('status')==200,(u,m)
 return dict(sourceUrl=u,snapshotPath=m['snapshotPath'],snapshotSHA256=m['snapshotSHA256'],sourceLocator=loc,checkedAt='2026-11-05',actorType='ai',verificationMethod=method)
ledger={'schema':1,'places':[],'relations':[]}; audit={'schema':1,'region':'kinki','checkedAt':'2026-11-05','cards':[]};places={};seen=set()
for c in cards:
 id=c['id'];d=DECISIONS[id];urls=list(dict.fromkeys((c.get('links') or [])+[d['url']]+extra.get(id,[])));ar=[]
 for r in [a for a in rels if a['cardId']==id]:
  old=r['placeId'];a=alias.get(old,old);p=base[a];reason=excluded.get(old,'');coord=COORDINATES.get(a, -1 if a in DMS_COORDINATES else None)
  attempts=[]
  for u in urls:
   m=ms.get(u)
   attempts.append({'url':u,'result':('HTTP '+str(m['status'])) if m and 'status'in m else m.get('error','未取得') if m else '外部Google Mapsリンク。施設公式の目的地座標ではないため根拠不採用',**({k:m[k] for k in ['fetchedAt','snapshotPath','snapshotSHA256'] if k in m} if m else {})})
  status=d['status'];hours=d['hours'] if d['hours'] is not None else c['hours'];condition=r.get('condition','')
  if id=='24-202-C001':condition='平日'
  if d.get('clearCondition'):condition='平日' if old=='place:0a1974237ea53d981c34' else '月火休館（祝日は開館）'
  if id=='28-207-B001' and old=='place:6239a33fa7de3d368fe8':hours=['平日9:00～17:30、12/29～1/3休業']
  if old=='place:50fd7780197e359a9c8e':status='ended';hours=['2026/9/14から仮設店舗へ移転。旧JR伊丹駅構内での配布なし。']
  if old=='place:87988ebfde4fcebbf78a':hours=['開庁日9:00～17:30'];condition='平日'
  if old=='place:395deea0ac07ef85eee7':condition='平日';hours=['平日8:30～17:15（年末年始除く）']
  if id=='27-227-A001':condition='平日';hours=['平日9:00～17:30（年末年始除く）']
  if id=='27-222-A001' and not reason:hours=['平日9:00～17:30（12/29～1/3休業）']
  if old=='place:aa58d39ff7470acf878c' or a=='place:aa58d39ff7470acf878c':condition='観光案内所の休館日';hours=['観光案内所休館日に配布。配布時刻は公式に未記載、訪問前に要確認。']
  if old=='place:de68c351a26249edcfe0':condition='開庁日の水曜または道の駅休業の平日'
  if id=='28-205-A001' and '965372' in old:condition='土日祝・年末年始'
  hours=H.get((id,old),hours)
  if reason:
   ar.append(dict(legacyPlaceId=old,locationState='unresolved',distributionState='unapproved',sourceUrls=urls,attempts=attempts,remainingReason=reason));continue
  ev=evidence(d['url'],'マンホールカード配布場所・配布時間・在庫/終了案内 / '+id,'AIが公式記載と不変入力のカード・窓口を照合。'+d['note'])
  if a not in places:
   lp=dict(id=fid(a),legacyIds=[v for v in base if alias.get(v,v)==a],name=p['name'],address=p['address'],phone=p.get('phone',''),evidence=ev);lp.update(fix.get(a,{}))
   if coord == -1:
    co=DMS_COORDINATES[a];conv=lambda v:v[0]+v[1]/60+v[2]/3600
    lp['coordinate']={'lat':conv(co['latParts']),'lng':conv(co['lngParts'])}
    lp['evidence']=evidence(co['url'],'配布場所・時間・座標 / '+p['name']+' / '+co['literal'],'AIが配布場所名・住所と同じ節に明示された度分秒座標を照合し十進法へ変換。カード画像の蓋座標を流用せず、施設代表点として扱う。')
   elif coord is not None:
    co=candidates[coord];lat,lng=co['coordinates'][0];lp['coordinate']={'lat':float(lat),'lng':float(lng)}
    lp['evidence']=evidence(co['url'],'施設名・住所 / '+co['label']+' / '+co['mapUrl'],'AIが施設名・住所と公式地図リンクの目的地座標を照合。地図表示中心や蓋の座標は不採用。建物・施設代表点であり室内窓口の厳密な位置ではない。')
   assert lp['address'],a
   places[a]=lp
  key=(id,fid(a));merged=key in seen
  if not merged:
   lr=dict(cardId=id,placeId=fid(a),sourceHash=quality['sourceHashes'][id],hours=hours,status=status,condition=condition,evidence=ev)
   if d.get('reviewUntil'):lr['reviewUntil']=d['reviewUntil']
   ledger['relations'].append(lr);seen.add(key)
  rem=[]
  if coord is None:rem.append(p['name']+'：配布情報は '+d['url']+' で確認。取得原本の地図リンク・位置記載から、この名称住所に対応する目的地座標を承認できず座標未設定。')
  if id in ['27-231-A001','27-231-B001'] and '博物館'in p['name']:rem.append('工事後の館内受付位置の詳細は未確定。')
  if id in proposals:rem.append('追加/移転/分割窓口のproposalあり。')
  if any('未記載'in h or '要確認'in h or '施設開館'in h for h in hours):rem.append('配布専用時間または最新休館日の確定が残る。')
  if status=='unknown':rem.append('季節配布の対象期間外。次期配布は再確認が必要。')
  ar.append(dict(legacyPlaceId=old,facilityId=fid(a),locationState='verified_building_point' if coord is not None else 'identified_unlocated',distributionState=status,sourceUrls=urls,attempts=attempts,remainingReason=' '.join(rem),reviewNote=d['note'],mergedDuplicate=merged))
 ac=dict(cardId=id,state='partial',relations=ar,sourceUrls=urls,remainingReason=' '.join(dict.fromkeys(a['remainingReason'] for a in ar if a['remainingReason'])))
 if all(a['distributionState']=='ended' for a in ar) and id not in proposals:ac['state']='ended'
 elif not ac['remainingReason']:ac['state']='verified'
 if id in proposals:ac['proposals']=[dict(kind='new_or_changed_counter',description=s,sourceUrls=[d['url']]+extra.get(id,[])) for s in proposals[id]]
 audit['cards'].append(ac)
ledger['places']=list(places.values())
# Validate hashes, references, immutable fingerprints, and exact destination coordinates in raw snapshot bytes.
for m in ms.values():
 if m.get('snapshotPath'):assert hashlib.sha256(pathlib.Path(m['snapshotPath']).read_bytes()).hexdigest()==m['snapshotSHA256']
for a,p in places.items():
 if 'coordinate'in p:
  b=urllib.parse.unquote(pathlib.Path(p['evidence']['snapshotPath']).read_text(errors='replace'))
  if a in DMS_COORDINATES:
   import html
   assert DMS_COORDINATES[a]['literal'] in html.unescape(b),a
  else:
   co=candidates[COORDINATES[a]]
   assert all(s in b for s in co['coordinates'][0]),a
assert len({p['id'] for p in ledger['places']})==len(places)
assert all(r['placeId'] in {p['id'] for p in ledger['places']} for r in ledger['relations'])
assert sum(len(a['relations']) for a in audit['cards'])==263
for r in ledger['relations']:assert r['sourceHash']==quality['sourceHashes'][r['cardId']]
for p in ['data/overrides/regions/kinki.json','data/national/regions/kinki.json']:pathlib.Path(p).parent.mkdir(parents=True,exist_ok=True)
pathlib.Path('data/overrides/regions/kinki.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n')
pathlib.Path('data/national/regions/kinki.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
summary=dict(cards=len(cards),baselineRelations=len(rels),approvedFacilities=len(places),approvedRelations=len(ledger['relations']),locatedFacilities=sum('coordinate'in p for p in places.values()),auditStates=dict(collections.Counter(a['state'] for a in audit['cards'])),relationStatuses=dict(collections.Counter(r['status'] for r in ledger['relations'])),excludedRelations=sum(a['distributionState']=='unapproved' for c in audit['cards'] for a in c['relations']),proposalCards=len(proposals),fetchedUrls=len(ms))
(R/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False,indent=2))
