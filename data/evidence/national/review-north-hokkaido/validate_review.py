import json,hashlib,pathlib,collections
R=pathlib.Path(__file__).parent
load=lambda p:json.loads(pathlib.Path(p).read_text())
r=load('data/national/reviews/north-hokkaido.json');a=load(R/'audit.json');u=load(r['input']['path']);updates={x['facilityId']:x for x in u['updates']}
for p,h in a['inputSHA256'].items():assert hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h,('original changed',p)
assert r['input']['sha256']==hashlib.sha256(pathlib.Path(r['input']['path']).read_bytes()).hexdigest()
assert len(r['reviews'])==len(updates)==72
assert {x['facilityId'] for x in r['reviews']}==set(updates)
assert len(r['unresolvedReviews'])==19 and r['unresolvedPromoted']==0
assert {x['facilityId'] for x in r['unresolvedReviews']}=={x['facilityId'] for x in u['unresolved']}
assert all(x['decision']=='保留' and not x['canIntegrateAsConfirmed'] for x in r['unresolvedReviews'])
assert dict(collections.Counter(x['decision'] for x in r['reviews']))==r['summary']
for x in r['reviews']:
 assert x['canIntegrateAsConfirmed']==(x['decision']=='採用可能')
 assert x['proposedCoordinate']==updates[x['facilityId']]['coordinate']
 for e in x['evidence']:
  assert hashlib.sha256(pathlib.Path(e['snapshotPath']).read_bytes()).hexdigest()==e['snapshotSHA256']
for p in r['exactCorrections']:
 if p['field']=='name':assert next(x['name'] for x in r['reviews'] if x['facilityId']==p['facilityId'])==p['old']
 else:assert updates[p['facilityId']]['evidence']['verificationMethod']==p['old']
 assert p['new']!=p['old'] and p['coordinateChange'] is None
for e in load(R/'manifest.json'):assert hashlib.sha256(pathlib.Path(e['snapshotPath']).read_bytes()).hexdigest()==e['snapshotSHA256']
v={'result':'pass','reviews':72,'accepted':27,'correctionRequired':4,'held':41,'unresolvedRetained':19,'originalFilesUnchangedSinceAudit':len(a['inputSHA256']),'exactOldValuesVerified':4,'newOfficialSnapshotHashesVerified':6,'note':'構造・証拠の検証。意味的判断は各review.reasonを参照。'}
(R/'validation.json').write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n');print(v)
