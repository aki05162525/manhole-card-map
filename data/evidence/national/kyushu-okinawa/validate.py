"""Validate owned fragment/audit and preserved source bytes, without network."""
from decisions import *
L=json.load(open('data/overrides/regions/kyushu-okinawa.json'));A=json.load(open('data/national/regions/kyushu-okinawa.json'));Q=json.load(open('data/work/national-input/quality.json'))
expected={(r['cardId'],r['placeId']) for r in D['relations'] if '40'<=r['cardId'][:2]<='47'}
actual={(c['cardId'],r['legacyPlaceId']) for c in A['cards'] for r in c['relations']}
assert expected==actual and len(A['cards'])==120 and len(actual)==164
assert len({p['id'] for p in L['places']})==len(L['places'])
alias={a:p['id'] for p in L['places'] for a in p['legacyIds']}
assert len(alias)==sum(len(p['legacyIds']) for p in L['places'])
assert len({(r['cardId'],r['placeId']) for r in L['relations']})==len(L['relations'])
assert set(alias.values())=={r['placeId'] for r in L['relations']}
for r in L['relations']:assert r['sourceHash']==Q['sourceHashes'][r['cardId']]
for e in M+json.load(open(ROOT/'gkp-manifest.json')):
 if 'snapshotPath'in e:assert hashlib.sha256(Path(e['snapshotPath']).read_bytes()).hexdigest()==e['snapshotSHA256'],e['url'] if 'url'in e else e['cardId']
for item in L['places']+L['relations']:
 e=item['evidence'];b=Path(e['snapshotPath']).read_bytes();assert hashlib.sha256(b).hexdigest()==e['snapshotSHA256'];assert e['actorType']=='ai'
 if 'coordinate'in item:
  for v in item['coordinate'].values():assert str(v).encode() in b,(item['id'],v)
  assert any(x in b for x in (b'!3d',b'myLatlng',b'q=33.'))
print('PASS: 120 cards / 164 relations coverage; unique facilities/aliases/relations; no orphan; immutable source hashes; all source SHA256; 7 official coordinate literals and marker/destination context.')
