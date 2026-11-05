"""Read-only input checks, report written only to issue7/koshin/validation.json."""
import json,hashlib,zipfile,io,re,datetime
from pathlib import Path
R=Path('data/evidence/issue7/koshin');B=Path('data/work/issue7-baseline')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
d=read('data/national/issue7/koshin.json');ids=read(B/'assignments.json')['koshin'];allids=[r['facilityId'] for r in d['updates']+d['unresolved']];assert len(set(allids))==len(allids)==len(ids)==43;assert set(allids)==set(ids)
for f,h in read(B/'hashes.json').items():assert sha(B/f)==h
for p,h in read(R/'input-hashes.json').items():assert sha(p)==h
rows=sum([read(p) for p in R.glob('fetch-*.json')],[]);assert len({r['sourceUrl'] for r in rows})==len(rows)
for r in rows:
 assert r['fetchedAt'];datetime.datetime.fromisoformat(r['fetchedAt'])
 if r.get('snapshotPath'):assert sha(r['snapshotPath'])==r['snapshotSHA256']
fields=set(re.findall(r'json:"([^"]+)"',Path('cmd/builddata/ledger.go').read_text().split('type Evidence struct {')[1].split('}')[0]));assert len(fields)==7
updates={x['facilityId']:x for x in d['updates']}
for u in d['updates']:
 assert set(u['evidence'])==fields;assert u['scope']=='building';assert sha(u['evidence']['snapshotPath'])==u['evidence']['snapshotSHA256'];assert 34<u['coordinate']['lat']<38 and 137<u['coordinate']['lng']<140
z=zipfile.ZipFile('data/evidence/issue5/chubu/P05-22_GML.zip');numeric=[]
for r in read(R/'p05-records.json'):
 s=zipfile.ZipFile(io.BytesIO(z.read(r['archive'])));raw=s.read(r['member']);assert hashlib.sha256(raw).hexdigest()==r['memberSHA256'];j=json.loads(raw);f=j['features'][r['featureIndex']];assert f==r['feature'];u=updates[r['facilityId']];assert f['geometry']['coordinates']==[u['coordinate']['lng'],u['coordinate']['lat']];assert '6668' in str(j['crs']);gml=s.read(r['member'].replace('.geojson','.xml')).decode();m=re.search(r'<gml:Point gml:id="pt'+str(r['featureIndex'])+r'">\s*<gml:pos>([^<]+)',gml);assert m;lat,lng=map(float,m[1].split());assert abs(lat-u['coordinate']['lat'])<1e-7 and abs(lng-u['coordinate']['lng'])<1e-7;numeric.append({'facilityId':r['facilityId'],'geojsonExact':True,'gmlLatLng':m[1]})
byurl={r['sourceUrl']:r for r in rows};page=byurl['https://www.city.ueda.nagano.jp/map/13805.html'];t=Path(page['snapshotPath']).read_text();js=Path(byurl['https://www.city.ueda.nagano.jp/ssi/js/shisetsu-detail-googlemap.js']['snapshotPath']).read_text();assert 'position : myLatlng' in js and 'new google.maps.LatLng(initlat, initlong)' in js
u=updates[ids[5]];assert u['coordinate']=={'lat':float(re.search("initlat = '([^']+)'",t)[1]),'lng':float(re.search("initlong = '([^']+)'",t)[1])}
for c in d['corrections']:
 x=read(c['targetFile'])
 for key in c['jsonPointer'].strip('/').split('/'):x=x[int(key)] if isinstance(x,list) else x[key]
 assert x==c['old'] and c['new']!=c['old']
for c in read(R/'classification.json'):
 assert c['attempts'] and any(a['kind']=='fresh-http' for a in c['attempts']);e=c['priorEvidence'];assert sha(e['snapshotPath'])==e['snapshotSHA256']
result={'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'targetCount':len(ids),'candidates':len(d['updates']),'unresolved':len(d['unresolved']),'freshHttpAttempts':len(rows),'http200':sum(r['status']==200 for r in rows),'failedRequests':[r['sourceUrl'] for r in rows if r['status']!=200],'allIdsUniqueAndClassified':True,'fixedInputsUnchanged':True,'referencedHashesVerified':True,'evidenceExactlyGoSevenFields':True,'exactCorrectionsVerified':True,'p05NumericChecks':numeric,'uedaOfficialMarkerNumericAndJavascriptCheck':True,'limits':'建物同定は保存原典を読んだAI判断。数値・hash検証は建物外周測量や全市のGIS探索完了を意味しない。'}
(R/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print({k:v for k,v in result.items() if k!='p05NumericChecks'})
# Fresh source text invariants supplement (not replace) the identity decisions.
import html
checks={
'https://www.town.fujikawaguchiko.lg.jp/ka/info.php?if_id=6910&ka_id=15':['生涯学習館','1754'],
'https://www.city.tsuru.yamanashi.jp/soshiki/somu/houseikouhou_t/1/1776.html':['配置課','上下水道課','上谷一丁目1番1号'],
'https://www.town.obuse.nagano.jp/docs/244999.html':['1491-2','宿日直室'],
'https://www.town.nagano-takamori.lg.jp/docs/12584.html':['2183-1','環境水道課','日直室'],
'https://www.city.komoro.lg.jp/official/kurashi_tetsuzuki/jogesuido/gesuido/12271.html':['市庁舎2階','市庁舎1階'],
'https://www.city.okaya.lg.jp/soshikikarasagasu/suidoka/483/15244.html':['幸町8-1','市役所庁舎4階'],
'https://www.city.tomi.nagano.jp/category/soshikiitiran/101437.html':['本庁舎西側','勤労者会館１階'],
'https://www.city.chikuma.lg.jp/soshiki/jogesuido/kanko/1/2041.html':['上山田文化会館','三丁目1番地1'],
'https://db.go-nagano.net/topics_detail6/id%3D3402':['総合観光会館','2-12-10']}
for url,terms in checks.items():
 raw=Path(byurl[url]['snapshotPath']).read_text(errors='replace');t=re.sub(r'\s+','',html.unescape(re.sub('<[^>]+>',' ',raw)))
 for term in terms:assert term in t,(url,term)
for r in read(R/'p05-competing-records.json'):
 pref=r['prefecture'];s=zipfile.ZipFile(io.BytesIO(z.read(f'P05-22_{pref}_GML.zip')));raw=s.read(f'P05-22_{pref}.geojson');assert hashlib.sha256(raw).hexdigest()==r['memberSHA256'];assert json.loads(raw)['features'][r['featureIndex']]==r['feature']
result['currentSourceTextChecks']=checks;result['competingP05RecordsVerified']=True
(R/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
