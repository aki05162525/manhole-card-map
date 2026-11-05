import json,pathlib,hashlib,re,html,urllib.parse,csv,io
S=pathlib.Path('data/evidence/national/locations-north-hokkaido');R=pathlib.Path('data/evidence/national/review-north-hokkaido')
load=lambda p:json.loads(pathlib.Path(p).read_text())
out=load('data/national/location-updates/north-hokkaido.json');targets=load(S/'targets.json');man=load(S/'manifest.json');pr=load(S/'provenance.json');byurl={e['url']:e for e in man};byid={e['facilityId']:e for e in pr}
hashes=[]
for e in man:
 if not e.get('snapshotPath'):continue
 p=pathlib.Path(e['snapshotPath']);h=hashlib.sha256(p.read_bytes()).hexdigest();assert h==e['snapshotSHA256']
 if e.get('reusedFrom'):assert p.read_bytes()==pathlib.Path(e['reusedFrom']).read_bytes()
 hashes.append({'path':str(p),'sha256':h,'url':e['url']})
for t in targets:
 e=t['evidence'];assert hashlib.sha256(pathlib.Path(e['snapshotPath']).read_bytes()).hexdigest()==e['snapshotSHA256']
checks=[]
for u in out['updates']:
 e=u['evidence'];m=byurl[e['sourceUrl']];assert all(m[k]==e[k] for k in ['snapshotPath','snapshotSHA256'])
 raw=pathlib.Path(e['snapshotPath']).read_bytes();txt=urllib.parse.unquote(raw.decode('utf-8','replace'));a=u['coordinate']['lat'];b=u['coordinate']['lng'];nums=list(re.finditer(r'(?<![\d.])\d{2,3}\.\d+',txt));aa=[n.start() for n in nums if abs(float(n[0])-a)<1e-10];bb=[n.start() for n in nums if abs(float(n[0])-b)<1e-10];assert any(abs(x-y)<1500 for x in aa for y in bb)
 links=[]
 for src in byid[u['facilityId']]['officialLinkSources']:
  rawp=pathlib.Path(src['snapshotPath']);assert hashlib.sha256(rawp.read_bytes()).hexdigest()==src['snapshotSHA256'];assert e['sourceUrl'] in html.unescape(rawp.read_text());links.append(src)
 item={'facilityId':u['facilityId'],'sourceHashVerified':True,'coordinatePairInSameFragment':True,'officialLinkSources':links,'sourceLocator':e['sourceLocator']}
 if '.csv' in e['sourceUrl']:
  for enc in ['utf-8-sig','cp932']:
   try:rows=list(csv.DictReader(io.StringIO(raw.decode(enc))));break
   except UnicodeDecodeError:pass
  matches=[]
  for row in rows:
   try:
    if abs(float(row['緯度'])-a)<1e-10 and abs(float(row['経度'])-b)<1e-10:matches.append(row)
   except (ValueError,KeyError):pass
  assert matches;item['rawCsvRows']=matches
 checks.append(item)
ids=[u['facilityId'] for u in out['updates']+out['unresolved']];assert len(ids)==len(set(ids))==91;assert set(ids)=={t['id'] for t in targets}
inputpaths=[pathlib.Path('data/national/location-updates/north-hokkaido.json')]+list(S.rglob('*'))
inputhash={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in inputpaths if p.is_file()}
result={'updates':72,'unresolved':19,'manifestEntries':len(man),'snapshotsChecked':len(hashes),'targetEvidenceHashesChecked':len(targets),'mapProvenanceChainsChecked':sum(bool(c['officialLinkSources']) for c in checks),'inputSHA256':inputhash,'checks':checks,'scope':'hash/URL/numeric/CSV structural checks only; semantic judgments in review JSON'}
(R/'audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print({k:v for k,v in result.items() if k not in ['checks','inputSHA256']})
