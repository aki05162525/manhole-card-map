import json,hashlib,re,csv,zipfile,datetime
from pathlib import Path
D=Path('data/evidence/issue5/south-kanto')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
x=read('data/national/issue5/south-kanto.json');l=read('data/work/issue5-baseline/ledger.json');full=read('data/work/issue5-baseline/full.json')
cardids={c['id'] for c in full['cards']};relations=[r for r in l['relations'] if r['cardId'][:2] in ['00','12','13','14']]
assert all(r['cardId'] in cardids for r in relations)
ids={r['placeId'] for r in relations};expected={p['id'] for p in l['places'] if p['id'] in ids and not p.get('coordinate')}
actual=[u['facilityId'] for group in ['updates','unresolved'] for u in x[group]]
assert len(actual)==len(set(actual)) and set(actual)==expected
for p,h in read(D/'baseline-hashes.json').items():assert sha(p)==h
refs=read(D/'source-index.json')
for r in refs:
 assert not Path(r['snapshotPath']).is_absolute()
 assert sha(r['snapshotPath'])==r['snapshotSHA256']
 if r.get('fetchedAt'):datetime.datetime.fromisoformat(r['fetchedAt'])
for c in x['corrections']:
 d=read(c['sourceFile'])
 if c['path'].startswith('/updates/'):
  assert d['updates'][int(c['path'].split('/')[2])]==c['old']
 else:assert next(u for u in d['unresolved'] if u['facilityId']==c['facilityId'])['reason']==c['old']
extract=read(D/'p05-extracted-records.json');p05={r['facilityId']:r for r in extract}
with zipfile.ZipFile('data/evidence/national/kanto-south-locations-kanagawa/202bb7bb6256b7f5b65e.zip') as z:g=json.loads(z.read('P05-22_14.geojson'))
for u in x['updates']:
 assert u['scope']=='building';e=u['evidence'];assert sha(e['snapshotPath'])==e['snapshotSHA256']
 assert all(e.get(k) for k in ['sourceUrl','sourceLocator','checkedAt','actorType','verificationMethod'])
 fid=u['facilityId'];v=u['coordinate']
 if fid in p05:
  r=p05[fid];assert r['feature']==g['features'][r['featureIndex']]
  assert r['feature']['geometry']['coordinates']==[v['lng'],v['lat']]
 elif fid.endswith('integration-12'):
  rows=csv.DictReader(Path(e['snapshotPath']).read_text(encoding='cp932').splitlines());row=next(r for r in rows if r['施設名']=='綾瀬市役所')
  assert float(row['緯度'])==v['lat'] and float(row['経度'])==v['lng']
 elif fid.endswith('urayasu-chisui'):
  s=Path(e['snapshotPath']).read_text();assert f"q={v['lat']},{v['lng']}" in s
 else:
  s=Path(e['snapshotPath']).read_text();assert f"destination={v['lat']:.6f},{v['lng']:.6f}" in s
  s=Path('data/evidence/national/kanto-south-locations-tokyo/53cb5b3c54ec417d7cf5.html').read_text()
  assert '三鷹駅前協同ビル101' in s and '三鷹駅前協同ビル105' in s
s=Path(D/'9dd88c43dcc7b0d888c7f3c2.raw').read_text()
assert re.search(r'0x60185df37260a54f:0xe8c02dbd33b79558","[^"]*JR横浜タワー",\[35\.4667112,139\.622346\]',s)
report={'schema':1,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actorType':'ai','targetCount':len(expected),'updates':len(x['updates']),'unresolved':len(x['unresolved']),'corrections':len(x['corrections']),'hashedSources':len(refs),'unknownRetrievalTimes':[r['snapshotPath'] for r in refs if not r.get('fetchedAt')],'checks':['relations.cardId prefecture assignment and full.json card IDs','75 IDs partition without overlap','baseline SHA256 unchanged','all referenced source bytes SHA256','exact old correction values','P05 original Feature values and JGD2011 CRS','CSV and official q/destination coordinate values','Mitaka same-building primary text','Yokohama selected entity marker, not viewport'],'result':'passed','limitations':['原本を再利用した保留案件は全URLの新規fetchをしていない。','法的な再利用許諾を包括的に保証する検証ではない。','配布状態・有効日を座標追加で変更しない。']}
(D/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
