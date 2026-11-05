"""Offline reconstruction from immutable baseline, cached raw evidence and reviewed decisions."""
import json, pathlib, hashlib, re, unicodedata
from decisions import DECISIONS
from coordinates import COORDINATES
from remaining import REMAINING
ROOT=pathlib.Path('data/evidence/national/chugoku-shikoku')
D=json.load(open('data/work/national-input/full.json'));Q=json.load(open('data/work/national-input/quality.json'))
BASE=json.load(open('data/work/national-input/places.json'))
CS={c['id']:c for c in D['cards'] if 31<=int(c['id'][:2])<=39};PS={p['id']:p for p in D['places']}
M={m['url']:m for m in json.load(open(ROOT/'manifest.json'))}
existing={lid:p['id'] for p in BASE['places'] for lid in [p['id']]+p.get('legacyIds',[])}
def source(d):return CS[d['cardId']]['links'][d['source']] if isinstance(d['source'],int) else d['source']
def evidence(u,locator,method):
 m=M[u];assert m.get('status')==200,(u,m)
 assert hashlib.sha256(pathlib.Path(m['snapshotPath']).read_bytes()).hexdigest()==m['sha256']
 return dict(sourceUrl=u,snapshotPath=m['snapshotPath'],snapshotSHA256=m['sha256'],sourceLocator=locator,checkedAt='2026-11-05',actorType='ai',verificationMethod=method)
def attempt(u):
 m=M.get(u)
 if not m:return dict(url=u,result='not-fetched')
 return dict(url=u,result='HTTP '+str(m['status']) if 'status' in m else m['error'],**{k:m[k] for k in ['fetchedAt','finalUrl','snapshotPath','sha256'] if k in m})
def norm(s):return re.sub(r'\s+','',unicodedata.normalize('NFKC',s))
ledger=dict(schema=1,places=[],relations=[]);audit=dict(schema=1,region='chugoku-shikoku',checkedAt='2026-11-05',actorType='ai',cards=[])
facilities={};used=set()
for cid,c in CS.items():
 ca=dict(cardId=cid,state='pending',relations=[],sourceUrls=[],remainingReason='')
 ds=[d for d in DECISIONS if d['cardId']==cid]
 urls=list(dict.fromkeys((c.get('links') or [])+[source(d) for d in ds]+REMAINING.get(cid,('',[]))[1]))
 ca['sourceUrls']=urls;ca['attempts']=[attempt(u) for u in urls]
 for r in D['relations']:
  if r['cardId']!=cid:continue
  p=PS[r['placeId']];matches=[d for d in ds if re.search(d['match'],p['name']) and not re.search(d.get('exclude','(?!)'),p['name'])]
  assert len(matches)<=1,(cid,p,matches)
  ra=dict(legacyPlaceId=p['id'],baselineName=p['name'],locationState='unknown',distributionState='pending',sourceUrls=urls,attempts=[attempt(u) for u in urls],remainingReason='')
  if not matches:
   assert cid in REMAINING,(cid,p)
   ra['remainingReason']=REMAINING[cid][0];ca['relations'].append(ra);continue
  d=matches[0];used.add(id(d));u=source(d);name=d.get('name',p['name']);address=d.get('address',p.get('address',''));phone=d.get('phone',p.get('phone',''))
  ev=evidence(u,'本文のマンホールカード配布場所・配布時間・在庫案内／'+name+'／'+cid,'AIが公式配布案内と原入力の施設・窓口を照合し、カード別の配布状態・条件を確認。現地・人手確認ではない。座標の承認は別の施設根拠による。')
  key=(norm(name),norm(address));fid=existing.get(p['id']) or 'facility:cs-'+hashlib.sha256(('\0'.join(key)).encode()).hexdigest()[:18]
  if fid not in facilities:
   facilities[fid]=dict(id=fid,legacyIds=[],name=name,address=address,phone=phone,evidence=ev)
  fp=facilities[fid]
  if p['id'] not in fp['legacyIds']:fp['legacyIds'].append(p['id'])
  co=COORDINATES.get(cid)
  if co and re.search(co[0],p['name']):
   _,cu,lat,lng,loc=co;raw=pathlib.Path(M[cu]['snapshotPath']).read_bytes()
   assert str(lat).encode() in raw and str(lng).encode() in raw,(cid,'point absent')
   fp['coordinate']={'lat':lat,'lng':lng};fp['evidence']=evidence(cu,loc,'AIが公式施設ページの名称・住所を既存配布窓口と照合し、目的地指定または構造化された施設の緯度経度を採用。施設・建物の代表点であり、室内受付カウンターの精密位置ではない。住所ジオコード、地図中心、蓋の座標は不使用。')
   ra['locationState']='verified-building-point';ra['coordinateScope']='facility/building representative point; indoor counter not surveyed'
   if cu not in ra['sourceUrls']:ra['sourceUrls']=ra['sourceUrls']+[cu];ra['attempts']=ra['attempts']+[attempt(cu)]
  rel=dict(cardId=cid,placeId=fid,sourceHash=Q['sourceHashes'][cid],hours=d['hours'],status=d['status'],evidence=ev)
  for k in ['condition','validFrom','validTo','reviewUntil']:
   if k in d:rel[k]=d[k]
  ledger['relations'].append(rel);ra['facilityId']=fid;ra['distributionState']='verified';ra['status']=d['status']
  if any(t in '|'.join(d['hours']) for t in ['記載なし','記載を確認できず','明記なく','本文に具体','本文に明記','要確認','独立記載','独立した記載','独立した明記','独立記載はなく','要問い合わせ']):ra['distributionState']='partial';ra['remainingReason']='配布場所・状態は確認済み。カード受付時間・休日条件の未確定部分：'+'／'.join(d['hours'])
  if ra['locationState']=='unknown':ra['remainingReason']+=(' ' if ra['remainingReason'] else '')+'取得済み公式原典内の目的地座標・施設構造化地点を探索したが、名称住所と対応確認できる地点を確定できず。施設座標は未承認。'
  if d.get('proposal'):ra['proposals']=[dict(reason=d['proposal'],sourceUrl=u,snapshotPath=M[u]['snapshotPath'],snapshotSHA256=M[u]['sha256'])];ra['remainingReason']+=' '+d['proposal']
  ca['relations'].append(ra)
 for d in ds:
  if id(d) not in used:
   used.add(id(d));u=source(d)
   ca.setdefault('proposals',[]).append(dict(kind='additional-counter',namePattern=d['match'],hours=d['hours'],status=d['status'],reason='原入力のraw内に併記された別窓口で独立legacy関係がない。既存窓口への誤対応を避け、追加施設・関係として統合担当へ提案。'+d.get('proposal',''),evidence=evidence(u,'マンホールカードの配布場所・代替窓口／'+d['match'],'AIが公式本文の別窓口と条件を確認。legacy関係不足のため提案のみ。')))
 ca['sourceUrls']=list(dict.fromkeys(u for r in ca['relations'] for u in r['sourceUrls']))
 if ca['relations'] and all(r.get('status')=='ended' for r in ca['relations']):ca['state']='ended'
 elif ca['relations'] and all(r['distributionState']=='verified' and r['locationState']=='verified-building-point' and not r.get('proposals') for r in ca['relations']) and not ca.get('proposals'):ca['state']='verified'
 elif any(r['distributionState']!='pending' for r in ca['relations']):ca['state']='partial'
 ca['remainingReason']='／'.join(dict.fromkeys(r['remainingReason'] for r in ca['relations'] if r['remainingReason']))
 if ca.get('proposals'):ca['remainingReason']+=' 原入力で未分離の追加窓口提案あり。'
 audit['cards'].append(ca)
assert len(used)==len(DECISIONS),[(d['cardId'],d['match']) for d in DECISIONS if id(d) not in used]
ledger['places']=list(facilities.values())
assert len({r['cardId']+'|'+r['placeId'] for r in ledger['relations']})==len(ledger['relations'])
assert len({lid for p in ledger['places'] for lid in p['legacyIds']})==sum(len(p['legacyIds']) for p in ledger['places'])
assert set(p['id'] for p in ledger['places'])==set(r['placeId'] for r in ledger['relations'])
audit['summary']={'assignedCards':len(CS),'auditedCards':len(audit['cards']),'assignedRelations':sum(len(c['relations']) for c in audit['cards']),'ledgerFacilities':len(ledger['places']),'ledgerRelations':len(ledger['relations']),'confirmedCoordinates':sum('coordinate'in p for p in ledger['places']),'distributionPendingRelations':sum(r['distributionState']=='pending' for c in audit['cards'] for r in c['relations']),'distributionPartialRelations':sum(r['distributionState']=='partial' for c in audit['cards'] for r in c['relations']),'cardsByState':{s:sum(c['state']==s for c in audit['cards']) for s in ['verified','partial','pending','ended']}}
for dest,val in [('data/overrides/regions/chugoku-shikoku.json',ledger),('data/national/regions/chugoku-shikoku.json',audit)]:
 p=pathlib.Path(dest);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(val,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(audit['summary'],ensure_ascii=False,indent=2))
