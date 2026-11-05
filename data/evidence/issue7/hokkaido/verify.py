"""Offline verification, writes only this task's validation.json."""
import json,pathlib,hashlib,zipfile,io,csv,re,xml.etree.ElementTree as E
ROOT=pathlib.Path(__file__).resolve().parents[4];D=ROOT/'data/evidence/issue7/hokkaido'
def read(p):return json.loads((ROOT/p).read_text())
def sha(p):return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
result=read('data/national/issue7/hokkaido.json');ids=read('data/work/issue7-baseline/assignments.json')['hokkaido'];updates=result['updates'];unresolved=result['unresolved'];rows=updates+unresolved
assert len(ids)==len(set(ids))==68
assignments=read('data/work/issue7-baseline/assignments.json')
assert not set(ids).intersection(x for region,group in assignments.items() if region!='hokkaido' for x in group)
policy=read('data/evidence/issue7/hokkaido/policy.json');assert sha(policy['P05']['specificationPath'])==policy['P05']['specificationSHA256']
assert len(rows)==len({x['facilityId'] for x in rows})==68
assert set(ids)=={x['facilityId'] for x in rows}
for p,h in read('data/evidence/issue7/hokkaido/input-hashes.json').items():assert sha(p)==h,p
for p,h in read('data/work/issue7-baseline/hashes.json').items():assert sha('data/work/issue7-baseline/'+p)==h,p
records=read('data/evidence/issue7/hokkaido/fetch-records.json');reused=read('data/evidence/issue7/hokkaido/reused-originals.json');count=0
for r in records+reused:
 if r.get('snapshotPath'):
  assert sha(r['snapshotPath'])==r['snapshotSHA256'],r['snapshotPath'];count+=1
for r in records:assert r['fetchedAt'] and 'Cookie' not in r
z=zipfile.ZipFile(ROOT/'data/evidence/issue5/chubu/P05-22_GML.zip');zz=zipfile.ZipFile(io.BytesIO(z.read('P05-22_01_GML.zip')));raw=zz.read('P05-22_01.geojson');geo=json.loads(raw)
p05=read('data/evidence/issue7/hokkaido/p05-extraction.json');assert p05['memberSHA256']==hashlib.sha256(raw).hexdigest();assert geo['crs']['properties']['name']=='urn:ogc:def:crs:EPSG::6668'
for r in p05['records']:assert r['feature']==geo['features'][r['featureIndex']]
fields={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
counts={};ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
for u in updates:
 e=u['evidence'];assert set(e)==fields;assert u['scope']=='building';assert e['actorType']=='ai';assert sha(e['snapshotPath'])==e['snapshotSHA256'];co=u['coordinate'];assert 41<co['lat']<46 and 139<co['lng']<146
 loc=e['sourceLocator'];b=(ROOT/e['snapshotPath']).read_bytes()
 if '#/features/' in loc:
  i=int(loc.rsplit('/',1)[1]);lng,lat=geo['features'][i]['geometry']['coordinates'];method='P05'
 elif 'markerInfos' in loc:
  s=b.decode();marker=json.loads(re.search(r'<script[^>]*data-map-view-target="setting"[^>]*>(.*?)</script>',s,re.S)[1])['markerInfos'][0];lat=marker['lat'];lng=marker['lng'];assert marker['title']=='北海道登別市役所';method='official-marker'
 elif 'iframe' in loc:
  s=b.decode();lat,lng=map(float,re.search(r'<iframe[^>]+src="https://maps.google.co.jp/maps\?q=([\d.]+),([\d.]+)',s).groups());assert '留萌プラザ2F' in s;method='official-marker'
 elif 'CSV' in loc:
  row=next(r for r in csv.DictReader(b.decode('utf-8-sig').splitlines()) if r['ID']=='PF0000000001');lat=float(row['緯度']);lng=float(row['経度']);assert row['名称']=='富良野市複合庁舎';method='municipal-public-facility'
 elif 'sheet1.xml' in loc:
  book=zipfile.ZipFile(io.BytesIO(b));sheet=E.fromstring(book.read('xl/worksheets/sheet1.xml'));values={c.attrib['r']:c.find('m:v',ns).text for c in sheet.findall('.//m:c',ns) if c.find('m:v',ns) is not None};lat=float(values['K12']);lng=float(values['L12']);ss=E.fromstring(book.read('xl/sharedStrings.xml')).findall('m:si',ns);name=''.join(t.text or '' for t in ss[int(values['E12'])].findall('m:t',ns));assert name=='剣淵町絵本の館',name;method='municipal-public-facility'
 else:raise AssertionError(loc)
 assert co=={'lat':lat,'lng':lng},u['facilityId'];counts[method]=counts.get(method,0)+1
for u in unresolved:
 assert all(u.get(k) for k in ['reasonCategory','reason','nextSource','investigationStatus','attempts'])
 assert u['investigationStatus']=='new-investigation'
 assert any(a['kind']=='new-fetch-and-inspection' for a in u['attempts'])
audit=read('data/evidence/issue7/hokkaido/candidate-audit.json');assert {x['facilityId'] for x in audit}==set(ids)
assert all(x['priorReason'] and x['priorReasonCategory'] for x in audit)
assert result['corrections']==[]
summary={'passed':True,'assigned':len(ids),'updates':len(updates),'unresolved':len(unresolved),'duplicateIds':0,'newFetchURLs':len(records),'http200':sum(r.get('status')==200 for r in records),'failedFetches':[{'url':r['url'],'status':r.get('status'),'error':r.get('error')} for r in records if r.get('status')!=200],'checkedSnapshotReferences':count,'coordinateChecks':counts,'evidenceExactSevenFields':True,'baselineHashesUnchanged':True,'protectedInputHashesUnchanged':True,'corrections':0,'newInvestigationIDs':68,'oldReadOnlyIDs':0,'uninvestigatedIDs':0,'limitations':['数値原典・hash・ID被覆の検証は建物同定の独立レビューを代替しない。','富良野/絵本の館の自治体公開施設一覧には特定EPSG明記なし。一般緯度経度を原値で提案。','現配布状態・関係・住所は変更しない。天塩の枝番相違は未訂正。']}
(D/'validation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,ensure_ascii=False,indent=2))
