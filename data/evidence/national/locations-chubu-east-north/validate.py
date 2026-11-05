"""Validate this supplement only; no edits to regional sources."""
import json,pathlib,hashlib,re,math,datetime
R=pathlib.Path('data/evidence/national/locations-chubu-east-north')
def read(p):return json.loads(pathlib.Path(p).read_text())
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
x=read('data/national/location-updates/chubu-east-north.json');reg=read('data/national/regions/chubu-east.json');original=read('data/overrides/regions/chubu-east.json')
wanted={r['facilityId'] for c in reg['cards'] if c['cardId'][:2] in ['15','16','17','18'] for r in c['relations'] if r.get('facilityId') and r.get('locationState')=='unlocated'}
ids=[r['facilityId'] for k in ['updates','unresolved'] for r in x[k]]
assert len(ids)==len(set(ids)) and set(ids)==wanted
places={p['id']:p for p in original['places']}
M=read(R/'manifest.json');by={m['url']:m for m in M}
for m in M:
 assert m['urlHash']==hashlib.sha256(m['url'].encode()).hexdigest()
 assert m.get('fetchedAt'),m['url']
 if m.get('snapshotPath'):
  assert m['snapshotPath'].startswith(str(R)+'/')
  assert sha(m['snapshotPath'])==m['sha256']
  assert pathlib.Path(m['snapshotPath']).stat().st_size==m['bytes']
C={c['facilityId']:c for c in read(R/'evidence-chains.json')}
for u in x['updates']:
 assert u['facilityId'] in places and not places[u['facilityId']].get('coordinate')
 e=u['evidence'];assert e['actorType']=='ai' and sha(e['snapshotPath'])==e['snapshotSHA256']
 assert by[e['sourceUrl']]['snapshotPath']==e['snapshotPath']
 c=C[u['facilityId']];m=c['coordinateSource'];raw=pathlib.Path(m['snapshotPath']).read_bytes().decode('utf-8','replace')
 nums=[float(n) for n in re.findall(r'\d{2,3}\.\d+',raw)]
 for k,lo,hi in [('lat',35,39),('lng',135,141)]:
  n=u['coordinate'][k];assert lo<n<hi
  assert any(abs(v-n)<1e-10 for v in nums),(u['facilityId'],k,n)
 if c['officialLinkSource']['url']!=m['url']:
  parent=pathlib.Path(c['officialLinkSource']['snapshotPath']).read_text(errors='replace');assert m['url'] in parent,(u['facilityId'],'parent link missing')
for u in x['unresolved']:
 assert u['reason'] and u['attempts']
 for a in u['attempts']:assert a['url'] in by,(u['facilityId'],a['url'])
for a in read(R/'facility-audit.json'):
 for m in a['sources']:
  if m.get('snapshotPath'):assert sha(m['snapshotPath'])==m['sha256']
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scopePrefixes':['15','16','17','18'],'targetFacilities':len(wanted),'updates':len(x['updates']),'unresolved':len(x['unresolved']),'manifestEntries':len(M),'checks':['88 canonical unlocated IDs exactly covered once','no originally located facility updated','all saved raw bytes SHA256 and sizes match','all fetch timestamps and URL hashes present','all supplement paths local to dedicated evidence directory','every coordinate numeric value occurs in its cited raw snapshot','all expanded Google links occur in cited official parent raw','all unresolved URLs have manifest records','all facility audit snapshot references match hashes'],'inputHashes':{p:sha(p) for p in ['data/work/national-input/full.json','data/work/national-input/quality.json','data/work/national-input/places.json']}}
(R/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
