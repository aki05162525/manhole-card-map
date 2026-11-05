"""Offline checks; writes only north/validation.json. No network or baseline mutation."""
import json,pathlib,hashlib,zipfile,io,re,html,urllib.parse,datetime
R=pathlib.Path('data/evidence/issue5/north')
def read(p):return json.loads(pathlib.Path(p).read_text())
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def walk(x):
 if isinstance(x,dict):
  yield x
  for v in x.values():yield from walk(v)
 elif isinstance(x,list):
  for v in x:yield from walk(v)
def text(p):return re.sub(r'\s+','',html.unescape(re.sub('<[^>]+>','',pathlib.Path(p).read_text())))
l=read('data/work/issue5-baseline/ledger.json');ps={p['id']:p for p in l['places']};rs={}
for r in l['relations']:
 if r['cardId'][:2] in ['01','02','03','04','05','06','07']:rs.setdefault(r['placeId'],[]).append(r)
target={i for i in rs if not ps[i].get('coordinate')};d=read('data/national/issue5/north.json');audit=read(R/'candidate-audit.json');cl=read(R/'classification.json')
assert d['schema']==1 and d['region']=='north'
u={x['facilityId']:x for x in d['updates']};h={x['facilityId']:x for x in d['unresolved']}
assert len(u)==len(d['updates']) and len(h)==len(d['unresolved'])
assert not set(u)&set(h) and set(u)|set(h)==target
assert {x['facilityId'] for x in cl}==target and len(cl)==len(target)
held={fid:x['unapprovedCandidate'] for fid,x in h.items() if x.get('unapprovedCandidate')}
assert set(audit)==set(u)|set(held)
for c in cl:assert c['cardIds']==sorted({r['cardId'] for r in rs[c['facilityId']]})
for x in read(R/'input-hashes.json'):assert sha(x['path'])==x['sha256'],x['path']
hashes={}
for artifact in ['data/national/issue5/north.json',str(R/'candidate-audit.json'),str(R/'policy.json')]:
 for e in walk(read(artifact)):
  if e.get('snapshotPath') and e.get('snapshotSHA256'):
   p=e['snapshotPath'];assert not pathlib.Path(p).is_absolute() and '..' not in pathlib.Path(p).parts
   hashes[p]=sha(p);assert hashes[p]==e['snapshotSHA256'],p
for x in read(R/'original-records.json'):
 assert sha(x['sourcePath'])==sha(x['snapshotPath'])==x['snapshotSHA256']
 if not x['fetchedAt']:assert x['savedAt'] and '不明' in x['timeNote']
for x in read(R/'fetch-records.json')+read(R/'fetch-support-records.json'):
 assert x['fetchedAt']
 if x.get('snapshotPath'):assert sha(x['snapshotPath'])==x['snapshotSHA256']
raw=[]
for fid,x in {**u,**held}.items():
 assert x['scope']=='building' and set(x['coordinate'])=={'lat','lng'} and fid in target
 e=x['evidence'];assert e['actorType']=='ai' and e['checkedAt']=='2026-11-05'
 for key in ['sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','verificationMethod']:assert e[key]
 lat,lng=x['coordinate']['lat'],x['coordinate']['lng'];assert 20<lat<46 and 122<lng<154
 a=audit[fid];assert a['sourceCoordinate']==x['coordinate'] and a['buildingIdentity'] and a['distributionEvidence']
 if a['method']=='P05-22':
  dp=a['datasetPoint'];outer=zipfile.ZipFile(e['snapshotPath']);zn,loc=dp['locator'].split('!');member,index=loc.split('#/features/');bb=zipfile.ZipFile(io.BytesIO(outer.read(zn))).read(member)
  assert hashlib.sha256(bb).hexdigest()==dp['memberSHA256'];g=json.loads(bb);f=g['features'][int(index)]
  assert f==dp['rawFeature'] and f['geometry']['coordinates']==[lng,lat]
  assert '6668' in str(g.get('crs')) and dp['coordinate']['crs']=='EPSG:6668'
  raw.append({'facilityId':fid,'rawFeature':f,'memberSHA256':dp['memberSHA256'],'locator':dp['locator'],'crs':g['crs']})
 else:
  s=urllib.parse.unquote(pathlib.Path(e['snapshotPath']).read_text())
  patterns=[f'q={lat},{lng}',f'!3d{lat}!4d{lng}',f'[{lat},{lng}]']
  assert any(p in s for p in patterns),(fid,patterns)
  raw.append({'facilityId':fid,'matchedSourcePair':next(p for p in patterns if p in s),'locator':e['sourceLocator']})
  if a['method']=='same-building-explicit':assert ps[a['sourceFacilityId']]['coordinate']==x['coordinate']
 # Every candidate keeps the target's own current distribution evidence.
 assert any(ev['snapshotSHA256']==rs[fid][0]['evidence']['snapshotSHA256'] for ev in a['distributionEvidence'])
old={x['facilityId']:x for x in read('data/national/location-updates/north-hokkaido.json')['updates']}
for c in d['corrections']:
 assert c['old']!=c['new']
 actual=ps[c['facilityId']]['name'] if c['field']=='name' else old[c['facilityId']]['evidence']['verificationMethod']
 assert c['old']==actual
 if c['field']!='name':assert {**u,**held}[c['facilityId']]['evidence']['verificationMethod']==c['new']
proposal=read('data/overrides/proposals/north.json');pc=[]
for p in proposal['places']:
 fid=p['id'];assert fid in ps
 assert fid in target or ps[fid].get('coordinate')
 pc.append({'facilityId':fid,'classification':'candidate' if fid in u else 'unresolved' if fid in h else 'already-coordinate'})
result={'schema':1,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actorType':'ai','passed':True,'targetCount':len(target),'candidateCount':len(u),'unresolvedCount':len(h),'correctionCount':len(d['corrections']),'evidenceHashesChecked':len(hashes),'preservedOriginalCount':len(read(R/'original-records.json')),'baselineAndRegionalInputsUnchanged':True,'rawCoordinateChecks':raw,'proposalClassification':pc,'limits':['文字列・hashの一致だけでは建物同定を自動保証しない。candidate-audit.jsonの施設別読解と親レビューが必要。','全162件の再分類・既存根拠hash確認。146件全部への新規Web調査完了ではない。','候補はmanifestへ未採用。Google由来地点の利用条件レビューを親へ引継ぐ。']}
(R/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['rawCoordinateChecks','proposalClassification','limits']},ensure_ascii=False))
