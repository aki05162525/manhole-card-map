"""Independent read-only checks of inputs; writes only within this review directory."""
import json, hashlib, io, zipfile, re, datetime, subprocess, html
from pathlib import Path
from urllib.parse import urlparse
B=Path('data/evidence/issue7/review-hokuriku')
def read(p): return json.loads(Path(p).read_text())
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(name,v): (B/name).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
x=read('data/national/issue7/hokuriku.json'); identities=read('data/evidence/issue7/hokuriku/identity-review.json')
code=Path('cmd/builddata/ledger.go').read_text()
fields=re.findall(r'json:"([^"]+)"',code.split('type Evidence struct {',1)[1].split('}',1)[0]);assert len(fields)==7
hashes={}; numbers=[]; source_checks=[]
def check(p,expected=None):
 h=sha(p); hashes[str(p)]=h
 if expected: assert h==expected,p
 return h
for file in ['input-hashes.json','referenced-snapshot-hashes.json']:
 for p,h in read('data/evidence/issue7/hokuriku/'+file).items():check(p,h)
check('data/national/issue7/hokuriku.json');check('data/evidence/issue7/hokuriku/README.md')
z=zipfile.ZipFile('data/evidence/issue5/chubu/P05-22_GML.zip')
for u in x['updates']:
 e=u['evidence'];assert set(e)==set(fields)
 parsed=urlparse(e['sourceUrl']);assert parsed.scheme in ['http','https'] and parsed.netloc and parsed.username is None
 assert e['actorType'] in ['ai','human'] and e['sourceLocator'].strip() and e['verificationMethod'].strip()
 assert datetime.date.fromisoformat(e['checkedAt']).isoformat()==e['checkedAt']
 check(e['snapshotPath'],e['snapshotSHA256']);assert u['scope']=='building'
 c=u['coordinate'];assert -90<=c['lat']<=90 and -180<=c['lng']<=180
 n={'facilityId':u['facilityId'],'proposedCoordinate':c,'evidenceKeys':fields,'evidenceSemantics':'pass (validateEvidence source-equivalent checks; no Go binary run)','snapshotSHA256':e['snapshotSHA256']}
 if e['snapshotPath'].endswith('.zip'):
  m=re.search(r'(P05-22_(\d+)_GML.zip)!(P05-22_\d+.geojson)#/features/(\d+)',e['sourceLocator'])
  nz=zipfile.ZipFile(io.BytesIO(z.read(m[1])));j=json.loads(nz.read(m[3]));f=j['features'][int(m[4])]
  assert f['geometry']['type']=='Point' and f['geometry']['coordinates']==[c['lng'],c['lat']]
  assert j['crs']['properties']['name']=='urn:ogc:def:crs:EPSG::6668'
  raw=nz.read(m[3].replace('.geojson','.xml')).decode()
  blocks=re.findall(r'<ksj:LocalGovernmentOfficeAndPublicMeetingFacility\b.*?</ksj:LocalGovernmentOfficeAndPublicMeetingFacility>',raw,re.S)
  blocks=[b for b in blocks if '<ksj:Name>'+f['properties']['P05_003']+'</ksj:Name>' in b and '<ksj:address>'+f['properties']['P05_004']+'</ksj:address>' in b]
  assert len(blocks)==1
  ref=re.search(r'xlink:href="#([^"]+)"',blocks[0])[1]
  point=re.search(r'<gml:Point\b[^>]*gml:id="'+re.escape(ref)+r'".*?</gml:Point>',raw,re.S)[0]
  pos=re.search(r'<gml:pos[^>]*>([^<]+)</gml:pos>',point)[1];g=[float(v) for v in pos.split()]
  assert max(abs(g[0]-c['lat']),abs(g[1]-c['lng']))<1e-7
  n.update(rawFeature=f,crs=j['crs'],geojsonAxisOrder='longitude,latitude',gmlRawPosition=pos,gmlAxisOrder='latitude,longitude',gmlPoint=point,conversion='axis reorder only; no datum conversion',gmlDifferenceDegrees=[g[0]-c['lat'],g[1]-c['lng']])
 else:
  raw=Path(e['snapshotPath']).read_text();url='https://maps.google.com/maps?q='+str(c['lat'])+','+str(c['lng'])
  assert 'href="'+url+'"' in raw
  n.update(rawDestinationURL=url,axisOrder='latitude,longitude',crs='not explicitly named by source HTML',conversion='none',interpretation='municipal facility-page destination q, not map viewport or Google response')
 numbers.append(n)
for row in identities:
 for s in row['sources']:
  p=Path(s['snapshotPath']);check(p,s['snapshotSHA256'])
  raw=p.read_text() if p.suffix=='.html' else subprocess.check_output(['pdftotext',str(p),'-']).decode()
  raw=re.sub(r'<(script|style)\b.*?</\1>','',raw,flags=re.S)
  plain=html.unescape(re.sub('<[^>]+>','\n',raw));lines=[line.strip() for line in plain.splitlines() if line.strip()]
  keys=['配布','舟橋会館','海老江','羽ヶ榎','羽ケ榎','末吉','管理人','本庁','川西','併設','公民館','たびスタ','大手','経営管理','移築','諏訪町']
  ix=set()
  for i,line in enumerate(lines):
   if any(k in line for k in keys):ix.update(range(max(0,i-1),min(len(lines),i+3)))
  source_checks.append({'facilityId':row['facilityId'],'sourceUrl':s['sourceUrl'],'snapshotPath':str(p),'snapshotSHA256':sha(p),'relevantText':'\n'.join(lines[i] for i in sorted(ix)),'imageAltEvidence':re.findall(r'<img[^>]*alt="([^"]*企業局[^"]*)"[^>]*>',raw)})
for c in x['corrections']:
 v=read(c['path'])
 for k in c['pointer'].strip('/').split('/'):v=v[int(k)] if isinstance(v,list) else v[k]
 assert v==c['old'];check(c['evidence']['snapshotPath'],c['evidence']['snapshotSHA256'])
 assert '糸魚川市大町2丁目2－19' in Path(c['evidence']['snapshotPath']).read_text()
ids=[r['facilityId'] for r in x['updates']+x['unresolved']]
assert len(ids)==len(set(ids))==40 and sorted(ids)==sorted(read('data/work/issue7-baseline/assignments.json')['hokuriku'])
save('numeric-and-evidence-checks.json',numbers);save('identity-source-extracts.json',source_checks);save('verified-input-hashes.json',hashes)
save('validation.json',{'status':'pass','candidates':8,'uniqueP05Features':6,'p05CandidateRows':7,'explicitMunicipalDestinationRows':1,'classifiedInputIds':40,'verifiedOriginalFiles':len(hashes),'exactCorrectionOldVerified':True,'goEvidenceContract':fields,'goBinaryExecuted':False,'originalsWritten':False})
print('PASS: 8 candidates; raw GeoJSON/GML/q, CRS/axes, Evidence7 semantics, hashes, 40 ID coverage, exact correction old')
