"""Check the real Go output, immutable inputs, evidence, and old relationship retention."""
import json,pathlib,hashlib,collections
root=pathlib.Path('data/evidence/national/proposals-kinki')
def read(p):return json.load(open(p))
proposal=read('data/overrides/proposals/kinki.json');combined=read('/tmp/kinki-proposals-combined.json');out=read('/tmp/kinki-proposals-build/full.json');original=read('data/work/national-input/full.json')
expected={'full':'6068da023f3bd4cb1e292b3e43877411a1505356e4377bbf02a255a89afb1987','quality':'8561505b9c8c0426fae93bf35306bd53f324e75527b842986da3d1df7b31012b','places':'152bb738c77e95fcbd54702e42a2107cfd5949d614c7e6b4a706c94cba2a41fe'}
for name,h in expected.items():assert hashlib.sha256(pathlib.Path('data/work/national-input/'+name+'.json').read_bytes()).hexdigest()==h
aliases={old:p['id'] for p in combined['places'] for old in p['legacyIds']};rels={(r['cardId'],r['placeId']):r for r in out['relations']};places={p['id']:p for p in out['places']}
for r in original['relations']:assert (r['cardId'],aliases.get(r['placeId'],r['placeId'])) in rels
for r in proposal['relations']:
 a=rels[(r['cardId'],r['placeId'])];assert a['review']=='verified';assert a['status']==r['status'];assert a['raw']==r['change']['raw']
 assert a['change']['previousPlaceIds']==[aliases.get(x,x) for x in r['change']['previousPlaceIds']]
 assert places[r['placeId']]['coordinate']['status']=='unconfirmed'
for row in proposal['places']+proposal['relations']:
 e=row['evidence'];assert hashlib.sha256(pathlib.Path(e['snapshotPath']).read_bytes()).hexdigest()==e['snapshotSHA256']
for m in read(root/'evidence-used.json')+read(root/'manifest.json'):assert hashlib.sha256(pathlib.Path(m['snapshotPath']).read_bytes()).hexdigest()==m['snapshotSHA256']
statuses={c['id']:c['status'] for c in out['cards']}
for c in ['28-207-B001','28-207-C001','29-205-A001','26-344-A001','26-344-B001']:assert statuses[c]=='active',(c,statuses[c])
for c,p in [('28-207-B001','facility:kinki-50fd7780197e359a9c8e'),('28-207-C001','facility:kinki-50fd7780197e359a9c8e'),('29-205-A001','facility:kinki-09d12f8315cc6ca090a4')]:assert rels[(c,p)]['status']=='ended'
result=dict(proposalCards=len({r['cardId'] for r in proposal['relations']}),newRelations=len(proposal['relations']),newFacilities=sum(not p['legacyIds'] for p in proposal['places']),reusedFacilities=sum(bool(p['legacyIds']) for p in proposal['places']),newStatusCounts=dict(collections.Counter(r['status'] for r in proposal['relations'])),newCoordinates=0,originalRelationsRetained=True,immutableInputHashes=expected,allEvidenceHashesVerified=True,allNewRelationsVerified=True,movedCardStatuses={c:statuses[c] for c in ['28-207-B001','28-207-C001','29-205-A001']},goOutput={'cards':len(out['cards']),'places':len(out['places']),'relations':len(out['relations'])})
(root/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2))
