from research import *
import csv
x=read('data/national/issue7/south-kanto.json')
actual=[r['facilityId'] for group in ['updates','unresolved'] for r in x[group]]
assert len(actual)==len(set(actual))==64 and set(actual)==set(ids)
for p,h in read('data/evidence/issue7/south-kanto/input-hashes.json').items():assert sha(ROOT/p)==h,p
for name,h in read('data/work/issue7-baseline/hashes.json').items():assert sha(ROOT/'data/work/issue7-baseline'/name)==h,name
records=read('data/evidence/issue7/south-kanto/fetch-records.json')
assert len({r['url'] for r in records})==len(records)
for r in records:
 datetime.datetime.fromisoformat(r['fetchedAt'])
 if 'snapshotPath' in r:assert sha(ROOT/r['snapshotPath'])==r['snapshotSHA256'],r['snapshotPath']
reused=read('data/evidence/issue7/south-kanto/reused-source-index.json')
for r in reused:assert sha(ROOT/r['snapshotPath'])==r['snapshotSHA256'],r['snapshotPath']
for c in x['corrections']:
 doc=read(c['sourceFile'])
 for key in c['path'].split('/')[1:]:doc=doc[int(key)] if isinstance(doc,list) else doc[key]
 assert doc==c['old']
 assert c['applied']==False
fields={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
z=zipfile.ZipFile(ROOT/'data/evidence/issue5/chubu/P05-22_GML.zip')
src=read('data/evidence/issue5/chubu/P05-22_GML.zip.source.json')
assert sha(ROOT/src['path'])==src['sha256']
building={r['facilityId']:r for r in read('data/evidence/issue7/south-kanto/building-verification.json')}
for u in x['updates']:
 e=u['evidence'];assert set(e)==fields and e['actorType']=='ai';assert u['scope']=='building'
 assert sha(ROOT/e['snapshotPath'])==e['snapshotSHA256']
 ex=building[u['facilityId']]['extraction']
 if 'featureIndex' in ex:
  zz=zipfile.ZipFile(io.BytesIO(z.read(ex['member'])));g=json.loads(zz.read(ex['geojson']))
  assert g['crs']['properties']['name']=='urn:ogc:def:crs:EPSG::6668'
  assert g['features'][ex['featureIndex']]==ex['feature']
  assert ex['feature']['geometry']['coordinates']==[u['coordinate']['lng'],u['coordinate']['lat']]
 elif ex['type']=='csv':
  b=(ROOT/e['snapshotPath']).read_bytes()
  try:t=b.decode('utf-8-sig')
  except:t=b.decode('cp932')
  r=next(r for r in csv.DictReader(t.splitlines()) if r[ex['idColumn']]==ex['idValue'])
  assert r==ex['row']
  assert float(r[ex['latColumn']])==u['coordinate']['lat'] and float(r[ex['lngColumn']])==u['coordinate']['lng']
 elif ex['type']=='jsonld-localbusiness':
  t=(ROOT/e['snapshotPath']).read_text()
  objs=[json.loads(v) for v in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>',t)]
  obj=next(v for v in objs if v.get('@type')=='LocalBusiness')
  assert obj==ex['object']
  assert obj['geo']['latitude']==u['coordinate']['lat'] and obj['geo']['longitude']==u['coordinate']['lng']
 else:
  assert ex['literal'] in (ROOT/e['snapshotPath']).read_text()
 for s in building[u['facilityId']]['supportingSources']:assert sha(ROOT/s['snapshotPath'])==s['snapshotSHA256']
for r in x['unresolved']:
 assert r['attempts'] and r['investigationStatus'].startswith('new-fetch')
 for a in r['attempts']:
  if a.get('snapshotPath'):assert sha(ROOT/a['snapshotPath'])==a['snapshotSHA256']
report={'result':'passed','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'assigned':len(ids),'updates':len(x['updates']),'unresolved':len(x['unresolved']),'corrections':len(x['corrections']),'newFetchAttempts':len(records),'newHTTP200':sum(r.get('status')==200 for r in records),'reusedSourcesHashed':len(reused),'checks':['64-ID exact partition and no duplicate','all four baseline file hashes unchanged and published baseline hashes match','all fetched raw bytes hash and timestamps','all reused source index hashes','P05 nested ZIP feature numeric values and EPSG:6668','CSV row exact equality and numeric values','official HTML q literal and facility JSON-LD GeoCoordinates','Evidence exact seven fields','correction old values exact match','every unresolved ID has fresh attempts'],'limitations':['HTTP取得と数値スクリーニングは建物の同定完了ではない。','旧原本取得時刻はsource-index由来。新規取得時刻で置換しない。','既存relation/status・manifest・Go/UIに適用していない。']}
save(OUT/'validation.json',report);print(json.dumps(report,ensure_ascii=False))
