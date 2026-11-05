"""Run after build_fragment.py and the README's Go build command."""
import hashlib,json,pathlib
P=pathlib.Path('data/evidence/national/chugoku-shikoku')
l=json.load(open('data/overrides/regions/chugoku-shikoku.json'));a=json.load(open('data/national/regions/chugoku-shikoku.json'))
b=json.load(open('data/work/national-input/full.json'));q=json.load(open('data/work/national-input/quality.json'))
assert len({c['cardId'] for c in a['cards']})==len(a['cards'])==164
expected={(r['cardId'],r['placeId']) for r in b['relations'] if 31<=int(r['cardId'][:2])<=39}
actual=[(c['cardId'],r['legacyPlaceId']) for c in a['cards'] for r in c['relations']]
assert len(actual)==len(set(actual))==199 and set(actual)==expected
for r in json.load(open(P/'manifest.json')):
 if 'snapshotPath'in r:assert hashlib.sha256(pathlib.Path(r['snapshotPath']).read_bytes()).hexdigest()==r['sha256']
for p in l['places']:
 if 'coordinate'in p:
  raw=pathlib.Path(p['evidence']['snapshotPath']).read_bytes()
  for value in p['coordinate'].values():assert str(value).encode() in raw
rr={(r['cardId'],r['placeId']):r for r in json.load(open(P/'build-check/full.json'))['relations']}
for r in l['relations']:
 assert r['sourceHash']==q['sourceHashes'][r['cardId']]
 generated=rr[(r['cardId'],r['placeId'])]
 assert generated['review']=='verified' and generated['status']==r['status']
print('PASS: card/relation coverage, hashes, coordinates, generated ledger statuses')
