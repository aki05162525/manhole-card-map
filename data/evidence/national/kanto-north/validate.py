"""Validate regional output coverage, immutable hashes and source bytes."""
import json,pathlib,hashlib,re,urllib.parse,collections
ROOT=pathlib.Path('data/evidence/national/kanto-north')
L=json.load(open('data/overrides/regions/kanto-north.json'));A=json.load(open('data/national/regions/kanto-north.json'));X=json.load(open('data/work/national-input/full.json'));Q=json.load(open('data/work/national-input/quality.json'));M=json.load(open(ROOT/'manifest.json'))
cs={c['id'] for c in X['cards'] if 8<=int(c['id'][:2])<=11};assert cs=={c['cardId'] for c in A['cards']};assert len(cs)==len(A['cards'])
original={(r['cardId'],r['placeId']) for r in X['relations'] if r['cardId'] in cs};audited={(c['cardId'],r['legacyPlaceId']) for c in A['cards'] for r in c['relations']};assert original==audited
ids=[p['id'] for p in L['places']];assert len(ids)==len(set(ids));aliases=[a for p in L['places'] for a in p['legacyIds']];assert len(aliases)==len(set(aliases))
keys=[(r['cardId'],r['placeId']) for r in L['relations']];assert len(keys)==len(set(keys));assert set(ids)=={r['placeId'] for r in L['relations']}
for r in L['relations']:assert r['sourceHash']==Q['sourceHashes'][r['cardId']]
checks=0
for r in M:
 if r.get('snapshotPath'):
  assert hashlib.sha256(pathlib.Path(r['snapshotPath']).read_bytes()).hexdigest()==r['snapshotSHA256'];checks+=1
for obj in L['places']+L['relations']:
 e=obj['evidence'];b=pathlib.Path(e['snapshotPath']).read_bytes();assert hashlib.sha256(b).hexdigest()==e['snapshotSHA256'];assert e['actorType']=='ai';assert e['checkedAt']=='2026-11-05';assert e['sourceLocator'] and e['verificationMethod']
 if 'coordinate'in obj:
  t=urllib.parse.unquote(b.decode('utf-8','replace'))
  for v in obj['coordinate'].values():assert str(v) in t,(obj['id'],v)
  assert -85<obj['coordinate']['lat']<85 and -180<obj['coordinate']['lng']<180
B=json.load(open(ROOT/'build-check/full.json'));out={(r['cardId'],r['placeId']):r for r in B['relations']}
for r in L['relations']:
 z=out[(r['cardId'],r['placeId'])];assert z['review']=='verified',(r,z);assert z['status']==r['status'],(r,z)
# Existing approvals must be retained byte-for-byte as JSON values, not sourceHash-only renewal.
O=json.load(open('data/work/national-input/places.json'))
for p in L['places']:
 if p['id'] in {x['id'] for x in O['places']}:assert p==next(x for x in O['places'] if x['id']==p['id'])
for r in L['relations']:
 old=next((x for x in O['relations'] if (x['cardId'],x['placeId'])==(r['cardId'],r['placeId'])),None)
 if old:assert r==old
report={'ok':True,'coverageCards':len(cs),'coverageRelations':len(original),'snapshotHashesChecked':checks,'facilityEvidenceChecked':len(L['places']),'relationEvidenceChecked':len(L['relations']),'coordinateRawValuesChecked':sum('coordinate'in p for p in L['places']),'goBuildVerifiedRelations':len(L['relations']),'checks':['unique facility/alias/relation IDs','no orphan facilities or relations','every assigned legacy relationship audited','immutable source hashes matched','all fetched snapshot SHA256 matched','approved coordinate values occur in original evidence','frozen pilot facilities and relations unchanged','Go builddata merged frozen pilot and regional fragment successfully at 2026-11-05']}
(ROOT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
