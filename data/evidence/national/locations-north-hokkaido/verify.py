import json,pathlib,hashlib,re,math,urllib.parse
R=pathlib.Path(__file__).parent
out=json.load(open('data/national/location-updates/north-hokkaido.json'));targets=json.load(open(R/'targets.json'));man=json.load(open(R/'manifest.json'));byurl={e['url']:e for e in man}
ledger=json.load(open('data/overrides/regions/north.json'));ids={r['placeId'] for r in ledger['relations'] if r['cardId'].startswith('01')};expected={p['id'] for p in ledger['places'] if p['id'] in ids and not p.get('coordinate')}
assert expected=={x['id'] for x in targets}
actual=[x['facilityId'] for x in out['updates']+out['unresolved']];assert len(actual)==len(set(actual));assert set(actual)==expected
for e in man:
 if e.get('snapshotPath'):
  p=pathlib.Path(e['snapshotPath']);assert p.resolve().is_relative_to(R.resolve());assert hashlib.sha256(p.read_bytes()).hexdigest()==e['snapshotSHA256'],p
  if e.get('reusedFrom'):assert p.read_bytes()==pathlib.Path(e['reusedFrom']).read_bytes()
 assert e.get('fetchedAt')
checks=[]
for x in out['updates']:
 e=x['evidence'];m=byurl[e['sourceUrl']];assert m['snapshotPath']==e['snapshotPath'];assert m['snapshotSHA256']==e['snapshotSHA256'];assert e['actorType']=='ai';assert e['checkedAt']=='2026-11-05'
 raw=pathlib.Path(e['snapshotPath']).read_bytes();text=raw.decode('utf-8','replace');text=urllib.parse.unquote(text)
 lat,lng=x['coordinate']['lat'],x['coordinate']['lng'];assert 40<lat<46 and 139<lng<146
 # Both literals must occur in a single local source fragment; catches unrelated page-wide values.
 nums=list(re.finditer(r'(?<![\d.])\d{2,3}\.\d+',text));latpos=[m.start() for m in nums if abs(float(m[0])-lat)<1e-10];lngpos=[m.start() for m in nums if abs(float(m[0])-lng)<1e-10]
 assert any(abs(a-b)<1500 for a in latpos for b in lngpos),(x['facilityId'],lat,lng,e['snapshotPath'])
 checks.append({'facilityId':x['facilityId'],'coordinateLiteralPair':'pass','snapshotSHA256':'pass','idReference':'pass'})
for x in out['unresolved']:
 assert x['attempts'] and x['reason']
 for a in x['attempts']:assert a['url'] in byurl and a['result']
validation={'targets':len(expected),'updates':len(out['updates']),'unresolved':len(out['unresolved']),'manifestURLs':len(man),'allSnapshotHashes':'pass','allTargetCoverage':'pass','checks':checks,'immutableInputSHA256':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in pathlib.Path('data/work/national-input').glob('*.json')}}
(R/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
print({k:v for k,v in validation.items() if k not in ('checks','immutableInputSHA256')})
