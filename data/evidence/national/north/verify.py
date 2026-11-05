"""Validate north coverage, aliases, immutable hashes and raw coordinate evidence."""
import json,hashlib,pathlib,re,collections
R=pathlib.Path('data/evidence/national/north')
load=lambda p:json.load(open(p))
d=load('data/work/national-input/full.json');q=load('data/work/national-input/quality.json');l=load('data/overrides/regions/north.json');a=load('data/national/regions/north.json');m=load(R/'manifest.json')
ids={c['id'] for c in d['cards'] if 1<=int(c['id'][:2])<=7};pids={p['id'] for p in d['places']};expected=collections.Counter((r['cardId'],r['placeId'],r['condition']) for r in d['relations'] if r['cardId'] in ids)
assert len(a['cards'])==len(ids)==204 and {c['cardId'] for c in a['cards']}==ids
actual=collections.Counter((c['cardId'],r['legacyPlaceId'],r['sourceCondition']) for c in a['cards'] for r in c['relations']);assert actual==expected
for r in m:
 if 'snapshotPath' in r:assert hashlib.sha256(pathlib.Path(r['snapshotPath']).read_bytes()).hexdigest()==r['snapshotSHA256'],r['url']
assert len({r['url'] for r in m})==len(m)
aliases={};facilities={}
for p in l['places']:
 assert p['id'].startswith('facility:') and p['id'] not in facilities;facilities[p['id']]=p
 assert p['name'] and p['address']
 for alias in p['legacyIds']:
  assert alias in pids and alias not in aliases;aliases[alias]=p['id']
keys=set()
def ev(e):
 assert e['actorType']=='ai' and e['checkedAt']=='2026-11-05' and e['sourceLocator'] and e['verificationMethod']
 assert hashlib.sha256(pathlib.Path(e['snapshotPath']).read_bytes()).hexdigest()==e['snapshotSHA256']
 assert any(r.get('snapshotPath')==e['snapshotPath'] and r['url']==e['sourceUrl'] and r.get('status')==200 for r in m)
for p in l['places']:
 ev(p['evidence'])
 if 'coordinate' in p:
  c=p['coordinate'];assert set(c)=={'lat','lng'} and 35<c['lat']<46 and 138<c['lng']<146
  raw=pathlib.Path(p['evidence']['snapshotPath']).read_bytes().decode('utf-8',errors='replace')
  pair=str(c['lat'])+','+str(c['lng'])
  assert 'q='+pair in raw or 'q=loc:'+pair in raw or '!3d'+str(c['lat'])+'!4d'+str(c['lng']) in raw,p['id']
for r in l['relations']:
 key=(r['cardId'],r['placeId']);assert key not in keys;keys.add(key)
 assert r['cardId'] in ids and r['placeId'] in facilities and r['sourceHash']==q['sourceHashes'][r['cardId']]
 assert any(x['cardId']==r['cardId'] and aliases.get(x['placeId'])==r['placeId'] for x in d['relations'])
 assert r['status'] in ['active','suspended','ended','unknown','upcoming'];ev(r['evidence'])
assert {r['placeId'] for r in l['relations']}==set(facilities),'orphan facility'
for c in a['cards']:
 for r in c['relations']:
  assert r['sourceUrls'] and r['attempts']
  if 'facilityId' in r:assert (c['cardId'],r['facilityId']) in keys
  if r['locationState']!='verified-building':assert r['remainingReason']
stats={'cards':len(ids),'sourceRelations':sum(expected.values()),'ledgerFacilities':len(l['places']),'ledgerRelations':len(l['relations']),'coordinateFacilities':sum('coordinate' in p for p in l['places']),'cardStates':dict(collections.Counter(c['state'] for c in a['cards'])),'relationStates':dict(collections.Counter(r['distributionState'] for c in a['cards'] for r in c['relations'])),'unadoptedSourceRelations':sum('facilityId' not in r for c in a['cards'] for r in c['relations']),'proposalCards':sum(bool(c['proposals']) for c in a['cards']),'fetches':len(m),'http200':sum(r.get('status')==200 for r in m),'snapshots':sum('snapshotPath' in r for r in m),'inputSHA256':{f:hashlib.sha256(pathlib.Path('data/work/national-input',f).read_bytes()).hexdigest() for f in ['full.json','quality.json','places.json']}}
(R/'validation.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n');print(json.dumps(stats,ensure_ascii=False,indent=2))
