"""Offline integrity and coordinate/source checks. Run from repository root."""
from research import *
import math
out=json.load(open('data/national/location-updates/north-tohoku.json'))
expected=set(json.load(open(ROOT/'target-ids.json')))
actual=[x['facilityId'] for x in out['updates']+out['unresolved']]
assert set(actual)==expected and len(actual)==len(expected)==129
assert expected=={p['id'] for p in targets},'Original target scope changed; review required'
assert out['schema']==1 and out['region']=='north'
manifest=json.load(open(ROOT/'manifest.json'))+json.load(open(ROOT/'cache-manifest.json'))
m={r['url']:r for r in manifest};d={x['facilityId']:x for x in json.load(open(ROOT/'decisions.json'))}
for r in manifest:
 if not r.get('snapshotPath'):continue
 path=pathlib.Path(r['snapshotPath']);assert path.parent==ROOT
 b=path.read_bytes();assert hashlib.sha256(b).hexdigest()==r['snapshotSHA256'],path
 assert len(b)==r['bytes'],path
for u in out['updates']:
 e=u['evidence'];r=m[e['sourceUrl']];assert r['status']==200
 assert e['snapshotPath']==r['snapshotPath'] and e['snapshotSHA256']==r['snapshotSHA256']
 assert e['actorType']=='ai' and e['checkedAt']=='2026-11-05'
 assert e['sourceLocator'] and e['verificationMethod']
 c=u['coordinate'];assert 36<c['lat']<42 and 138<c['lng']<143
 s,_=parsed(r);haystack=html.unescape(s)+'\n'+urllib.parse.unquote(r.get('finalUrl',''))
 nums=[float(x) for x in re.findall(r'(?<![\d.])-?\d+\.\d+(?:[eE][-+]?\d+)?',haystack)]
 for key in ['lat','lng']:
  assert c[key]==d[u['facilityId']][key]
  assert any(math.isclose(c[key],v,rel_tol=0,abs_tol=1e-10) for v in nums),(u['facilityId'],key,c[key])
 for url in d[u['facilityId']]['supportUrls']:
  assert url in m and m[url].get('status')==200,(u['facilityId'],url)
 # For remote embed records require the matching paired lat/lng in a named place record,
 # not just any two independently present viewport values.
 if '/maps/embed?pb=' in e['sourceUrl']:
  pts=re.findall(r'\[\["(0x[^"]+)","([^"]*)",\[([0-9.]+),([0-9.]+)\]',s)
  assert any(math.isclose(c['lat'],float(lat),abs_tol=1e-10) and math.isclose(c['lng'],float(lng),abs_tol=1e-10) and name for cid,name,lat,lng in pts),u['facilityId']
for u in out['unresolved']:
 assert u['reason'] and u['attempts']
 for a in u['attempts']:assert a['url'] in m and a['result'],(u['facilityId'],a['url'])
for c in json.load(open(ROOT/'proposal-location-candidates.json')):
 assert c['legacyFacilityId'] in expected and c['applyToLegacyFacility'] is False
 r=m[c['sourceUrl']];assert c['snapshotPath']==r['snapshotPath'] and c['snapshotSHA256']==r['snapshotSHA256']
 body=decode(pathlib.Path(r['snapshotPath']).read_bytes())
 assert str(c['coordinate']['lat']) in body and str(c['coordinate']['lng']) in body
 assert c['legacyFacilityId'] not in {u['facilityId'] for u in out['updates']}
print(f'PASS: {len(expected)} IDs partitioned; {len(out["updates"])} coordinate pairs/source values; {len(out["unresolved"])} unresolved histories; {len(manifest)} manifest entries checked')
