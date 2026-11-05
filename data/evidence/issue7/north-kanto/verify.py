from research import *
from collections import Counter
out=read('data/national/issue7/north-kanto.json');audit=read(BASE/'investigation.json');p05=read(BASE/'p05-search.json')
fixed=read('data/work/issue7-baseline/hashes.json')
for name,h in fixed.items():assert sha(pathlib.Path('data/work/issue7-baseline',name).read_bytes())==h,name
for path,h in read(BASE/'input-hashes.json').items():assert sha(pathlib.Path(path).read_bytes())==h,path
allids=[r['facilityId'] for s in ['updates','unresolved'] for r in out[s]]
assert len(allids)==len(set(allids)) and set(allids)==set(ids)
assert len(ids)==len(set(ids));assert {a['facilityId'] for a in audit}==set(ids)
fields={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
records=sum([read(BASE/f) for f in ['fetch-records.json','additional-fetch-records.json','targeted-fetch-records.json']],[])
hashes={};fetched=[]
for r in records:
 if 'snapshotPath' not in r:continue
 p=r['snapshotPath'];assert sha(pathlib.Path(p).read_bytes())==r['snapshotSHA256'],p
 assert r['fetchedAt']>=r['requestedAt'];hashes[p]=r['snapshotSHA256'];fetched.append(r)
oldhashes={};missing=[]
for i in ids:
 for e in inv[i]['evidence']:
  p=e.get('originalPath',e['snapshotPath']);h=e['snapshotSHA256']
  if not pathlib.Path(p).exists():missing.append(p);continue
  assert sha(pathlib.Path(p).read_bytes())==h,p
  oldhashes[p]=h
z=zipfile.ZipFile(p05['zipPath']);assert sha(pathlib.Path(p05['zipPath']).read_bytes())==p05['zipSHA256']
for u in out['updates']:
 assert set(u['evidence'])==fields;assert set(u['coordinate'])=={'lat','lng'};assert u['scope']=='building'
 e=u['evidence'];assert sha(pathlib.Path(e['snapshotPath']).read_bytes())==e['snapshotSHA256']
 if e['snapshotPath']==p05['zipPath']:
  archive,loc=e['sourceLocator'].split('!');member,ix=loc.split('#/features/');b=zipfile.ZipFile(io.BytesIO(z.read(archive))).read(member);feat=json.loads(b)['features'][int(ix)];lng,lat=feat['geometry']['coordinates'];assert u['coordinate']=={'lat':lat,'lng':lng}
  a=next(a for a in audit if a['facilityId']==u['facilityId']);assert a['selectedP05']['feature']==feat;assert a['selectedP05']['memberSHA256']==sha(b)
 else:
  text=pathlib.Path(e['snapshotPath']).read_text();assert "'lat':'35.8364752846319','lon':'139.80710998177528'" in text
  js=next(r for r in records if r['sourceUrl']=='https://www.city.soka.saitama.jp/enjoycore/js/map/map.js');s=pathlib.Path(js['snapshotPath']).read_text();assert 'new google.maps.LatLng(o.lat,o.lon)' in s and 'marker=new google.maps.Marker({position:e})' in s
for c in out['corrections']:
 doc=read(c['targetFile'])
 for k in c['path'].strip('/').split('/'):doc=doc[int(k)] if isinstance(doc,list) else doc[k]
 assert doc==c['old']
assert all(any(a['kind']=='new-web-fetch' for a in r['attempts']) for r in audit)
result={'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'assignedIDs':len(ids),'candidates':len(out['updates']),'unresolved':len(out['unresolved']),'corrections':len(out['corrections']),'allIDsClassifiedExactlyOnce':True,'baselineHashesUnchanged':True,'otherRecordedInputHashesUnchanged':True,'newFetchAttempts':len(records),'newFetchSuccess200':sum(r.get('status')==200 for r in records),'newSnapshotsHashVerified':len(hashes),'oldOriginalsHashVerified':len(oldhashes),'missingOldOriginals':sorted(set(missing)),'coordinateOriginalValuesVerified':len(out['updates']),'exactCorrectionOldVerified':len(out['corrections']),'allIDsNewWebAttempt':True,'reasonCategories':dict(Counter(r['reasonCategory'] for r in out['unresolved']))}
save('verification.json',result);save('referenced-original-hashes.json',oldhashes);print(json.dumps(result,ensure_ascii=False,indent=2))
