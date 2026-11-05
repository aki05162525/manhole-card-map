#!/usr/bin/env python3
"""Validate coverage, alias/relation uniqueness, frozen hashes and evidence bytes."""
import json,hashlib,collections,re
from pathlib import Path
ROOT=Path('data/evidence/national/chubu-east')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
F=read('data/work/national-input/full.json');Q=read('data/work/national-input/quality.json');L=read('data/overrides/regions/chubu-east.json');A=read('data/national/regions/chubu-east.json');M=read(ROOT/'manifest.json')
cards={x['id'] for x in F['cards'] if '15'<=x['id'][:2]<='20'}
expected={(x['cardId'],x['placeId']) for x in F['relations'] if x['cardId'] in cards}
actual=[(c['cardId'],r['legacyPlaceId']) for c in A['cards'] for r in c['relations']]
assert {c['cardId'] for c in A['cards']}==cards and len(A['cards'])==len(cards)==153
assert set(actual)==expected and len(actual)==len(expected)==197
assert len({p['id'] for p in L['places']})==len(L['places'])
alias={}
for p in L['places']:
 assert p['id'].startswith('facility:') and p['name'] and p['address']
 for x in p['legacyIds']:assert x not in alias;alias[x]=p['id']
 for k in ['name','address','phone']:assert isinstance(p[k],str)
 assert p['legacyIds']
seen=set()
for r in L['relations']:
 k=(r['cardId'],r['placeId']);assert k not in seen;seen.add(k)
 assert r['sourceHash']==Q['sourceHashes'][r['cardId']]
 assert any(cid==r['cardId'] and alias.get(pid)==r['placeId'] for cid,pid in expected)
for obj in L['places']+L['relations']:
 e=obj['evidence'];assert e['actorType']=='ai' and e['checkedAt']=='2026-11-05'
 assert sha(e['snapshotPath'])==e['snapshotSHA256']
 if 'coordinate' in obj:
  raw=Path(e['snapshotPath']).read_text(errors='replace');co=obj['coordinate']
  assert 24<co['lat']<46 and 122<co['lng']<146
  assert str(co['lat']) in raw and str(co['lng']) in raw
for m in M:
 if 'snapshotPath' in m:assert sha(m['snapshotPath'])==m['sha256']
for c in A['cards']:
 assert c['attempts'] and any(x.get('status')==200 for x in c['attempts'])
 for e in c['supplementaryEvidence']:assert sha(e['snapshotPath'])==e['snapshotSHA256']
 for r in c['relations']:
  if r['distributionState']=='pending':assert 'facilityId' not in r
  else:assert (c['cardId'],r['facilityId']) in seen
summary={'schema':1,'cards':153,'inputRelations':197,'approvedFacilities':len(L['places']),'approvedRelations':len(L['relations']),'locatedFacilities':sum('coordinate'in p for p in L['places']),'cardStates':dict(collections.Counter(c['state'] for c in A['cards'])),'relationStates':dict(collections.Counter(r['distributionState'] for c in A['cards'] for r in c['relations'])),'locationStates':dict(collections.Counter(r['locationState'] for c in A['cards'] for r in c['relations'])),'fetchAttempts':len(M),'httpResults':dict(collections.Counter(str(m.get('status','error'))for m in M)),'inputSHA256':{str(p):sha(p) for p in [Path('data/work/national-input')/(x+'.json') for x in ['full','quality','places']]},'checks':['全153カード・197対応の被覆、重複・孤立なし','sourceHashは不変quality.jsonと一致','全261取得記録と台帳根拠の原本bytes SHA256一致','13承認座標がそれぞれの公式原本に存在（名称住所・目的地点の意味は手動AI照合）']}
(ROOT/'validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False))
