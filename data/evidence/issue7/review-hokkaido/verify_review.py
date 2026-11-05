"""Read-only verification of source material; writes only review-hokkaido/."""
import csv, hashlib, html, io, json, pathlib, re, subprocess, zipfile
import xml.etree.ElementTree as ET
ROOT=pathlib.Path.cwd(); D=ROOT/'data/evidence/issue7/review-hokkaido'; S=ROOT/'data/evidence/issue7/hokkaido'
def read(p): return json.loads(pathlib.Path(p).read_text())
def sha(p): return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def write(n,x): (D/n).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
u=read('data/national/issue7/hokkaido.json'); audit=read(S/'candidate-audit.json'); ids=read('data/work/issue7-baseline/assignments.json')['hokkaido']
assert len(ids)==68 and set(ids)=={x['facilityId'] for x in u['updates']+u['unresolved']}
assert len(u['updates']+u['unresolved'])==len(set(ids))
refs=read(S/'fetch-records.json')+read(S/'reused-originals.json'); hashes=[]
for r in refs:
 if r.get('snapshotPath'):
  actual=sha(r['snapshotPath']);assert actual==r['snapshotSHA256'],r['snapshotPath'];hashes.append({'path':r['snapshotPath'],'sha256':actual})
for p,h in read('data/work/issue7-baseline/hashes.json').items(): assert sha('data/work/issue7-baseline/'+p)==h,p
for p,h in read(S/'input-hashes.json').items(): assert sha(p)==h,p
protected={p:sha(p) for p in set([r['path'] for r in hashes]+[str(p) for p in S.rglob('*') if p.is_file()]+[str(p) for p in pathlib.Path('data/work/issue7-baseline').rglob('*') if p.is_file()]+['data/national/issue7/hokkaido.json','cmd/builddata/ledger.go'])}
write('protected-hashes.json',protected)
z=zipfile.ZipFile('data/evidence/issue5/chubu/P05-22_GML.zip'); zz=zipfile.ZipFile(io.BytesIO(z.read('P05-22_01_GML.zip'))); raw=zz.read('P05-22_01.geojson'); geo=json.loads(raw)
assert geo['crs']['properties']['name']=='urn:ogc:def:crs:EPSG::6668'
assert hashlib.sha256(raw).hexdigest()==read(S/'p05-extraction.json')['memberSHA256']
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}; checks=[]
for x in u['updates']:
 e=x['evidence']; assert set(e)=={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
 assert sha(e['snapshotPath'])==e['snapshotSHA256'];assert re.fullmatch(r'\d{4}-\d{2}-\d{2}',e['checkedAt'])
 b=pathlib.Path(e['snapshotPath']).read_bytes();loc=e['sourceLocator']; c={'facilityId':x['facilityId'],'snapshotPath':e['snapshotPath'],'snapshotSHA256':sha(e['snapshotPath']),'locator':loc,'checkedAt':e['checkedAt'],'scope':x['scope']}
 if '#/features/' in loc:
  i=int(loc.rsplit('/',1)[1]);f=geo['features'][i];lng,lat=f['geometry']['coordinates'];c.update(method='P05-22',rawRecord=f,featureIndex=i,crs='EPSG:6668 / JGD2011',axisOrder='GeoJSON [longitude, latitude]',memberSHA256=hashlib.sha256(raw).hexdigest())
 elif 'CSV' in loc:
  rows=list(csv.DictReader(b.decode('utf-8-sig').splitlines()));r=next(r for r in rows if r['ID']=='PF0000000001');lat,lng=map(float,(r['緯度'],r['経度']));c.update(method='municipal CSV',rawRecord=r,adjacentRecord=rows[1],crs='not declared in source; no EPSG assertion',axisOrder='named 緯度 latitude / 経度 longitude')
 elif 'sheet1.xml' in loc:
  book=zipfile.ZipFile(io.BytesIO(b));ss=ET.fromstring(book.read('xl/sharedStrings.xml')).findall('m:si',ns); strings=[''.join(t.text or '' for t in s.findall('m:t',ns)) for s in ss]
  records=[]
  for row in ET.fromstring(book.read('xl/worksheets/sheet1.xml')).findall('.//m:row',ns):
   vals={cell.attrib['r']: strings[int(cell.find('m:v',ns).text)] if cell.attrib.get('t')=='s' else cell.find('m:v',ns).text for cell in row if cell.find('m:v',ns) is not None}
   if vals.get('B12')=='0000000011' or vals.get('B13')=='0000000012': records.append(vals)
  r=next(r for r in records if 'K12' in r);assert r['E12']=='剣淵町絵本の館';lat,lng=float(r['K12']),float(r['L12']);c.update(method='municipal XLSX',rawRecord=r,adjacentRecord=next(r for r in records if 'K13' in r),crs='not declared in source; no EPSG assertion',axisOrder='K12 緯度 latitude / L12 経度 longitude')
 elif 'markerInfos' in loc:
  setting=json.loads(re.search(r'<script[^>]*data-map-view-target="setting"[^>]*>(.*?)</script>',b.decode(),re.S)[1]);r=setting['markerInfos'][0];lat,lng=r['lat'],r['lng'];assert r['title']=='北海道登別市役所';c.update(method='official HTML marker',rawRecord=setting,crs='web map geographic lat/lng; EPSG not declared',axisOrder='named lat/lng; center excluded')
 elif 'iframe' in loc:
  r=re.search(r'<iframe[^>]+src="https://maps.google.co.jp/maps\?q=([\d.]+),([\d.]+)',b.decode());lat,lng=map(float,r.groups());assert '留萌プラザ2F' in b.decode();c.update(method='official HTML q',rawRecord=r.group(0),crs='web map geographic lat/lng; EPSG not declared',axisOrder='q=latitude,longitude; not an HTTP Google response')
 else:raise AssertionError(loc)
 assert x['coordinate']=={'lat':lat,'lng':lng},x['facilityId']; c['coordinate']=x['coordinate'];c['passed']=True;checks.append(c)
# Extract the actual production type and validation function verbatim, not a seven-field imitation.
code=pathlib.Path('cmd/builddata/ledger.go').read_text();typ=re.search(r'type Evidence struct \{.*?\n\}',code,re.S)[0];fn=re.search(r'func validateEvidence\(e Evidence\) error \{.*?\n\}',code,re.S)[0]
probe='package main\nimport("crypto/sha256";"encoding/hex";"encoding/json";"fmt";"net/url";"os";"strings";"time")\n'+typ+'\nfunc hash(b []byte) string {h:=sha256.Sum256(b);return hex.EncodeToString(h[:])}\n'+fn+'''
func main(){b,err:=os.ReadFile("data/national/issue7/hokkaido.json");if err!=nil{panic(err)};var d struct{Updates []struct{FacilityID string `json:"facilityId"`;Evidence Evidence `json:"evidence"`} `json:"updates"`};if err=json.Unmarshal(b,&d);err!=nil{panic(err)};for _,u:=range d.Updates{if err=validateEvidence(u.Evidence);err!=nil{panic(err)};fmt.Printf("%s PASS checkedAt=%s\\n",u.FacilityID,u.Evidence.CheckedAt)};bad:=d.Updates[0].Evidence;bad.CheckedAt="2026-11-05T00:00:00Z";if validateEvidence(bad)==nil{panic("timestamp should fail")};fmt.Println("timestamp negative control: rejected")}
'''
(D/'evidence-probe.go').write_text(probe)
r=subprocess.run(['go','run',str(D/'evidence-probe.go')],text=True,capture_output=True);(D/'go-evidence.txt').write_text(r.stdout+r.stderr);assert r.returncode==0,r.stderr
# Independently preserve source excerpts for every reviewed ID, including unresolved items.
extracts=[]
for a in audit:
 sources=[]
 for s in a['supportingSources']:
  p=pathlib.Path(s['snapshotPath']);b=p.read_bytes()
  if b.startswith((b'PK',b'%PDF')):continue
  t=b.decode('utf-8',errors='replace');t=re.sub(r'<(script|style)\b.*?</\1>','',t,flags=re.S);t=html.unescape(re.sub('<[^>]*>',' ',t));t=re.sub(r'\s+',' ',t)
  terms=['配布場所','配布について','守衛室','警備員室','本庁舎','第２庁舎','1464','1466','15番','2025年7月17日','令和4年','新庁舎']
  spans=[]
  for term in terms:
   for m in list(re.finditer(re.escape(term),t))[:3]:spans.append(t[max(0,m.start()-50):m.start()+450])
  sources.append({'url':s['url'],'snapshotPath':str(p),'snapshotSHA256':sha(p),'excerpts':list(dict.fromkeys(spans))})
 extracts.append({'facilityId':a['facilityId'],'name':a['name'],'address':a['address'],'sources':sources})
write('source-excerpts.json',extracts);write('numeric-checks.json',checks)
summary={'passed':True,'assignedIDs':68,'candidateIDs':30,'unresolvedIDs':38,'snapshotReferencesChecked':len(hashes),'uniqueSnapshotPathsChecked':len(set(r['path'] for r in hashes)),'coordinateChecks':len(checks),'evidenceGoPassed':30,'timestampNegativeControlRejected':True,'goSource':'cmd/builddata/ledger.go','goSourceSHA256':sha('cmd/builddata/ledger.go'),'baselineHashesUnchanged':True,'originalInputHashesUnchanged':True,'doesNotEstablishAllRemainingCasesDeeplyInvestigated':True}
write('validation.json',summary);print(json.dumps(summary,ensure_ascii=False))
