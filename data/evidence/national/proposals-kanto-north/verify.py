import collections,hashlib,json,pathlib
R=pathlib.Path('data/evidence/national/proposals-kanto-north')
def read(p):return json.loads(pathlib.Path(p).read_text())
ledger=read('data/overrides/proposals/kanto-north.json');patch=read('data/national/patches/kanto-north.json');before=read('/tmp/kanto-north-proposals-before/full.json');after=read('/tmp/kanto-north-proposals-build/full.json');hashes=read('/tmp/kanto-north-proposals-current/quality.json')['sourceHashes']
# Check all original proposals / unapproved relations are accounted for exactly once.
region=read('data/national/regions/kanto-north.json');expected={c['cardId'] for c in region['cards'] if c.get('proposals')}
assert expected=={d['cardId'] for d in patch['proposalDecisions']} and len(expected)==9
pending={(c['cardId'],r['legacyPlaceId']) for c in region['cards'] for r in c['relations'] if not r.get('distributionEvidence')}
assert pending=={(d['cardId'],d['legacyPlaceId']) for d in patch['pendingRelationDecisions']} and len(pending)==8
# Check every new/changed evidence hash, not only successful fetch metadata.
evlist=read(R/'inspections.json')+[x['evidence'] for x in ledger['places']]
for e in evlist:assert hashlib.sha256(pathlib.Path(e['snapshotPath']).read_bytes()).hexdigest()==e['snapshotSHA256'],e
assert all('coordinate' not in p for p in ledger['places'])
idx=collections.defaultdict(list)
for r in after['relations']:idx[r['cardId'],r['placeId']].append(r)
for r in ledger['relations']:
 assert r['sourceHash']==hashes[r['cardId']]
 built=idx[r['cardId'],r['placeId']];assert len(built)==1 and built[0]['review']=='verified'
 assert built[0]['hours']==r['hours'] and built[0]['condition']==r['condition']
 if 'change' in r:assert built[0]['change']['raw']==r['change']['raw']
for p in patch['patches']:
 if p['section']=='relations':
  r=p['new'];assert all(x['review']=='verified' and x['hours']==r['hours'] for x in idx[r['cardId'],r['placeId']])
# Old relocated counters and unresolved Ajisai/Tomioka/Kitamoto have not silently ended.
for d in patch['pendingRelationDecisions']:
 if d['state']=='pending':
  built=idx[d['cardId'],d['legacyPlaceId']];assert len(built)==1 and built[0]['review']=='needs-review' and built[0]['status']=='unknown'
# The false Utsunomiya heading no longer creates a facility; two source rows retain provenance.
assert not any(p['id']=='place:6de4876b701fc38bd3a1' for p in after['places'])
assert len(idx['09-201-A001','facility:kanto-north-67107257814c51043efa'])==2
assert len(after['cards'])==1313 and len(after['relations'])-len(before['relations'])==8
assert all(not('change' in r) or all(any(p['id']==old for p in after['places']) for old in r['change']['previousPlaceIds']) for r in after['relations'])
input_hashes={}
for name,expectedhash in [('full','6068da023f3bd4cb1e292b3e43877411a1505356e4377bbf02a255a89afb1987'),('quality','8561505b9c8c0426fae93bf35306bd53f324e75527b842986da3d1df7b31012b'),('places','152bb738c77e95fcbd54702e42a2107cfd5949d614c7e6b4a706c94cba2a41fe')]:
 actual=hashlib.sha256(pathlib.Path('data/work/national-input/'+name+'.json').read_bytes()).hexdigest();assert actual==expectedhash;input_hashes[name]=actual
assert pathlib.Path('/tmp/kanto-north-proposals-build/full.json').read_bytes()==pathlib.Path('/tmp/kanto-north-proposals-roundtrip/full.json').read_bytes()
summary={'mergedLedgerRoundtrip':'full.json byte-identical','schema':1,'checkedAt':'2026-11-05','actorType':'ai','inputHashes':input_hashes,'proposalDecisions':dict(collections.Counter(d['state'] for d in patch['proposalDecisions'])),'initiallyPendingRelations':dict(collections.Counter(d['state'] for d in patch['pendingRelationDecisions'])),'supplementFacilities':len(ledger['places']),'supplementRelations':len(ledger['relations']),'explicitAdditions':sum('change' in r for r in ledger['relations']),'exactPatches':len(patch['patches']),'reviewedChangedCards':len(patch['currentSourceReviews']),'evidenceChecked':len(evlist),'before':{'facilities':len(before['places']),'relations':len(before['relations']),'verified':sum(r['review']=='verified' for r in before['relations'])},'after':{'facilities':len(after['places']),'relations':len(after['relations']),'verified':sum(r['review']=='verified' for r in after['relations'])},'locationApprovalsAdded':0,'notes':['確認済み行数には重複した元抽出行を含む。宇都宮の見出し行は実施設へ統合されても履歴行として残る。','原典のAI照合。現地・人手の確認ではない。']}
(R/'verification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False))
