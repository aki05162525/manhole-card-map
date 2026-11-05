from pathlib import Path
import json,hashlib,zipfile,io,re,html,datetime
R=Path('data/evidence/issue5/chubu')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
d=read('data/national/issue5/chubu.json');l=read('data/work/issue5-baseline/ledger.json');full=read('data/work/issue5-baseline/full.json');cards={x['id'] for x in full['cards']}
r={x['placeId'] for x in l['relations'] if 15<=int(x['cardId'][:2])<=23};expected={x['id'] for x in l['places'] if x['id'] in r and not x.get('coordinate')};actual=[x['facilityId'] for x in d['updates']+d['unresolved']]
assert set(actual)==expected and len(actual)==len(set(actual))==138
for row in read(R/'classification.json'):assert set(row['cardIds'])<=cards and all(15<=int(x)<=23 for x in row['prefectureCodes'])
for x in read(R/'input-hashes.json'):assert sha(x['path'])==x['sha256'],x['path']
hashes={}
def walk(x):
 if isinstance(x,dict):
  p=x.get('snapshotPath');h=x.get('snapshotSHA256')
  if p and h:
   if p not in hashes: hashes[p]=sha(p)
   assert hashes[p]==h,p
  for y in x.values():walk(y)
 elif isinstance(x,list):
  for y in x:walk(y)
walk(d);walk(read(R/'reused-sources.json'))
for p in R.glob('*.source.json'):
 m=read(p)
 if m.get('snapshotPath'):walk(m)
z=zipfile.ZipFile(R/'P05-22_GML.zip');records=read(R/'p05-records.json');coordinates=[]
for u,record in zip(d['updates'],records):
 assert u['facilityId']==record['facilityId'];nested,loc=record['locator'].split('!');member,idx=loc.split('#/features/');zz=zipfile.ZipFile(io.BytesIO(z.read(nested)));b=zz.read(member);raw=read_geo=json.loads(b)
 assert hashlib.sha256(b).hexdigest()==record['memberSHA256'];f=raw['features'][int(idx)];assert f==record['rawFeature'];assert f['geometry']['coordinates']==[u['coordinate']['lng'],u['coordinate']['lat']];assert '6668' in str(raw['crs'])
 gml=zz.read(member.replace('.geojson','.xml')).decode();matches=re.findall(r'<gml:Point gml:id="pt'+idx+r'">\s*<gml:pos>([^<]+)',gml);assert len(matches)==1
 lat,lng=map(float,matches[0].split());assert abs(lat-u['coordinate']['lat'])<1e-7 and abs(lng-u['coordinate']['lng'])<1e-7
 coordinates.append({'facilityId':u['facilityId'],'geojsonExact':True,'gmlLatitudeLongitude':matches[0],'gmlRoundingTolerance':1e-7,'buildingIdentity':'manually-reviewed-current-official-distribution-versus-named-P05-building-record'})
# Independent text assertions for each of the eight manually selected buildings.
assertions={
 'tsubame-card':['燕市役所','1934','夜間休日受付','下水道課'],
 'murakami-card':['荒川地区公民館','104-25'],
 'arakawa-facility':['荒川地区公民館','104-25'],
 'chikuma-card':['上山田文化会館','三丁目1番地1'],
 'chikuma-facilities':['上山田文化会館','3-1-1'],
 'oyabe-card':['市役所上下水道課窓口','本町1番1号'],
 'numazu-card':['本庁舎1階','総合案内','水道部庁舎'],
 'numazu-office':['御幸町16-1'],
 'iwata-card':['福田400','福田支所2階'],
 'yoshida-card':['吉田町役場2階上下水道課','住吉87'],
 'sado-offices':['金井市民センター','第2庁舎1階','0259-63-3843'],
 'p05-catalog':['JGD2011','オープンデータ'],
 'p05-terms':['PDL1.0','2026','3月23日']}
for key,terms in assertions.items():
 text=html.unescape(re.sub('<[^>]+>',' ',(R/(key+'.html')).read_text()));text=re.sub(r'\s+','',text)
 for term in terms:assert term in text,(key,term)
for c in d['corrections']:
 old=read(c['targetFile']);row=next(x for x in old['updates'] if x['facilityId']==c['facilityId']);assert row['evidence']==c['old'];assert c['new']!=c['old']
result={'schema':1,'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actorType':'ai','targetCount':len(actual),'updateCount':len(d['updates']),'unresolvedCount':len(d['unresolved']),'exactCorrections':len(d['corrections']),'referencedHashesVerified':len(hashes),'baselineHashesUnchanged':True,'allFacilityIdsExactlyClassified':True,'originalCoordinateChecks':coordinates,'currentOfficialTextAssertions':assertions,'scope':'原本bytes/hash、数値・軸順、所属ID、訂正old一致を再検証。建物同定は上記公式本文を読んだAI判断であり、この機械検査自体が建物形状を検証するものではない。','unknownRetrievalTimes':[x['reusedFrom'] for x in read(R/'reused-sources.json') if not x['fetchedAt']]}
(R/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if not isinstance(v,(list,dict))},ensure_ascii=False))
