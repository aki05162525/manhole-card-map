"""Offline structural and literal-evidence checks; no network calls."""
from research import *
from urllib.parse import unquote
out=json.load(open('data/national/location-updates/kanto-north-saitama.json'))
ids=[u['facilityId'] for u in out['updates']+out['unresolved']]
assert len(ids)==len(set(ids))==84
assert set(ids)=={p['id'] for p in TARGETS}
assert out['schema']==1 and out['region']=='kanto-north'
for m in MAN:
 if m.get('snapshotPath'):
  assert hashlib.sha256(pathlib.Path(m['snapshotPath']).read_bytes()).hexdigest()==m['snapshotSHA256'],m['url']
for u in out['updates']:
 e=u['evidence'];c=u['coordinate'];m=CACHE[e['sourceUrl']]
 assert m['snapshotPath']==e['snapshotPath'] and m['snapshotSHA256']==e['snapshotSHA256']
 assert e['snapshotPath'].startswith(str(ROOT)+'/')
 assert e['actorType']=='ai' and '現地確認・人手確認ではない' in e['verificationMethod']
 raw=content(m);s=unquote(raw);a=str(c['lat']);b=str(c['lng'])
 # Extract only actual marker inputs, numeric query destinations, or place/route points.
 pairs=[]
 for pat in [r'new google.maps.LatLng\(\s*([\d.]+)\s*,\s*([\d.]+)',r'(?:q=|destination=|markers=)(?:[^"<>]*?@)?([\d.]+),([\d.]+)',r'!3d([\d.]+)!4d([\d.]+)',r'setGoogleMap_\d+\(\s*([\d.]+)\s*,\s*([\d.]+)']:
  pairs.extend((float(x),float(y)) for x,y in re.findall(pat,s))
 if e['sourceUrl']=='https://www.town.kawajima.saitama.jp/1825.htm':
  pairs.extend((float(y),float(x)) for x,y in re.findall(r'!1d([\d.]+)!2d([\d.]+)',s))
 assert (c['lat'],c['lng']) in pairs,(u['facilityId'],pairs)
 if '/map/search/detail/' in e['sourceUrl']:
  assert re.search(r'position\s*:\s*latlng',s)
 if 'setGoogleMap_' in e['sourceLocator']:
  assert 'AdvancedMarkerElement' in s and re.search(r'position\s*:\s*latlng',s)
for u in out['unresolved']:
 assert u['reason'] and u['attempts']
 assert all(a['url'] in CACHE and a['result'] for a in u['attempts'])
report={'targetCount':len(TARGETS),'updateCount':len(out['updates']),'unresolvedCount':len(out['unresolved']),'exactCoverage':True,'duplicateIds':0,'literalCoordinateCheck':True,'allManifestSHA256Match':True,'actorType':'ai','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'limitation':'機械検査は原文値と構造の検査。施設同定のAI判断はdecisions.jsonと原本を参照。現地確認ではない。'}
(ROOT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
