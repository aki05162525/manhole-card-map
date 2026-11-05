"""Reproduce reviewed outputs; no network calls. Run from repository root."""
from decisions import *
import collections,subprocess
Q=json.load(open('data/work/national-input/quality.json'))
OLD=json.load(open('data/work/national-input/places.json'))
G={x['cardId']:x for x in json.load(open(ROOT/'gkp-manifest.json'))}
MC={e['url']:e for e in M}
cs=[c for c in D['cards'] if '40'<=c['id'][:2]<='47']; ids={c['id'] for c in cs}
rs=[r for r in D['relations'] if r['cardId'] in ids]
existing={a:p for p in OLD['places'] for a in p['legacyIds']}
# Same ballpark, same explicitly named distribution desk in municipal table.
canon={'place:69faf5d82ddc02075730':'place:6f3f17db75d830d03ed7'}
def canonical(p):return canon.get(p,p)
def fid(p):return existing[p]['id'] if p in existing else 'facility:kyushu-'+canonical(p).split(':')[1]
def ev(page,loc,method):
 e=M[page];assert e.get('status')==200
 return dict(sourceUrl=e['url'],snapshotPath=e['snapshotPath'],snapshotSHA256=e['snapshotSHA256'],sourceLocator=loc,checkedAt='2026-11-05',actorType='ai',verificationMethod=method)
ledger={'schema':1,'places':[],'relations':[]}; ps={}
for r in rs:
 cid,pid=r['cardId'],r['placeId'];d=REV.get((cid,pid))
 if not d:continue
 p=PLACES[pid]; f=fid(pid)
 loc=f"{cid} / マンホールカード配布場所・配布日時 / {p['name']}"+(' / PDF 1ページの当該デザイン行' if d['page']==239 else '')
 if f not in ps:
  pp={k:p.get(k,'') for k in ('name','address','phone')};pp.update(id=f,legacyIds=[pid])
  if pid=='place:a4cd93cc1425ac573ac5':pp.update(name='小林市役所上下水道課 第2別館2階下水道グループ',address='宮崎県小林市細野300番地',phone='0984-23-0312')
  if cid=='46-215-A001':pp['phone']='0996-23-9889'
  if cid=='47-313-A001':pp['address']='沖縄県国頭郡宜野座村字漢那1633番地'
  if pid in COORD:
   co=COORD[pid];pp['coordinate']={k:co[k] for k in ('lat','lng')};pp['evidence']=ev(co['page'],co['locator'],'AIが公式の施設名称・住所と目的地座標または明示Marker位置を照合。建物代表点であり室内窓口の実測位置ではない。現地確認・人による確認ではない。')
  else:pp['evidence']=ev(d['page'],loc,'AIが配布先名称・原典の住所情報と公式配布案内を照合。施設状態のみの採用。公式目的地座標は未確定のためcoordinateを設定しない。現地確認ではない。')
  ps[f]=pp
 elif pid not in ps[f]['legacyIds']:ps[f]['legacyIds'].append(pid)
 rel=dict(cardId=cid,placeId=f,sourceHash=Q['sourceHashes'][cid],hours=d['hours'],status=d['status'],condition='配布条件・対象日はこの関係の配布時間欄および公式確認先を参照。',evidence=ev(d['page'],loc,'AIがカード別配布施設・曜日・時間・状態を公式本文で照合。営業時間だけから配布時間を推定しない。'+NOTES.get(cid,'')))
 for k in ('reviewUntil','validFrom','validTo'):
  if k in d:rel[k]=d[k]
 ledger['relations'].append(rel)
ledger['places']=list(ps.values())
# Every input relation is represented even if its official page could not be fetched.
audit={'schema':1,'region':'kyushu-okinawa','checkedAt':'2026-11-05','cards':[]}
for c in cs:
 cid=c['id']; cr=[r for r in rs if r['cardId']==cid]; ds=[REV[(cid,r['placeId'])] for r in cr if (cid,r['placeId']) in REV]
 urls=list(dict.fromkeys((c['links'] or [])+EXTRA.get(cid,[])+[M[d['page']]['url'] for d in ds]+[M[COORD[r['placeId']]['page']]['url'] for r in cr if r['placeId'] in COORD]))
 attempts=[]
 for u in urls:
  if u in MC:
   e=MC[u];attempts.append({**e,'result':'原本取得（下記判断参照）' if e.get('status')==200 else '取得失敗・承認根拠には不使用'})
 a=dict(cardId=cid,state='partial' if ds else 'pending',relations=[],sourceUrls=urls+['https://www.gk-p.jp/mhcard/'],attempts=attempts,gkpEvidence=G[cid],remainingReason=NOTES.get(cid,''),proposals=PROPOSALS.get(cid,[]))
 for r in cr:
  pid=r['placeId'];d=REV.get((cid,pid));co=COORD.get(pid)
  reason=[]
  if not d:reason.append(NOTES.get(cid,'公式根拠でこのカードの窓口条件を確定できない。'))
  if not co:reason.append(f"{PLACES[pid]['name']}：配布施設の目的地座標を示す公式地図リンク・位置構造化データの確認未完了。蓋座標と地図表示中心は採用しない。")
  if d and any('明記なし' in h or '要問い合わせ' in h for h in d['hours']):reason.append('配布時間の一部は公式本文に明記がなく、関係・状態のみ確認。')
  if cid in NOTES and d:reason.append(NOTES[cid])
  rr=dict(legacyPlaceId=pid,locationState='confirmed' if co else 'unconfirmed',distributionState='verified' if d else 'pending',sourceUrls=urls,attempts=attempts,remainingReason=' '.join(reason))
  if d:rr.update(facilityId=fid(pid),status=d['status'],hours=d['hours'],sourceHash=Q['sourceHashes'][cid])
  if co:rr['coordinateScope']='建物代表点。窓口の階・室内位置は配布条件を参照。'
  a['relations'].append(rr)
 if cid=='40-130-B001' or (ds and len(ds)==len(cr) and all(d['status']=='ended' for d in ds)):a['state']='ended'
 elif cr and all(r['locationState']=='confirmed' and r['distributionState']=='verified' for r in a['relations']) and not a['proposals'] and not a['remainingReason']:a['state']='verified'
 if not a['remainingReason'] and a['state']=='partial':a['remainingReason']='配布条件の公式照合済み。未確定の施設位置と追加窓口は各関係・proposalを参照。'
 audit['cards'].append(a)
summary=dict(cards=len(cs),inputRelations=len(rs),officialDistributionConfirmedRelations=len(REV),adoptedFacilities=len(ps),confirmedCoordinates=sum('coordinate'in p for p in ps.values()),unresolvedDistributionRelations=len(rs)-len(REV),unconfirmedLocationRelations=sum(r['placeId'] not in COORD for r in rs),cardStates=dict(collections.Counter(c['state'] for c in audit['cards'])),proposalCount=sum(len(v) for v in PROPOSALS.values()),fetchAttempts=len(M),successfulFetches=sum(e.get('status')==200 for e in M))
audit['summary']=summary
for path,obj in [('data/overrides/regions/kyushu-okinawa.json',ledger),('data/national/regions/kyushu-okinawa.json',audit),(str(ROOT/'summary.json'),summary)]:
 p=Path(path);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(summary,ensure_ascii=False,indent=2))
