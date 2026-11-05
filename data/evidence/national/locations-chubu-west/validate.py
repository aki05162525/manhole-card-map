from research import *
from decisions import DIRECT,EMBED,SHORT
root=ROOT
read=lambda p:json.load(open(p))
ps=read(root/'targets.json');out=read('data/national/location-updates/chubu-west.json');prov=read(root/'provenance.json');cand=read(root/'location-candidates.json')['candidates']
audit=read('data/national/regions/chubu-west.json');places=read('data/overrides/regions/chubu-west.json')['places'];byid={p['id']:p for p in places}
expected={r.get('facilityId',r['legacyPlaceId']) for c in audit['cards'] if c['cardId'][:2] in ['21','22','23'] for r in c['relations'] if r['locationState']!='verified'}
ids={p['id'] for p in ps};assert ids==expected,(ids-expected,expected-ids)
us={x['facilityId'] for x in out['updates']};ns={x['facilityId'] for x in out['unresolved']};assert us|ns==ids and not us&ns
assert len(us)==len(out['updates']) and len(ns)==len(out['unresolved'])
assert all(x in byid and not byid[x].get('coordinate') for x in us)
assert all(x['legacyPlaceId'] in ns for x in cand)
assert all(x['reason'] and x['attempts'] for x in out['unresolved'])
checked={}
def check(m):
 p=pathlib.Path(m['snapshotPath']);h=hashlib.sha256(p.read_bytes()).hexdigest();assert h==m['snapshotSHA256'],p
 checked[str(p)]=h
for m in read(root/'manifest.json')+read(root/'adopted-manifest.json'):
 assert m.get('fetchedAt')
 if m.get('snapshotPath'):check(m)
for x in prov:
 check(x['primary'])
 for m in x['supportingSources']:check(m);assert m['status']==200
 i=x['index'];e=x['primary'];txt=pathlib.Path(e['snapshotPath']).read_text(errors='replace');decoded=urllib.parse.unquote(txt)
 rec=next((r for r in out['updates'] if r['facilityId']==x['facilityId']),None) or next(r for r in cand if r['legacyPlaceId']==ps[i]['legacyPlaceId'])
 lat,lng=rec['coordinate']['lat'],rec['coordinate']['lng'];assert 34<lat<37 and 136<lng<140
 if i in DIRECT:
  assert (lat,lng)==DIRECT[i][1:3]
  nums=[float(n) for n in re.findall(r'(?<!\d)\d{2,3}\.\d+',decoded)]
  assert any(abs(n-lat)<1e-10 for n in nums) and any(abs(n-lng)<1e-10 for n in nums),(i,'direct coordinate absent')
 elif i in EMBED:
  m=x['supportingSources'][0];s=BeautifulSoup(txt,'html.parser')
  assert any(m['url']==node.get(attr) for node in s.find_all('iframe') for attr in ['src','data-src'])
  t=pathlib.Path(m['snapshotPath']).read_text();z=re.search(r'initEmbed\((\[.*?\])\);',t,re.S);assert z
  def walk(v):
   if isinstance(v,list):
    if len(v)>=3 and isinstance(v[0],str) and v[0].startswith('0x') and isinstance(v[1],str) and isinstance(v[2],list):yield v[:3]
    for c in v:yield from walk(c)
  assert any(EMBED[i][1] in r[1] and r[2]==[lat,lng] for r in walk(json.loads(z[1])))
 elif i in SHORT:
  m=x['supportingSources'][0];assert m['url'] in txt and '/sorry' not in m['finalUrl']
  assert SHORT[i][1] in urllib.parse.unquote(m['finalUrl'])
  z=re.search(r'!3d(\d+\.\d+)!4d(\d+\.\d+)',m['finalUrl']);assert tuple(map(float,z.groups()))==(lat,lng)
 else:raise AssertionError(i)
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':True,'targets':len(ps),'registeredTargets':sum(p['registered'] for p in ps),'updates':len(us),'unresolvedMainRows':len(ns),'locationOnlyCandidates':len(cand),'stillUnlocated':len(ns)-len(cand),'rawSnapshotsHashVerified':len(checked),'checks':['all original unlocated facilities assigned exactly once','registered updates exclude existing coordinates','unconfirmed distribution remains candidates only','all manifest and adopted snapshot SHA256 verified','official primary links to exact embedded or short-link supporting source','all adopted coordinates exist in exact named place records or official explicit numeric data','successful short-link destination only; no restricted-page continue coordinates','no viewport or address geocode adopted'],'immutableInputSHA256':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in pathlib.Path('data/work/national-input').glob('*.json')}}
(root/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
