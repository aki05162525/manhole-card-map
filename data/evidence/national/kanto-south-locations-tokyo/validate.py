from research import *
from decisions import D
from build import extract
patch=read('data/national/location-updates/kanto-south-tokyo.json');fragment=read('data/overrides/regions/kanto-south.json');audit=read('data/national/regions/kanto-south.json')
places={x['id']:x for x in fragment['places']};target={r['facilityId'] for c in audit['cards'] if c['cardId'][:2] in ['13','00'] for r in c['relations'] if r['locationState']=='unlocated'}
ids=[x['facilityId'] for x in patch['updates']+patch['unresolved']];assert len(ids)==len(set(ids));assert set(ids)==target=={p['id'] for p in P};assert all(not places[x].get('coordinate') for x in ids)
checks=0
for r in new:
 if 'snapshotPath' in r:
  assert hashlib.sha256(pathlib.Path(r['snapshotPath']).read_bytes()).hexdigest()==r['sha256'],r['url'];assert r.get('fetchedAt');checks+=1
for u in patch['updates']:
 i=next(p['index'] for p in P if p['id']==u['facilityId']);co,loc,extra=extract(D[i]);assert co==u['coordinate'];e=u['evidence'];assert e['actorType']=='ai';assert e['sourceUrl']==D[i]['url'];assert hashlib.sha256(pathlib.Path(e['snapshotPath']).read_bytes()).hexdigest()==e['snapshotSHA256'];assert loc in e['sourceLocator'];assert u['scope']=='building'
 # Coordinate values must appear as numbers in original source bytes (redirects in saved HTTP response URL).
 b=pathlib.Path(e['snapshotPath']).read_bytes()
 try:raw=b.decode('utf-8')
 except:raw=b.decode('cp932',errors='replace')
 if extra:raw+=' '+extra['finalUrl']
 nums={float(v) for v in re.findall(r'\d+\.\d+',urllib.parse.unquote(raw))}
 assert co['lat'] in nums and co['lng'] in nums,(i,co)
 for r in u.get('supportingEvidence',[]):assert hashlib.sha256(pathlib.Path(r['snapshotPath']).read_bytes()).hexdigest()==r['sha256']
for u in patch['unresolved']:assert u['attempts'] and u['reason'];assert all(a.get('url') and a.get('result') for a in u['attempts'])
result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'targets':len(target),'updates':len(patch['updates']),'unresolved':len(patch['unresolved']),'snapshotsHashVerified':checks,'coordinateReextractions':len(patch['updates']),'idCoverage':'exact','existingCoordinatesOverwritten':0,'actorType':'ai','humanOrFieldVerification':False}
write(ROOT/'validation.json',result);print(result)
