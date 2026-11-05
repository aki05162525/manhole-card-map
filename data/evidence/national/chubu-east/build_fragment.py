#!/usr/bin/env python3
"""Reproduce reviewed region output. No network; decisions.py is the review input."""
import json,hashlib,re,urllib.parse,collections
from pathlib import Path
import research as r,decisions as d
ROOT=r.ROOT
F=r.FULL; P={p['id']:p for p in F['places']}; C=d.C
Q=json.load(open('data/work/national-input/quality.json'))['sourceHashes']
G=json.load(open(ROOT/'gkp-source.json'))
existing=json.load(open('data/work/national-input/places.json'))
existingAliases={x:p['id'] for p in existing['places'] for x in p['legacyIds']}
rels={cid:[x for x in F['relations'] if x['cardId']==cid] for cid in C}
def lid(cid,i=0):return rels[cid][i]['placeId']
merge={}
def same(*ids):
 for x in ids:merge[x]=ids[0]
same(lid('17-204-A001'),lid('17-204-B001'))
same(lid('16-201-A001',1),lid('16-201-I001',1))
same(lid('20-203-A001'),lid('20-203-D001'))
same(lid('19-204-A001'),lid('19-204-B001'))
same(lid('20-541-A001'),lid('20-541-B001'))
same(lid('20-541-A001',1),lid('20-541-B001',1))
same(lid('20-208-A001'),lid('20-208-B001',1))
same(lid('20-208-A001',1),lid('20-208-B001',2))
fix={}
def edit(cid,i=0,**kw):fix.setdefault(lid(cid,i),{}).update(kw)
edit('17-204-A001',name='輪島市上下水道局 1階窓口')
edit('16-201-A001',1,address='富山県富山市新富町一丁目2-3 CiCビル3階',phone='076-444-0642')
edit('15-210-B001',1,address='新潟県十日町市芋川乙3267')
edit('19-212-A001',1,address='山梨県上野原市新田946')
edit('19-210-A001',address='山梨県甲斐市篠原2534番地1 水道事務所2階')
edit('15-202-C001',address='新潟県長岡市大手通2丁目2番地6')
edit('15-204-A001',name='三条鍛冶道場')
edit('15-000-A001',name='新潟県下水道公社 新潟浄化センター管理棟2階事務室')
edit('15-405-A001',name='道の駅 越後出雲崎天領の里 時代館受付')
edit('16-321-A001',1,name='舟橋会館 事務室窓口')
edit('20-214-A001',phone='0266-73-8550')
edit('20-000-C001',name='千曲川流域下水道事務所 アクアパル千曲管理本館1階')
for cid,base in [('17-384-A001','志賀町役場本庁舎 '),('20-000-E001','クリーンピア千曲管理本館 '),('20-451-A001','朝日村役場 ')]:
 for i in [1,2]:edit(cid,i,name=base+P[lid(cid,i)]['name'])
coords={}
def coord(cid,needle,lat,lng,locator,i=0):
 u=d.url(needle);m=r.cache[u];raw=Path(m['snapshotPath']).read_text(errors='replace')
 assert str(lat) in raw and str(lng) in raw,(cid,'missing literal')
 coords[lid(cid,i)]={'coordinate':{'lat':lat,'lng':lng},'url':u,'locator':locator}
coord('15-206-A001','1007617.html',37.94918869339952,139.32347180019232,'まちなか観光案内所 / 地図を表示する href q')
coord('15-206-B001','1012314.html',37.945816,139.329525,'寺町たまり駅 / 地図を表示する href q')
coord('15-206-C001','1017916.html',37.88075,139.30752,'月岡温泉旅館協同組合 / 地図を表示する href q')
coord('16-209-A001','1002218.html',36.689582,136.876902,'配布場所（道の駅メルヘンおやべ）地図情報 href q。蓋設置場所の別リンクは不採用')
coord('16-209-B001','1002218.html',36.672752,136.865633,'配布場所（石動駅観光案内所）地図情報 href q。蓋設置場所の別リンクは不採用')
coord('17-201-A001','detail_50571.html',36.566466808519834,136.653702490213,'金沢中央観光案内所 / 住所 南町4-1 / #gMap place?q')
coord('20-361-A001','1615253324806',36.07211801629327,138.08479327596896,'御柱祭マンホールカード 配布場所 / 下諏訪観光案内所 / iframe q')
coord('20-361-B001','1615253324806',36.07562161860838,138.089438223915,'秋宮カード 配布場所 / しもすわ今昔館おいでや / iframe q')
coord('20-361-C001','1615253324806',36.081369,138.080955,'春宮カード 配布場所 / おんばしら館よいさ / iframe q')
coord('20-452-A001','hpdsp.jp/tokura1000yu',36.413249,138.008294,'交通アクセス / 西条温泉とくら / 西条3443 / Google Map href q')
coord('19-204-A001','1000nentsuru.com/',35.58293924922538,138.9310603404991,'JSON-LD TouristDestination name=道の駅つる geo。本文住所=都留市大原88',i=1)
coord('15-223-A001','spot/7381',37.80254651,139.2892238,'五頭山麓うららの森 情報発信館 / 村杉温泉入口 / geo and #mapEmbed place?q')
coord('16-201-G001','www.yatsuo.net',36.5760742,137.1305947,'seo.context businessName=越中八尾観光協会 / businessLocationFormatted=八尾町上新町2898-1 / businessLocationCoordinates')

def evidence(u,loc,method):
 m=r.cache[u] if u!=G['url'] else G
 return {'sourceUrl':u,'snapshotPath':m['snapshotPath'],'snapshotSHA256':m['sha256'],'sourceLocator':loc,'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':method}
def evdist(cid,dec):
 loc=f'{cid} / 配布場所・配布時間・休館日・在庫状況（PDFの場合1ページ）'
 method='AIが公式配布案内を読み、基礎入力のカードと各窓口の名称・住所・配布条件を照合。人・現地確認ではない。'
 if dec.get('gkpHours'):method+=' 時間の補足は監査supplementaryEvidenceのGKP配布時間欄を併読。施設営業時間の自動流用はしない。'
 return evidence(dec['url'],loc,method)
ledger={'schema':1,'places':[],'relations':[]}; audit={'schema':1,'region':'chubu-east','checkedAt':'2026-11-05','cards':[]}
fp={}; matched=set()
for cid,c in sorted(C.items()):
 dec=d.D[cid];source=dec['url'];ce=evdist(cid,dec)
 urls=list(dict.fromkeys([urllib.parse.urldefrag(u)[0] for u in c.get('links') or []]+[source]+d.DISCOVERY.get(cid,[])))
 card={'cardId':cid,'state':'partial','relations':[],'sourceUrls':urls,'remainingReason':d.NOTES.get(cid,''),'proposals':d.PROPOSALS.get(cid,[])}
 card['attempts']=[{k:r.cache[u][k] for k in ['url','fetchedAt','status','error','finalUrl','snapshotPath','sha256'] if k in r.cache[u]} for u in urls if u in r.cache]
 # GKP is supplemental association/hour source; never used for destination coordinates.
 card['supplementaryEvidence']=[evidence(G['url'],f'当該自治体・カード {cid} の表行 配布場所・配布時間','AIが2026-11-05統合担当取得済みHTMLと基礎入力を照合。取得時刻は提供記録待ち。')]
 for i,rr in enumerate(rels[cid]):
  old=rr['placeId'];canonical=merge.get(old,old);p=P[canonical]
  pending=dec.get('pending')
  hs=d.MULTI.get(cid,[dec['hours']]*len(rels[cid]))[i]
  if hs is None:pending=d.NOTES[cid]
  cr=coords.get(canonical)
  us=urls+([cr['url']] if cr and cr['url'] not in urls else [])
  attempts=[]
  for u in us:
   m=r.cache.get(u)
   if m:attempts.append({k:m[k] for k in ['url','fetchedAt','status','error','finalUrl','snapshotPath','sha256'] if k in m})
  reason=pending or ('' if cr else f'配布施設「{p["name"]}」の窓口・条件は公式案内と照合済み。閲覧した公式資料で、この施設に対応すると承認できる目的地座標を確定できず座標を省略。')
  if not cr and 'matsumoto' in source:reason+=' 観光協会ページの構造化座標は施設ではなく「松本市」を指すため不採用。'
  if cid=='15-224-G001':reason+=' 移転前の佐渡博物館の地図を新配布先に流用しない。'
  maprefs=[]
  for u in us:
   m=r.cache.get(u,{})
   if m.get('status')==200 and m.get('snapshotPath','').endswith('.html'):
    raw=Path(m['snapshotPath']).read_bytes();links=r.parse(raw).links
    found=[x for x in links if any(t in x.lower() for t in ['maps.google','google.com/maps','goo.gl/maps','maps.app.goo.gl'])]
    maprefs.append({'sourceUrl':u,'mapLinkCount':len(found),'mapLinks':[re.sub(r'([?&]key=)[^&]+',r'\1[omitted]',x) for x in list(dict.fromkeys(found))], 'result':'名称・住所と施設目的地点を照合し座標採用' if cr and u==cr['url'] else '配布情報・施設同定の参考。ここにある地図リンクはこの関係の座標根拠として未採用。'})
  ar={'legacyPlaceId':old,'locationState':'pending' if pending else ('verified' if cr else 'unlocated'),'distributionState':'pending' if pending else dec['status'],'sourceUrls':us,'attempts':attempts,'remainingReason':reason,'locationEvidenceReview':maprefs}
  if not pending:
   fid=existingAliases.get(old,'facility:chubu-east-'+canonical.split(':')[1]);ar['facilityId']=fid
   if fid not in fp:
    pd={k:p.get(k,'') for k in ['name','address','phone']};pd.update(fix.get(canonical,{}))
    pd.update(id=fid,legacyIds=[],evidence=ce)
    if cid.startswith(('20-209','20-211')):
     pd['evidence']=evidence(G['url'],f'{cid} / 旧窓口情報を含む配布場所欄','AIがGKP記載施設名・住所と自治体の配布終了または移転告知を併読。座標は未承認。')
    if cid=='15-202-C001':
     oldmeta=json.load(open(ROOT/'gkp-baseline-nagaoka-c-source.json'));pd['evidence']={'sourceUrl':oldmeta['url'],'snapshotPath':oldmeta['snapshotPath'],'snapshotSHA256':oldmeta['sha256'],'sourceLocator':'長岡市C001旧窓口の配布場所欄。2026-10-21保存原本tr bytes抽出','checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'AIが旧原本の旧窓口名称住所と現市公式11/2移転告知を併読。旧施設は終了、座標未承認。'}
    if cr:
     pd['coordinate']=cr['coordinate'];pd['evidence']=evidence(cr['url'],cr['locator'],'AIが公式目的地の座標と名称・住所を配布先に対応照合。建物・施設代表点であり室内カウンターの測位ではない。営業時間の根拠には使わない。')
    fp[fid]=pd
   if old not in fp[fid]['legacyIds']:fp[fid]['legacyIds'].append(old)
   lr={'cardId':cid,'placeId':fid,'sourceHash':Q[cid],'hours':hs,'condition':'','status':dec['status'],'evidence':ce}
   for k in ['validFrom','validTo','reviewUntil']:
    if k in dec:lr[k]=dec[k]
   key=(cid,fid);assert key not in matched,key;matched.add(key);ledger['relations'].append(lr)
  card['relations'].append(ar)
 if dec.get('pending'):card['state']='pending'
 elif dec['status']=='ended' and not card['proposals']:card['state']='ended'
 elif all(a['locationState']=='verified' for a in card['relations']) and not card['remainingReason'] and not card['proposals']:card['state']='verified'
 if not card['remainingReason']:card['remainingReason']='; '.join(dict.fromkeys(a['remainingReason'] for a in card['relations'] if a['remainingReason']))
 audit['cards'].append(card)
ledger['places']=sorted(fp.values(),key=lambda x:x['id'])
# Every fetched URL, including supplemental discovery paths, stays in manifest.json.
for dest,obj in [('data/overrides/regions/chubu-east.json',ledger),('data/national/regions/chubu-east.json',audit)]:
 path=Path(dest);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'cards':len(C),'inputRelations':sum(map(len,rels.values())),'facilities':len(fp),'approvedRelations':len(ledger['relations']),'coordinates':sum('coordinate'in p for p in fp.values()),'cardStates':dict(collections.Counter(c['state'] for c in audit['cards']))},ensure_ascii=False))
