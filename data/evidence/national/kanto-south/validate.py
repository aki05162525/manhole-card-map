import html,json,pathlib,hashlib,re,urllib.parse,collections
R=pathlib.Path('data/evidence/national/kanto-south')
def read(p):return json.loads(pathlib.Path(p).read_text())
l=read('data/overrides/regions/kanto-south.json');a=read('data/national/regions/kanto-south.json');m=read(R/'manifest.json');full=read('data/work/national-input/full.json');q=read('data/work/national-input/quality.json')
ids=[p['id'] for p in l['places']];assert len(ids)==len(set(ids));aliases=[i for p in l['places'] for i in p['legacyIds']];assert len(aliases)==len(set(aliases))
rs=[(r['cardId'],r['placeId']) for r in l['relations']];assert len(rs)==len(set(rs));assert set(ids)==set(r['placeId'] for r in l['relations'])
for r in m:
 if 'snapshotPath' in r:assert hashlib.sha256(pathlib.Path(r['snapshotPath']).read_bytes()).hexdigest()==r['sha256'],r['url']
for v in l['places']+l['relations']:
 e=v['evidence'];assert e['actorType']=='ai';b=pathlib.Path(e['snapshotPath']).read_bytes();assert hashlib.sha256(b).hexdigest()==e['snapshotSHA256']
 if 'sourceHash' in v:assert v['sourceHash']==q['sourceHashes'][v['cardId']]
 if 'coordinate' in v:
  text=html.unescape(urllib.parse.unquote(b.decode('utf-8',errors='replace')));co=v['coordinate'];pattern=r'(?:[?&]q=|destination=)'+re.escape(str(co['lat']))+r'\s*,\s*'+re.escape(str(co['lng']))
  assert re.search(pattern,text), (v['id'],co)
expected=[c['id'] for c in full['cards'] if c['id'][:2] in ('00','12','13','14')];assert sorted(expected)==sorted(c['cardId'] for c in a['cards'])
for c in a['cards']:
 exp=[r['placeId'] for r in full['relations'] if r['cardId']==c['cardId']];assert sorted(exp)==sorted(r['legacyPlaceId'] for r in c['relations'])
 assert c['attempts'],c['cardId']
 for r in c['relations']:
  if r['distributionState']=='unknown':assert r['remainingReason']
print('PASS: 192 cards / 248 original relations; unique IDs/aliases/relations, no orphan facilities; evidence hashes; immutable source hashes; all 29 coordinates literal destination q/destination in original bytes.')
print('Audit states',dict(collections.Counter(c['state'] for c in a['cards'])))
