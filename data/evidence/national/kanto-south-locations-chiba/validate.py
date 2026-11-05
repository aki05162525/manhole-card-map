import json,pathlib,hashlib,re,csv,io,xml.etree.ElementTree as ET
ROOT=pathlib.Path('data/evidence/national/kanto-south-locations-chiba')
patch=json.load(open('data/national/location-updates/kanto-south-chiba.json'))
ledger=json.load(open('data/overrides/regions/kanto-south.json'))
ids={r['placeId'] for r in ledger['relations'] if r['cardId'].startswith('12')}
expected={p['id'] for p in ledger['places'] if p['id'] in ids and 'coordinate' not in p}
manifest=json.load(open(ROOT/'manifest.json'))
for m in manifest:
 if m.get('snapshotPath'):
  p=pathlib.Path(m['snapshotPath']);assert p.is_relative_to(ROOT)
  assert hashlib.sha256(p.read_bytes()).hexdigest()==m['sha256'],m['url']
M={m['url']:m for m in manifest}
seen=set();methods={}
for u in patch['updates']:
 fid=u['facilityId'];assert fid in expected and fid not in seen;seen.add(fid)
 e=u['evidence'];m=M[e['sourceUrl']];assert m['status']==200
 assert e['snapshotSHA256']==m['sha256'] and e['snapshotPath']==m['snapshotPath']
 assert e['actorType']=='ai' and '現地確認・人による確認ではない' in e['verificationMethod']
 b=pathlib.Path(e['snapshotPath']).read_bytes()
 for enc in ['utf-8-sig','cp932']:
  try:t=b.decode(enc);break
  except UnicodeDecodeError:pass
 else:raise AssertionError('decode')
 lat=str(u['coordinate']['lat']);lng=str(u['coordinate']['lng'])
 assert lat in t and lng in t,(fid,lat,lng)
 # Both numeric values must co-occur in one source record, never independently located.
 assert re.search(re.escape(lat)+r'.{0,180}'+re.escape(lng),t,re.S) or re.search(re.escape(lng)+r'.{0,180}'+re.escape(lat),t,re.S),(fid,'pair')
 if e['sourceUrl'].endswith('53042.csv'):
  rows=list(csv.DictReader(io.StringIO(t)));rows=[r for r in rows if r['緯度']==lat and r['経度']==lng];assert len(rows)==1
  assert rows[0]['名称'] in e['sourceLocator']
 if 'feature/detail_89' in e['sourceUrl']:
  assert re.search(r'data-marker-lat="'+re.escape(lat)+r'" data-marker-lng="'+re.escape(lng)+r'"',t)
 methods[u['scope']]=methods.get(u['scope'],0)+1
for r in patch['unresolved']:
 assert r['facilityId'] in expected and r['facilityId'] not in seen;seen.add(r['facilityId'])
 assert len(r['attempts'])>=2 and r['reason']
 for a in r['attempts']:assert a['url'] in M and a['result']
assert seen==expected
print(json.dumps({'targetFacilities':len(expected),'updates':len(patch['updates']),'unresolved':len(patch['unresolved']),'scopeCounts':methods,'manifestURLs':len(manifest),'validated':'IDs, raw-byte hashes, source record numeric pairs, scope, and attempt coverage'},ensure_ascii=False))
