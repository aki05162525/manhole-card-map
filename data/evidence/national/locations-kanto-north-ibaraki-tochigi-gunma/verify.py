"""Read-only structural/provenance validation; run from repository root."""
import json,pathlib,hashlib,re,html
root=pathlib.Path('data/evidence/national/locations-kanto-north-ibaraki-tochigi-gunma')
out=json.load(open('data/national/location-updates/kanto-north-ibaraki-tochigi-gunma.json'))
fragment=json.load(open('data/overrides/regions/kanto-north.json'))
linked={r['placeId'] for r in fragment['relations'] if r['cardId'][:2] in ('08','09','10')}
places={p['id']:p for p in fragment['places']}
expected={i for i in linked if 'coordinate' not in places[i]}
assert out['schema']==1 and out['region']=='kanto-north'
ids=[r['facilityId'] for k in ['updates','unresolved'] for r in out[k]]
assert len(ids)==len(set(ids)) and set(ids)==expected
manifest=json.load(open(root/'manifest.json'));byurl={m['url']:m for m in manifest}
assert len(byurl)==len(manifest)
for m in manifest:
 assert m.get('fetchedAt'),m['url']
 if m.get('snapshotPath'):
  p=pathlib.Path(m['snapshotPath']);assert p.is_relative_to(root),(m['url'],p)
  assert hashlib.sha256(p.read_bytes()).hexdigest()==m['snapshotSHA256'],p
proof={d['facilityId']:d for d in json.load(open(root/'reviewed-decisions.json'))}
for u in out['updates']:
 e=u['evidence'];m=byurl[e['sourceUrl']];assert 200 <= m['status'] < 300
 assert e['snapshotPath']==m['snapshotPath'] and e['snapshotSHA256']==m['snapshotSHA256']
 assert e['actorType']=='ai' and e['sourceLocator'] and e['checkedAt']
 assert '現地確認・人による確認ではない' in e['verificationMethod']
 assert '室内窓口' in e['verificationMethod']
 assert proof[u['facilityId']]['coordinate']==u['coordinate']
 raw=html.unescape(pathlib.Path(e['snapshotPath']).read_text(errors='replace'))
 # Exact numeric equivalence to literal values in the original snapshot.
 nums={float(v) for v in re.findall(r'(?<![\d.])(?:3[5-7]|1(?:38|39|40|41))\.\d+',raw)}
 assert set(u['coordinate'].values())<=nums,u['facilityId']
 assert proof[u['facilityId']]['address']==places[u['facilityId']]['address']
for u in out['unresolved']:
 assert u['reason'] and u['attempts']
 for a in u['attempts']:
  assert a['url'] in byurl and a['result']
print(json.dumps({'targetFacilities':len(expected),'updates':len(out['updates']),'unresolved':len(out['unresolved']),'manifestEntries':len(manifest),'hashesVerified':sum(bool(m.get('snapshotPath')) for m in manifest)},ensure_ascii=False))
