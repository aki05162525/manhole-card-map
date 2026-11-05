from research import *
import html
out=read('data/national/issue7/tokai.json');ups=out['updates'];uns=out['unresolved'];allids=[x['facilityId'] for x in ups+uns]
assert len(allids)==len(set(allids))==len(ids)==52 and set(allids)==set(ids)
for p,h in read(OUT/'input-hashes.json').items():assert sha(p)==h,(p,'changed')
for n,h in read('data/work/issue7-baseline/hashes.json').items():assert sha('data/work/issue7-baseline/'+n)==h
fields=set(re.findall(r'json:"([^\"]+)"',pathlib.Path('cmd/builddata/ledger.go').read_text().split('type Evidence struct {')[1].split('}')[0]));assert len(fields)==7
records=[]
for f in ['fetch-records.json','fetch-extra.json','fetch-extra2.json','fetch-extra3.json','fetch-extra4.json']:records+=read(OUT/f)
for r in records:
 assert r['fetchedAt']>=r['startedAt']
 if 'snapshotPath' in r:assert sha(r['snapshotPath'])==r['snapshotSHA256']
refs={}
def walk(x):
 if isinstance(x,dict):
  if all(k in x for k in ['snapshotPath','snapshotSHA256']):
   p=x['snapshotPath'];assert sha(p)==x['snapshotSHA256'],p;refs[p]=x['snapshotSHA256']
  for v in x.values():walk(v)
 elif isinstance(x,list):
  for v in x:walk(v)
walk(out);walk(read(OUT/'investigation.json'))
z=zipfile.ZipFile('data/evidence/issue5/chubu/P05-22_GML.zip');raws={x['facilityId']:x for x in read(OUT/'p05-records.json')};numerics=[]
for u in ups:
 assert set(u)=={'facilityId','coordinate','scope','evidence'};assert set(u['evidence'])==fields;assert u['scope']=='building';assert u['evidence']['actorType']=='ai'
 id=u['facilityId'];c=u['coordinate'];assert 20<c['lat']<46 and 120<c['lng']<146
 if id in raws:
  r=raws[id];a,b=r['locator'].split('!');member,idx=b.split('#/features/');idx=int(idx);zz=zipfile.ZipFile(io.BytesIO(z.read(a)));raw=zz.read(member);assert hashlib.sha256(raw).hexdigest()==r['memberSHA256'];f=json.loads(raw)['features'][idx];assert f==r['rawFeature'];lng,lat=f['geometry']['coordinates'];assert c=={'lat':lat,'lng':lng}
  xml=zz.read(member.replace('.geojson','.xml')).decode();record=re.search(r'<ksj:LocalGovernmentOfficeAndPublicMeetingFacility gml:id="P05_'+str(idx)+r'">(.*?)</ksj:LocalGovernmentOfficeAndPublicMeetingFacility>',xml,re.S)[1];pt=re.search(r'xlink:href="#([^\"]+)"',record)[1];m=re.search(r'<gml:Point gml:id="'+pt+r'">\s*<gml:pos>([^<]+)',xml);glat,glng=map(float,m[1].split());assert abs(glat-lat)<1e-7 and abs(glng-lng)<1e-7;assert f['properties']['P05_003'] in record;assert f['properties']['P05_004'] in record
  numerics.append({'facilityId':id,'geojsonExact':True,'gmlLatLngWithin1e-7':True,'gmlPoint':pt})
 else:
  s=pathlib.Path(u['evidence']['snapshotPath']).read_text()
  if ids.index(id)==3:
   m=re.search(r'var gConf\s*=\s*\{lat:([\d.]+),lng:([\d.]+)',s);assert c==dict(zip(['lat','lng'],map(float,m.groups())));assert 'q='+m[1]+','+m[2] in s
  elif ids.index(id)==28:
   m=re.search(r"label: '4',\s*name: (\".*?\"),\s*lat: Number\('([\d.]+)'\),\s*lng: Number\('([\d.]+)'\)",s);assert json.loads(m[1])=='飛騨古川まちなか観光案内所';assert c=={'lat':float(m[2]),'lng':float(m[3])}
  else:
   row=next(t for t in re.findall(r'<tr.*?</tr>',s,re.S) if '0000000030' in t);cells=[html.unescape(re.sub('<[^>]+>','',t)).strip() for t in re.findall(r'<td[^>]*>(.*?)</td>',row,re.S)];assert c=={'lat':float(cells[14]),'lng':float(cells[15])};assert cells[3]=='水道部庁舎' and cells[8]=='静岡県沼津市御幸町2-20'
  numerics.append({'facilityId':id,'officialHtmlNumericExact':True})
for c in out['corrections']:
 if c.get('textReplacement'):
  assert pathlib.Path(c['targetPath']).read_text().count(c['old'])==1
  continue
 d=read(c['targetPath'])
 if 'jsonPointer' in c:
  for token in c['jsonPointer'].strip('/').split('/'):d=d[int(token)] if isinstance(d,list) else d[token]
 else:d=next(x for x in d['places'] if x['id']==c['facilityId'])[c['selector']['field']]
 assert d==c['old']
# Read and hash prior evidence related to these 52, separately from new fetches.
prior=[]
for x in old['updates']+old['unresolved']:
 if x['facilityId'] in ids:prior.append(x)
walk(prior)
save(OUT/'referenced-snapshot-hashes.json',refs)
save(OUT/'validation.json',{'success':True,'assigned':52,'candidates':len(ups),'unresolved':len(uns),'allIdsUniqueAndClassified':True,'fixedInputHashesUnchanged':True,'goEvidenceFields':sorted(fields),'newFetchAttempts':len(records),'newFetchResponses':sum('snapshotPath' in r for r in records),'newFetchFailures':sum('snapshotPath' not in r for r in records),'referencedSnapshotHashesChecked':len(refs),'numerics':numerics,'exactCorrectionsChecked':len(out['corrections']),'limits':'機械検査は建物同定の独立レビューや現地確認の代替ではない。新取得の成功は本文内容の正しさ・施設同定の承認を意味しない。'})
print('VALIDATED',len(ups),'candidates',len(uns),'unresolved',len(records),'new fetch attempts',len(refs),'snapshot hashes')
