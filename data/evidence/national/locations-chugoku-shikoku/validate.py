import json,pathlib,hashlib,zipfile,io,re,html,urllib.parse
import research as R
out=json.load(open('data/national/location-updates/chugoku-shikoku.json'))
targets=json.load(open(R.ROOT/'targets.json'));decisions=json.load(open(R.ROOT/'decisions.json'))
expected={t['id'] for t in targets};ids=[r['facilityId'] for r in out['updates']+out['unresolved']]
assert len(ids)==len(set(ids))==170 and set(ids)==expected
assert out['schema']==1 and out['region']=='chugoku-shikoku'
manifest=json.load(open(R.ROOT/'reused-manifest.json'));checks=0
for m in manifest:
 if m.get('snapshotPath'):
  p=pathlib.Path(m['snapshotPath']);assert p.parent==R.ROOT
  assert hashlib.sha256(p.read_bytes()).hexdigest()==m['sha256']
  assert m.get('fetchedAt'),m
  checks+=1
for u in out['updates']:
 e=u['evidence'];p=pathlib.Path(e['snapshotPath']);b=p.read_bytes()
 assert hashlib.sha256(b).hexdigest()==e['snapshotSHA256']
 assert 32<u['coordinate']['lat']<37 and 130<u['coordinate']['lng']<135
 assert any(m.get('requestedUrl')==e['sourceUrl'] and m.get('sha256')==e['snapshotSHA256'] for m in manifest)
 if 'P05-22' in e['sourceUrl']:
  member,rest=e['sourceLocator'].split('!');geojson,row=rest.split('#/features/')
  f=json.loads(zipfile.ZipFile(io.BytesIO(zipfile.ZipFile(io.BytesIO(b)).read(member))).read(geojson))['features'][int(row)]
  assert f['geometry']['coordinates']==[u['coordinate']['lng'],u['coordinate']['lat']]
 else:
  s=urllib.parse.unquote(html.unescape(R.read({'snapshotPath':str(p)})))
  nums={float(x) for x in re.findall(r'(?<![\d.])\d{2,3}\.\d+',s)}
  assert u['coordinate']['lat'] in nums,(u['facilityId'],'lat')
  assert u['coordinate']['lng'] in nums,(u['facilityId'],'lng')
for u in out['unresolved']:
 assert u['reason'] and u['attempts']
 assert all(a['url'] and a['result'] for a in u['attempts'])
audit=json.load(open(R.ROOT/'facility-audit.json'))
assert {a['facilityId'] for a in audit}==expected
report={'targetFacilities':170,'updates':len(out['updates']),'unresolved':len(out['unresolved']),'uniqueAssignment':True,'allEvidenceHashesMatch':True,'allCoordinateValuesMatchOriginalBytes':True,'p05RecordsReopenedAndCompared':sum('P05-22' in u['evidence']['sourceUrl'] for u in out['updates']),'sourceRecords':len(manifest),'snapshotsHashed':checks,'failedAcquisitions':sum(bool(m.get('error')) for m in manifest),'outputSHA256':hashlib.sha256(pathlib.Path('data/national/location-updates/chugoku-shikoku.json').read_bytes()).hexdigest()}
(R.ROOT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
