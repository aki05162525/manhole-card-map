"""Independent offline review checks; writes only review-chugoku artifacts."""
import json, pathlib, re, hashlib, zipfile, io, html, base64, subprocess
R=pathlib.Path('data/evidence/issue7/review-chugoku')
def read(p): return json.loads(pathlib.Path(p).read_text())
def sha(p): return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def dump(n,o): (R/n).write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n')
d=read('data/national/issue7/chugoku.json'); proof=read('data/evidence/issue7/chugoku/coordinate-proof.json')
places={p['id']:p for p in read('data/work/issue7-baseline/ledger.json')['places']}
inputs=read('data/evidence/issue7/chugoku/input-hashes.json')
inputs.update({str(p):sha(p) for p in pathlib.Path('data/evidence/issue7/chugoku').iterdir() if p.is_file()})
inputs['data/national/issue7/chugoku.json']=sha('data/national/issue7/chugoku.json')
for p,h in inputs.items(): assert sha(p)==h,p
for p,h in read('data/work/issue7-baseline/hashes.json').items(): assert sha(pathlib.Path('data/work/issue7-baseline')/p)==h
refs={}
def ref(p,h):
 assert not pathlib.Path(p).is_absolute();assert sha(p)==h,p;refs[p]=h
for x in read('data/evidence/issue7/chugoku/fetches.json'):
 if x.get('snapshotPath'):ref(x['snapshotPath'],x['snapshotSHA256'])
for x in read('data/evidence/issue7/chugoku/reused-resources.json'):ref(x['path'],x['sha256'])
go=pathlib.Path('cmd/builddata/ledger.go').read_text();struct=re.search(r'type Evidence struct \{.*?\n\}',go,re.S)[0]
fields=set(re.findall(r'json:"([^"]+)"',struct)); assert len(fields)==7
for x in d['updates']+d['corrections']:
 e=x['evidence'];assert set(e)==fields;ref(e['snapshotPath'],e['snapshotSHA256'])
for x in d['corrections']:assert places[x['facilityId']][x['field']]==x['old']
allids=[x['facilityId'] for x in d['updates']+d['unresolved']]
assert len(allids)==len(set(allids))==57 and set(allids)==set(read('data/work/issue7-baseline/assignments.json')['chugoku'])
checks=[];snippets=[]
for u,p in zip(d['updates'],proof):
 e=u['evidence'];kind=p['extractor']; raw=pathlib.Path(e['snapshotPath']).read_bytes(); details={}
 if kind=='p05':
  inner,member,index=re.fullmatch(r'([^!]+)!([^#]+)#/features/(\d+)',e['sourceLocator']).groups()
  z=zipfile.ZipFile(io.BytesIO(raw));ib=z.read(inner);gb=zipfile.ZipFile(io.BytesIO(ib)).read(member);g=json.loads(gb);f=g['features'][int(index)];lng,lat=f['geometry']['coordinates']
  details={'feature':f,'crs':g['crs'],'innerZipSHA256':hashlib.sha256(ib).hexdigest(),'geojsonSHA256':hashlib.sha256(gb).hexdigest(),'axisOrder':'GeoJSON [longitude, latitude]; JGD2011 EPSG:6668; no numeric transformation'}
  assert '6668' in str(g['crs'])
 else:
  s=html.unescape(raw.decode());details={'crs':'Web map latitude/longitude; original does not explicitly declare an EPSG code. No claimed survey accuracy or transformation.'}
  if kind=='jsonld':
   objs=[json.loads(t) for t in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',s,re.S)]
   obj=next(o for o in objs if isinstance(o,dict) and 'geo' in o);lat,lng=float(obj['geo']['latitude']),float(obj['geo']['longitude']);details['jsonld']=obj
  elif kind=='q':
   matches=re.findall(r'[?&]q=([0-9.]+),\s*([0-9.]+)',s);assert len(set(matches))==1;lat,lng=map(float,matches[0]);details['rawPair']=matches[0];details['axisOrder']='q latitude,longitude; destination rather than ll viewport'
  elif kind=='latlng':
   m=re.search(r'new google.maps.LatLng\(([\d.]+),\s*([\d.]+)\)',s);lat,lng=map(float,m.groups());assert 'position: latlng' in s;details['markerCode']=s[max(0,m.start()-100):m.end()+1100];details['axisOrder']='LatLng(latitude,longitude) assigned to marker.position'
  elif kind=='business':
   m=re.search(r'"businessLocationCoordinates":(\{[^}]+\})',s);o=json.loads(m[1]);lat,lng=o['latitude'],o['longitude'];details['businessContext']=s[max(0,m.start()-800):m.end()+200];assert '米子市観光センター' in s and 'businessLocationFormatted' in s
  elif kind=='route-destination':
   matches=re.findall(r'!4m5!1s([^!]+)!2z([^!]+)!3m2!1d([\d.]+)!2d([\d.]+)',s)
   details['allRouteWaypoints']=matches
   matches=[m for m in matches if '円形劇場' in base64.urlsafe_b64decode(m[1]+'='*(-len(m[1])%4)).decode()]
   assert len(matches)==4;assert len({m[2:] for m in matches})==1
   details['routes']=[{'placeId':m[0],'label':base64.urlsafe_b64decode(m[1]+'='*(-len(m[1])%4)).decode(),'latRaw':m[2],'lngRaw':m[3]} for m in matches]
   assert all('円形劇場' in r['label'] for r in details['routes']);lat,lng=map(float,matches[0][2:]);details['viewports']=re.findall(r'!1m3!1d([^!]+)!2d([^!]+)!3d([^!]+)',s);details['axisOrder']='route destination !3m2 !1d latitude !2d longitude; distinct from viewport !1m3'
 assert u['coordinate']=={'lat':lat,'lng':lng},u
 checks.append({'facilityId':u['facilityId'],'name':p['name'],'coordinate':u['coordinate'],'matchesOriginal':True,'evidenceSevenFields':True,'snapshotSHA256':e['snapshotSHA256'],'details':details})
 for src in p['supportingSources']:
  path=src['snapshotPath'];ref(path,src['snapshotSHA256'])
  if path.endswith('.html'):
   b=pathlib.Path(path).read_bytes()
   try: t=b.decode('utf-8')
   except UnicodeDecodeError:t=b.decode('cp932')
   t=re.sub(r'<(script|style)\b.*?</\1>','',t,flags=re.S);t=' '.join(html.unescape(re.sub('<[^>]+>',' ',t)).split())
   terms=['2639','児島産業振興センター','1-37','140','体育館','475','7701','522-0151','472-1289','526-8446','1520','造成工事','令和１０年秋','472','471','観光センター','円形校舎','2971']
   excerpts=[]
   for term in terms:
    for m in list(re.finditer(re.escape(term),t))[:2]:excerpts.append(t[max(0,m.start()-80):m.end()+160])
   snippets.append({'facilityId':u['facilityId'],'snapshotPath':path,'snapshotSHA256':src['snapshotSHA256'],'excerpts':excerpts})
# Use the actual current Go struct and validation function, without editing package source.
func=re.search(r'func validateEvidence\(e Evidence\) error \{.*?\n\}',go,re.S)[0]
probe='package main\nimport("crypto/sha256";"encoding/json";"fmt";"net/url";"os";"strings";"time")\n'+struct+'\nfunc hash(b []byte) string {return fmt.Sprintf("%x",sha256.Sum256(b))}\n'+func+'''\nfunc main(){b,err:=os.ReadFile("data/evidence/issue7/review-chugoku/evidence-input.json");if err!=nil{panic(err)};var entries []json.RawMessage;if err=json.Unmarshal(b,&entries);err!=nil{panic(err)};for i,b:=range entries{var e Evidence;dec:=json.NewDecoder(strings.NewReader(string(b)));dec.DisallowUnknownFields();if err=dec.Decode(&e);err!=nil{panic(err)};if err=validateEvidence(e);err!=nil{panic(err)};fmt.Printf("evidence %d: valid\\n",i+1)}}\n'''
(R/'evidence-probe.go').write_text(probe);dump('evidence-input.json',[x['evidence'] for x in d['updates']+d['corrections']])
dump('numeric-checks.json',checks);dump('identity-excerpts.json',snippets);dump('verified-snapshot-hashes.json',refs);dump('protected-input-hashes.json',inputs)
dump('validation.json',{'coordinateCandidates':len(checks),'exactCorrections':len(d['corrections']),'assigned':len(allids),'inheritedDeferred':len(d['unresolved']),'snapshotFilesVerified':len(refs),'allOriginalNumbersMatch':True,'evidenceSevenFields':True,'exactOldMatchesFixedLedger':True,'fixedInputsUnchanged':True,'networkFetchPerformed':False,'note':'No new fetchedAt claimed; retained input fetch metadata is provenance, not independent refetch.'})
print('10 original coordinate checks, 5 exact corrections, hashes and fields passed')
