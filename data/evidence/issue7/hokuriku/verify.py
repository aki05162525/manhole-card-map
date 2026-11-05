"""Read-only verification against saved hashes and original numeric records."""
import json,hashlib,zipfile,io,re,xml.etree.ElementTree as ET
from pathlib import Path
B=Path('data/evidence/issue7/hokuriku')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
for f in ['input-hashes.json','referenced-snapshot-hashes.json']:
 for p,h in read(B/f).items():assert sha(p)==h,p
out=read('data/national/issue7/hokuriku.json');A=read('data/work/issue7-baseline/assignments.json')['hokuriku'];ids=[r['facilityId']for r in out['updates']+out['unresolved']];assert sorted(ids)==sorted(A) and len(ids)==len(set(ids))
fields=set(re.findall('json:"([^"]+)"',Path('cmd/builddata/ledger.go').read_text().split('type Evidence struct {')[1].split('}')[0]))
z=zipfile.ZipFile('data/evidence/issue5/chubu/P05-22_GML.zip');gml_checks=[]
for u in out['updates']:
 e=u['evidence'];assert set(e)==fields;assert sha(e['snapshotPath'])==e['snapshotSHA256'];assert u['scope']=='building'
 if e['snapshotPath'].endswith('.zip'):
  match=re.search(r'(P05-22_(\d+)_GML.zip)!(P05-22_\d+.geojson)#/features/(\d+)',e['sourceLocator']);nested=zipfile.ZipFile(io.BytesIO(z.read(match[1])));j=json.loads(nested.read(match[3]));f=j['features'][int(match[4])];assert f['geometry']['coordinates']==[u['coordinate']['lng'],u['coordinate']['lat']]
  # GML crosscheck: exact named facility record and linked gml:Point, independent axis order.
  files=[n for n in nested.namelist() if n.endswith('.xml') and n.startswith('P05-')]
  raw=nested.read(files[0]).decode('utf-8')
  # P05 original contains malformed publicOfficeClassification public office tags.
  # Extract complete record and referenced Point without altering original bytes.
  blocks=re.findall(r'<ksj:LocalGovernmentOfficeAndPublicMeetingFacility\b[\s\S]*?</ksj:LocalGovernmentOfficeAndPublicMeetingFacility>',raw)
  candidates=[b for b in blocks if '<ksj:Name>'+f['properties']['P05_003']+'</ksj:Name>' in b and '<ksj:address>'+f['properties']['P05_004']+'</ksj:address>' in b]
  assert candidates,(u['facilityId'],'GML name/address')
  positions=[]
  for block in candidates:
   ref=re.search(r'xlink:href="#([^"]+)"',block)[1]
   point=re.search(r'<gml:Point\b[^>]*gml:id="'+re.escape(ref)+r'"[\s\S]*?</gml:Point>',raw)[0]
   pos=re.search(r'<gml:pos[^>]*>([^<]+)</gml:pos>',point)[1]
   positions.append([float(v)for v in pos.split()])
  assert any(abs(p[0]-u['coordinate']['lat'])<1e-7 and abs(p[1]-u['coordinate']['lng'])<1e-7 for p in positions),(u['facilityId'],positions)
  gml_checks.append({'facilityId':u['facilityId'],'positionsLatLng':positions,'toleranceDegrees':1e-7})
 else:
  text=Path(e['snapshotPath']).read_text();m=re.search(r'https://maps.google.com/maps\?q=([0-9.]+),([0-9.]+)',text);assert u['coordinate']=={'lat':float(m[1]),'lng':float(m[2])}
for c in out['corrections']:
 val=read(c['path'])
 for k in c['pointer'].strip('/').split('/'):val=val[int(k)] if isinstance(val,list) else val[k]
 assert val==c['old']
print(json.dumps({'status':'pass','facilities':len(ids),'updates':len(out['updates']),'unresolved':len(out['unresolved']),'gmlCrosschecks':gml_checks},ensure_ascii=False,indent=2))
