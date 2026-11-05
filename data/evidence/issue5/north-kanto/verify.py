import json,pathlib,hashlib,re,datetime
R=pathlib.Path('data/evidence/issue5/north-kanto')
def read(p):return json.loads(pathlib.Path(p).read_text())
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
l=read('data/work/issue5-baseline/ledger.json');d=read('data/national/issue5/north-kanto.json');v=read(R/'verification.json')
rids={r['placeId'] for r in l['relations'] if r['cardId'][:2] in {'08','09','10','11'}};ids={p['id'] for p in l['places'] if p['id'] in rids and not p.get('coordinate')}
actual=[r['facilityId'] for r in d['updates']+d['unresolved']];assert len(actual)==len(set(actual)) and set(actual)==ids
for r in v['baselineAndInputHashes']:assert sha(r['path'])==r['sha256'],r['path']
for e in read(R/'reused-originals.json'):assert sha(e['snapshotPath'])==sha(e['originalPath'])==e['snapshotSHA256']
for e in read(R/'fetch-records.json')+read(R/'fetch-additional-records.json'):
 if e.get('status')==200:assert sha(e['snapshotPath'])==e['snapshotSHA256']
for u in d['updates']:
 e=u['evidence'];s=pathlib.Path(e['snapshotPath']).read_text();assert sha(e['snapshotPath'])==e['snapshotSHA256'];c=u['coordinate'];assert all(str(x) in s for x in c.values())
 if 'chikusei' in e['sourceUrl']:assert f"!3d{c['lat']}!4d{c['lng']}" in s
 elif 'sakuragawa' in e['sourceUrl']:assert f"q={c['lat']},{c['lng']}" in s
 else:assert f"!1d{c['lng']}!2d{c['lat']}" in s
 assert u['scope']=='building' and e['actorType']=='ai' and re.fullmatch(r'\d{4}-\d\d-\d\d',e['checkedAt'])
for c in d['corrections']:
 old=read(c['targetFile'])
 for part in c['path'].strip('/').split('/'):old=old[int(part)] if isinstance(old,list) else old[part]
 assert old==c['old']
for suffix in ['ab5de7e90313a0f18ac5','2e945c5e9faf1a16c8d7','00d6ef3c990590c41abf']:assert 'facility:kanto-north-'+suffix in {u['facilityId'] for u in d['unresolved']}
v['finalVerification']={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'passed':True,'checks':['116 IDの排他的完全分類','baseline/full/旧入力hash不変','再利用原本bytes/hash一致','新規取得原本hash一致','候補4件の原典リンク数値構造一致','訂正4件exact old一致','ORIGAMI/日立/土浦の保留維持'],'reusedEvidenceWithRecordedAcquisitionTime':sum(bool(x['fetchedAt']) for x in read(R/'reused-originals.json'))}
(R/'verification.json').write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n');print(json.dumps(v['finalVerification'],ensure_ascii=False))
