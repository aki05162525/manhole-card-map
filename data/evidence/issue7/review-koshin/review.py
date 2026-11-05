import json,hashlib,re,zipfile,io,datetime,html,subprocess
from pathlib import Path
from urllib.parse import urlparse
R=Path('data/evidence/issue7/review-koshin');S=Path('data/evidence/issue7/koshin');target=Path('data/national/issue7/koshin.json')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(n,v): (R/n).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
d=read(target);classes={c['facilityId']:c for c in read(S/'classification.json')}
# Independently read and verify every cited snapshot, without executing the producer's validator.
records=sum([read(p) for p in S.glob('fetch-*.json')],[])
hashes={str(target):sha(target),'cmd/builddata/ledger.go':sha('cmd/builddata/ledger.go')}
for p,h in read(S/'input-hashes.json').items():assert sha(p)==h;hashes[p]=h
for n,h in read('data/work/issue7-baseline/hashes.json').items():
 p='data/work/issue7-baseline/'+n;assert sha(p)==h;hashes[p]=h
for a in records:
 if a.get('snapshotPath'):assert sha(a['snapshotPath'])==a['snapshotSHA256'];hashes[a['snapshotPath']]=a['snapshotSHA256']
for c in classes.values():
 e=c['priorEvidence'];assert sha(e['snapshotPath'])==e['snapshotSHA256'];hashes[e['snapshotPath']]=e['snapshotSHA256']
code=Path('cmd/builddata/ledger.go').read_text();fields=re.findall(r'json:"([^"]+)"',code.split('type Evidence struct {')[1].split('}')[0]);assert len(fields)==7
z=zipfile.ZipFile('data/evidence/issue5/chubu/P05-22_GML.zip');p05={};numeric=[]
for pref in [19,20]:
 inner=zipfile.ZipFile(io.BytesIO(z.read(f'P05-22_{pref}_GML.zip')));raw=inner.read(f'P05-22_{pref}.geojson');j=json.loads(raw);assert '6668' in str(j['crs']);p05[pref]=(j,inner,hashlib.sha256(raw).hexdigest())
for i,u in enumerate(d['updates']):
 e=u['evidence'];assert set(e)==set(fields);assert sha(e['snapshotPath'])==e['snapshotSHA256'];hashes[e['snapshotPath']]=e['snapshotSHA256'];assert u['scope']=='building'
 assert urlparse(e['sourceUrl']).scheme in ['http','https'];assert urlparse(e['sourceUrl']).netloc and not urlparse(e['sourceUrl']).username
 assert e['actorType'] in ['ai','human'] and e['sourceLocator'].strip() and e['verificationMethod'].strip()
 if 'P05-22' in e['sourceLocator']:
  pref=int(re.search(r'P05-22_(\d+)_GML',e['sourceLocator'])[1]);idx=int(re.search(r'features\[(\d+)\]',e['sourceLocator'])[1]);j,inner,mhash=p05[pref];f=j['features'][idx]
  assert f['geometry']['coordinates']==[u['coordinate']['lng'],u['coordinate']['lat']]
  xml=inner.read(f'P05-22_{pref}.xml').decode();pos=re.search(r'<gml:Point gml:id="pt'+str(idx)+r'">\s*<gml:pos>([^<]+)',xml)[1];a,b=map(float,pos.split());assert abs(a-u['coordinate']['lat'])<1e-7 and abs(b-u['coordinate']['lng'])<1e-7
  numeric.append({'facilityId':u['facilityId'],'featureIndex':idx,'rawFeature':f,'crs':j['crs'],'geojsonAxisOrder':'longitude latitude','gmlAxisOrder':'latitude longitude','gmlRaw':pos,'memberSHA256':mhash,'exactGeoJSONMatch':True})
 else:
  t=Path(e['snapshotPath']).read_text();js=Path(S/'91ff513aa1997f3d8402.html').read_text();lat=re.search("initlat = '([^']+)'",t)[1];lng=re.search("initlong = '([^']+)'",t)[1]
  assert u['coordinate']=={'lat':float(lat),'lng':float(lng)};assert 'new google.maps.LatLng(initlat, initlong)' in js and 'position : myLatlng' in js
  numeric.append({'facilityId':u['facilityId'],'rawLat':lat,'rawLng':lng,'axisOrder':'initlat latitude; initlong longitude','crs':'Geographic degrees used by Google Maps LatLng (WGS84 API convention); no explicit EPSG declaration in municipality HTML; not P05/JGD2011','markerNotOnlyCenter':True,'javascriptPath':str(S/'91ff513aa1997f3d8402.html'),'exactMatch':True})
for r in read(S/'p05-competing-records.json'):assert p05[r['prefecture']][0]['features'][r['featureIndex']]==r['feature'];assert p05[r['prefecture']][2]==r['memberSHA256']
for c in d['corrections']:
 v=read(c['targetFile'])
 for k in c['jsonPointer'].strip('/').split('/'):v=v[int(k)] if isinstance(v,list) else v[k]
 assert v==c['old']
save('numeric-checks.json',numeric);save('input-integrity.json',hashes)
# Store a small relevant excerpt per primary source, not whole republished HTML.
excerpts=[];seen=set()
for u in d['updates']:
 for a in classes[u['facilityId']]['attempts']:
  p=a.get('snapshotPath','')
  if not p.endswith('.html') or p in seen:continue
  seen.add(p);t=Path(p).read_text();t=re.sub(r'<!--.*?-->|<(script|style)\b[^>]*>.*?</\1>','',t,flags=re.S);t=re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',t)))
  terms='配置課等|勤労者会館１階|市庁舎2階|市庁舎1階|船津1754|古見1555|1491-2|日直室|幸町8-1|下武石742|令和3年3月|杭瀬下一丁目64|三丁目1番地1|2-12-10|建物裏側|著作権について'
  hits=[t[max(0,m.start()-25):m.end()+100] for m in re.finditer(terms,t)]
  excerpts.append({'sourceUrl':a['sourceUrl'],'snapshotPath':p,'snapshotSHA256':sha(p),'excerpts':hits[:3]})
save('primary-excerpts.json',excerpts)
# Run exact production Evidence validator in an isolated standalone probe.
struct=code[code.index('type Evidence struct {'):code.index('type LedgerCoordinate struct {')]
func=code[code.index('func validateEvidence('):code.index('func validStatus(')]
probe='package main\nimport("crypto/sha256";"encoding/hex";"encoding/json";"fmt";"net/url";"os";"strings";"time")\n'+struct+'\nfunc hash(b []byte) string { h:=sha256.Sum256(b);return hex.EncodeToString(h[:]) }\n'+func+'''\nfunc main(){b,_:=os.ReadFile("data/national/issue7/koshin.json");var d struct{Updates []struct{FacilityID string `json:"facilityId"`;Evidence Evidence `json:"evidence"`} `json:"updates"`};if err:=json.Unmarshal(b,&d);err!=nil{panic(err)}; for _,u:=range d.Updates {original:=validateEvidence(u.Evidence);u.Evidence.CheckedAt="2026-11-05";corrected:=validateEvidence(u.Evidence);fmt.Printf("%s original=%v corrected=%v\\n",u.FacilityID,original,corrected);if original==nil || corrected!=nil {os.Exit(1)}}}\n'''
(R/'evidence-probe.go').write_text(probe)
print('independent numerical/hash checks passed; probe generated')
