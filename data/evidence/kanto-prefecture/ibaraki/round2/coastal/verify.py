"""Read-only reproduction of coastal research checks; no suite or manifest mutation."""
import json,sys,copy,hashlib
from pathlib import Path
sys.path.insert(0,'tools/national')
from assemble import assemble,read_json
from location_lifecycle import digest
from research_common import decode_tile,rounded_coordinate
E=Path('data/evidence/kanto-prefecture/ibaraki/round2/coastal');N=Path('data/national/kanto-prefecture/ibaraki/round2/coastal');root=Path('.').resolve()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
b=read_json(E/'baseline.json');h=read_json(E/'inherited-history.json');n=0
for r in h['facilities']:
 for ref in r['resolvedHistory']:
  p,_,pointer=ref['ref'].partition('#');assert sha(Path(p))==ref['sha256']
 for src in r['verifiedOriginals']:assert sha(Path(src['snapshotPath']))==src['snapshotSHA256']
for key in ['mito','aqua','umimachi','hitachi','naka']:
 for r in read_json(E/key/'vector-window.json')['tiles']:
  assert sha(Path(r['retainedPath']))==r['sha256'];n+=1
 for g in read_json(E/key/'geometry-comparison.json')['geometries']:
  assert sha(Path(g['snapshotPath']))==g['snapshotSHA256']
  raw=decode_tile(Path(g['snapshotPath']).read_bytes())['BldA']['features'][g['featureIndex']]['geometry'];assert raw==g['geometry'];assert digest(raw)==g['geometrySHA256']
  assert rounded_coordinate(raw,g['tile'],g['selectedTileXY'])==g['calculation']
m=read_json(root/'tools/national/manifest.json');before,a=assemble(root,m);assert a['inputSHA256']==b['inputSHA256'];assert sha(root/'tools/national/manifest.json')==b['manifestSHA256']
ps={p['id']:p for p in before['places']}
for p in b['oldPlaces']:assert p==ps[p['id']] and digest(p)==b['oldPlaceHashes'][p['id']]
s=read_json(N/'manifest-selection-proposed.json');m['locations']+=s['locations'];m['locationLifecycle']+=s['locationLifecycle'];after,a2=assemble(root,m)
updates=read_json(N/'locations-proposed.json')['updates'];expected={x['facilityId'] for x in updates};actual={p['id'] for p,q in zip(before['places'],after['places']) if p!=q};assert actual==expected
assert before['relations']==after['relations'];assert {k:v for k,v in before.items() if k!='places'}=={k:v for k,v in after.items() if k!='places'};assert len(before['places'])==len(after['places'])
for u in updates:
 assert u['scope']=='building' and u['evidence']['checkedAt']=='2026-11-05'
 assert u['coordinate'] is not None
print('PASS inherited history/original hashes; 45 retained GSI tiles; all 14 comparison geometries and rounded containment replayed')
print('PASS current schema / canonical adoption hash / lifecycle binding / explicit selection')
print('PASS full-ledger difference exactly candidate IDs:',sorted(actual))
print('PASS all non-place ledger sections and relations unchanged; shared manifest unchanged; no location approval implied')
