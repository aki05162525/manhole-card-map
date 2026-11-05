#!/usr/bin/env python3
"""Offline evidence, reference, preservation and real-build output checks."""
import json,pathlib,hashlib,sys,re,collections
ROOT=pathlib.Path('data/evidence/national/proposals-north')
sys.path.insert(0,'data/evidence/national/north');from read_sources import text
read=lambda p:json.load(open(p))
L=read('data/overrides/proposals/north.json');A=read('data/national/regions/north.json');D=read(ROOT/'decisions.json');B=read('/tmp/north-proposals-build/full.json');base=read('/tmp/north-proposal-current/full.json');merged=read('/tmp/north-proposals-merged.json')
q=read('/tmp/north-proposal-current/quality.json')['sourceHashes']; aliases={i:p['id'] for p in merged['places'] for i in p['legacyIds']}
keys=lambda rows:{(r['cardId'],r['placeId']) for r in rows}
assert len(keys(L['relations']))==len(L['relations'])
assert len({p['id'] for p in L['places']})==len(L['places'])
assert all('coordinate' not in p for p in L['places'])
assert all(r['sourceHash']==q[r['cardId']] for r in L['relations'])
manifest={r['snapshotPath']:r for p in ['data/evidence/national/north/manifest.json',str(ROOT/'manifest.json')] for r in read(p) if r.get('snapshotPath')}
evidence_count=0
for obj in L['places']+L['relations']:
 e=obj['evidence'];evidence_count+=1
 assert hashlib.sha256(pathlib.Path(e['snapshotPath']).read_bytes()).hexdigest()==e['snapshotSHA256']
 assert manifest[e['snapshotPath']]['status']==200
 assert e['actorType']=='ai'
 if 'change' in obj:
  t=text(dict(e,status=200));norm=lambda s:re.sub(r'\s','',s)
  for quote in obj['change']['raw']:assert norm(quote) in norm(t),(obj['cardId'],quote)
  for old in obj['change']['previousPlaceIds']:assert (obj['cardId'],old) in keys(base['relations'])
  assert (obj['cardId'],obj['placeId']) in keys(B['relations'])
# No source relation deleted: aliasing canonicalizes references but preserves every card/old-place link.
assert {(r['cardId'],aliases.get(r['placeId'],r['placeId'])) for r in base['relations']} <= keys(B['relations'])
proposal_cards={c['cardId'] for c in A['cards'] if c['proposals']}
adopted={d['cardId'] for d in D if d['state']=='adopted'} & proposal_cards
held={d['cardId'] for d in D if d['state']=='held'}
assert proposal_cards==adopted|held and not adopted&held
original_unresolved=[(c['cardId'],r['legacyPlaceId']) for c in A['cards'] for r in c['relations'] if not r.get('facilityId')]
assert set(original_unresolved)<={(d['cardId'],d['legacyPlaceId']) for d in D if 'legacyPlaceId' in d}
expected={'full.json':'6068da023f3bd4cb1e292b3e43877411a1505356e4377bbf02a255a89afb1987','quality.json':'8561505b9c8c0426fae93bf35306bd53f324e75527b842986da3d1df7b31012b','places.json':'152bb738c77e95fcbd54702e42a2107cfd5949d614c7e6b4a706c94cba2a41fe'}
for p,h in expected.items():assert hashlib.sha256(pathlib.Path('data/work/national-input',p).read_bytes()).hexdigest()==h
new=[r for r in L['relations'] if 'change' in r];old=[r for r in L['relations'] if 'change' not in r]
report=dict(proposalCards=len(proposal_cards),proposalCardsAdopted=len(adopted),proposalCardsHeld=len(held),additionalRelations=len(new),newlyAdoptedExistingRelations=len(old),existingRelationStatus=dict(collections.Counter(r['status'] for r in old)),ledgerPlaces=len(L['places']),coordinatesAdded=0,evidenceRecordsValidated=evidence_count,originalUnresolvedRows=len(original_unresolved),allOldRelationsPreserved=True,immutableInputHashes=expected,realBuild=dict(cards=len(B['cards']),places=len(B['places']),relations=len(B['relations'])),note='元の誤抽出・重複見出し削除案は親レビュー用。実ビルドでは削除していない。')
# Temporal behavior from actual Go outputs, not a duplicated status implementation.
temporal=[]
for directory,expected in [('/tmp/north-proposals-build','upcoming'),('/tmp/north-proposals-nov10','active'),('/tmp/north-proposals-dec01','ended')]:
 data=read(directory+'/full.json');rel=next(r for r in data['relations'] if r['cardId']=='01-487-C001' and r['placeId']=='facility:north-fc46386371945051a55a')
 assert rel['status']==expected
 card=next(c for c in data['cards'] if c['id']=='01-487-C001');assert card['status']!='ended'
 temporal.append(dict(asOf=data['evaluatedAt'],teshioTemporary=rel['status'],teshioCard=card['status']))
dec=read('/tmp/north-proposals-dec01/full.json');f=next(r for r in dec['relations'] if r['cardId']=='07-201-B001');assert f['review']=='needs-review' and f['status']=='unknown'
report['temporalChecks']=temporal;report['fukushimaDecember']='unknown / needs-review; no assumed reopening'
(ROOT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
