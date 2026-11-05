"""Reproduce fragment and audit from immutable inputs and explicitly read decisions."""
import json,pathlib,re,urllib.parse,html,hashlib,sys
from decisions import D
ROOT=pathlib.Path('data/evidence/national/kanto-north')
X=json.load(open('data/work/national-input/full.json'));Q=json.load(open('data/work/national-input/quality.json'))
M=json.load(open(ROOT/'manifest.json'));BY={r['url']:r for r in M};P={p['id']:p for p in X['places']}
C=[c for c in X['cards'] if 8<=int(c['id'][:2])<=11]
def source(c,d):
 s=d.get('suffix') or urllib.parse.urldefrag((c.get('links')or[''])[-1])[0]
 rows=[r for r in M if r['url']==s] if s.startswith('http') else [r for r in M if r['url'].endswith(s)]
 if not rows:raise ValueError((c['id'],s))
 r=rows[0]
 for _ in range(4):
  if not r.get('snapshotPath'):break
  b=pathlib.Path(r['snapshotPath']).read_bytes();t=b.decode('utf-8','replace')
  red=re.search(r'content=[\'"]0;URL=([^\'\"]+)',t,re.I)
  if red:
   u=urllib.parse.urljoin(r.get('finalUrl',r['url']),html.unescape(red[1]));r=BY.get(u,r)
  else:break
 # 304/redirect-cache stores body; only adopt status200 or actual textual full response
 if not r.get('snapshotPath') or not 200<=r.get('status',0)<400:raise ValueError((c['id'],r))
 return r
from coordinates import COORD
from audit_notes import PENDING,EXTRA,PROPOSALS,REJECT
G=json.load(open(ROOT/'gkp-provenance.json'))
OLD=json.load(open('data/work/national-input/places.json'));OLDP={p['id']:p for p in OLD['places']}
MERGE={'place:2aa9d59c74e11dca842e':'place:da24aa34d750c88eacd3','place:4dec1c9260c0869acfdc':'place:b6090d3fae16925cdc4d'}
def evidence(row,loc,method):
 return {'sourceUrl':row.get('url',row.get('sourceUrl')),'snapshotPath':row['snapshotPath'],'snapshotSHA256':row['snapshotSHA256'],'sourceLocator':loc,'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':method}
def attempt(u,purpose):
 u=urllib.parse.urldefrag(u)[0];row=BY.get(u)
 if not row:return {'url':u,'purpose':purpose,'result':'not-fetched','reason':'保存済み取得記録なし。閲覧成功とは数えない。'}
 out={k:row[k] for k in ['url','finalUrl','fetchedAt','status','error','snapshotPath','snapshotSHA256'] if k in row}
 out['purpose']=purpose;out['result']='retrieved' if 200<=row.get('status',0)<300 else 'failed';return out
places={};rels=[];cards=[]
for c in C:
 cid=c['id'];d=D.get(cid);src=source(c,d) if d else None
 rs=[r for r in X['relations'] if r['cardId']==cid]
 urls=list(dict.fromkeys([urllib.parse.urldefrag(u)[0] for u in c.get('links')or[]]+EXTRA.get(cid,[])+([src['url']] if src else [])))
 for link in json.load(open(ROOT/'discovered-links.json')):
  if link['from'] in urls and any(k in link['label'] for k in ['アクセス','地図','施設案内']):
   u=urllib.parse.urldefrag(link['url'])[0]
   if u in BY and u not in urls:urls.append(u)
 card={'cardId':cid,'state':'partial','sourceHash':Q['sourceHashes'][cid],'relations':[],'sourceUrls':urls,'attempts':[attempt(u,'公式配布案内・施設情報の確認') for u in urls],'remainingReason':PENDING.get(cid,'')}
 if cid in PROPOSALS:
  card['proposals']=[dict(p,sourceUrls=urls,evidence=evidence(src,cid+' 配布場所・代替配布窓口','AIが公式本文と旧抽出窓口を比較。新規・分割候補であり台帳の承認関係ではない。')) if src else dict(p,sourceUrls=urls) for p in PROPOSALS[cid]]
 for i,r in enumerate(rs):
  oldpid=r['placeId'];old=P[oldpid];coord=COORD.get((cid,i));reason='';adopt=bool(d) and i not in d.get('skip',[])
  if not adopt:reason=(d.get('note') if d else PENDING.get(cid,''))
  else:
   # Stable IDs preserve already approved facilities and deliberately merge only established synonyms.
   pid=oldpid if oldpid.startswith('facility:') else 'facility:kanto-north-'+MERGE.get(oldpid,oldpid).split(':')[1]
   addr=d.get('addresses',{}).get(i,old['address'])
   if not addr:adopt=False;reason='施設住所が入力にも公式確認結果にも無いため、必須住所を推測せず台帳施設作成保留。'
  locstate='unlocated'; diststate='pending'
  if adopt:
   if oldpid in OLDP:place=dict(OLDP[oldpid]);locstate='confirmed' if place.get('coordinate') else 'unlocated'
   else:
    identitysrc=src if i in d.get('addresses',{}) else G
    place={'id':pid,'legacyIds':[oldpid],'name':old['name'],'address':addr,'phone':old.get('phone',''),'evidence':evidence(identitysrc,cid+' / '+old['name']+' / 配布場所','AIが現行自治体・施設の配布先名称とGKP原典窓口を照合。住所は原典表記を維持（明示訂正は別記）。施設座標は未承認。')}
   if coord:
    cr=BY[coord['url']];assert 200<=cr['status']<300
    place['coordinate']={'lat':coord['lat'],'lng':coord['lng']}
    place['evidence']=evidence(cr,coord['locator'],'AIが公式原本中の施設名・住所と目的地座標（q/destination/Marker.position）を照合。建物代表点であり室内窓口・階・入口の実測点ではない。現地・人手確認ではない。')
    locstate='confirmed'
   if pid in places:
    for alias in place['legacyIds']:
     if alias not in places[pid]['legacyIds']:places[pid]['legacyIds'].append(alias)
   else:places[pid]=place
   hs=d['hours'];hs=hs[i] if hs and isinstance(hs[0],list) else hs
   status=d.get('statuses',[d['status']]*len(rs))[i]
   rel={'cardId':cid,'placeId':pid,'sourceHash':Q['sourceHashes'][cid],'hours':hs,'status':status,'evidence':evidence(src,cid+' / '+old['name']+' / 配布場所・配布時間・在庫状況','AIが保存済み公式本文（画像・PDFは記載欄）をカード図柄・施設・曜日条件ごとに照合。'+d.get('note',''))}
   if 'reviewUntil'in d:rel['reviewUntil']=d['reviewUntil']
   if 'conditions'in d:rel['condition']=d['conditions'][i]
   rels.append(next((o for o in OLD['relations'] if o['cardId']==cid and o['placeId']==pid),rel));diststate=status
   if locstate!='confirmed':reason=REJECT.get(cid,'')+' '+old['name']+'：配布先は照合済みだが、上記公式取得原本から施設名・住所に対応する目的地座標を確定できず位置未承認。'
   if i in d.get('incompleteHours',[]):reason+=' 配布時刻の独立明記なし。施設営業時間を配布時間へ置換せず、公式問い合わせを要する。'
  ar={'legacyPlaceId':oldpid,'locationState':locstate,'distributionState':diststate,'sourceUrls':urls.copy(),'attempts':[attempt(u,'配布先・条件・座標の確認') for u in urls],'remainingReason':reason.strip()}
  if adopt:ar['facilityId']=pid;ar['distributionEvidence']=rel['evidence'];ar['hoursState']='partial' if i in d.get('incompleteHours',[]) else 'verified';ar['note']=d.get('note','')
  if coord and adopt:
   ar['coordinateScope']='building-representative-point';ar['coordinateEvidence']=places[pid]['evidence'];ar['sourceUrls'].append(coord['url']);ar['attempts'].append(attempt(coord['url'],'施設名・住所に対応する公式目的地座標の確認'))
  if oldpid in OLDP and adopt:ar['coordinateScope']='existing-approved-evidence';ar['coordinateEvidence']=places[pid]['evidence']
  card['relations'].append(ar)
 if cid.startswith('09-213'):
  card['state']='ended';card['sourceUrls'].append(G['sourceUrl']);card['endEvidence']=evidence(G,cid+' tr / 配布終了 / 問合せ先','AIが統合担当取得済み現行GKP原本の該当2行を確認。旧広報は配布開始資料であり再開根拠にしない。');card['attempts'].append({'url':G['sourceUrl'],'result':'provided-snapshot-inspected','snapshotPath':G['snapshotPath'],'snapshotSHA256':G['snapshotSHA256']})
 elif not d:card['state']='partial' if cid in ('10-210-A001','11-246-A001') else 'pending'
 elif all(x['distributionState']=='ended' for x in card['relations']):card['state']='ended'
 elif all(not x['remainingReason'] for x in card['relations']) and cid not in PROPOSALS:card['state']='verified'
 if not card['remainingReason']:
  card['remainingReason']=' / '.join(x['remainingReason'] for x in card['relations'] if x['remainingReason'])
  if cid in PROPOSALS:card['remainingReason']+=' 新規・分割窓口proposalは未統合。'
 cards.append(card)
ledger={'schema':1,'places':list(places.values()),'relations':rels}
summary={'assignedCards':len(C),'assignedRelations':sum(len(c['relations']) for c in cards),'cardsWithMunicipalOrFacilityDecision':len(D),'ledgerFacilities':len(places),'ledgerRelations':len(rels),'facilitiesWithCoordinates':sum('coordinate'in p for p in places.values()),'newlyConfirmedCoordinates':len(COORD),'pendingRelations':sum(r['distributionState']=='pending' for c in cards for r in c['relations']),'unlocatedRelations':sum(r['locationState']=='unlocated' for c in cards for r in c['relations']),'cardStates':{s:sum(c['state']==s for c in cards) for s in ['verified','partial','pending','ended']}}
audit={'schema':1,'region':'kanto-north','checkedAt':'2026-11-05','summary':summary,'cards':cards}
for name,obj in [('data/overrides/regions/kanto-north.json',ledger),('data/national/regions/kanto-north.json',audit)]:
 p=pathlib.Path(name);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
(ROOT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False,indent=2))
