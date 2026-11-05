import json,pathlib,hashlib,re,html,urllib.parse,zipfile,csv,io,sys
from decisions import C
from research import read
ROOT=pathlib.Path('data/evidence/national/kanto-south-locations-kanagawa')
M=json.loads((ROOT/'manifest.json').read_text());m={r['url']:r for r in M};assert len(m)==len(M)
ps=json.loads((ROOT/'targets.json').read_text());out=json.load(open('data/national/location-updates/kanto-south-kanagawa.json'))
ledger=json.load(open('data/overrides/regions/kanto-south.json'));places={p['id']:p for p in ledger['places']};ids={r['placeId'] for r in ledger['relations'] if r['cardId'].startswith('14')}
expected={p['id'] for p in ledger['places'] if p['id'] in ids and not p.get('coordinate')}
updates=out['updates'];unresolved=out['unresolved'];got=[r['facilityId'] for r in updates+unresolved]
assert len(got)==len(set(got));assert set(got)==expected=={p['id'] for p in ps}
for r in M:
 if r.get('snapshotPath'):assert hashlib.sha256(pathlib.Path(r['snapshotPath']).read_bytes()).hexdigest()==r['sha256'],r['url']
verified=[]
for i,c in C.items():
 u=next(u for u in updates if u['facilityId']==ps[i]['id']);e=u['evidence'];r=m[e['sourceUrl']]
 assert e['snapshotPath']==r['snapshotPath'] and e['snapshotSHA256']==r['sha256']
 assert e['actorType']=='ai' and u['coordinate']=={'lat':c['lat'],'lng':c['lng']}
 lat,lng=c['lat'],c['lng'];s=read(r);kind=''
 if '.zip' in r['url']:
  z=zipfile.ZipFile(r['snapshotPath']);features=json.loads(z.read('P05-22_14.geojson'))['features']
  names={2:'旭区市民活動支援センターみなくる',29:'市役所駅窓口センター',39:'大井町役場',40:'大井町役場',44:'清川村役場',45:'清川村役場'}
  matches=[f for f in features if f['properties']['P05_003']==names[i] and f['geometry']['coordinates']==[lng,lat]]
  assert len(matches)==1,(i,matches);kind='named GIS Point'
 elif '.csv' in r['url']:
  rows=list(csv.reader(io.StringIO(s)));matched=[row for row in rows if str(lat) in row and str(lng) in row]
  assert matched,(i,lat,lng)
  names={32:'綾瀬市役所',33:'葉山町役場',36:'南郷上ノ山公園',37:'中井町役場',38:'中井町役場',42:'愛川町子育て支援課',43:'愛川町子育て支援課'}
  assert any(names[i] in row for row in matched);kind='named CSV record'
 elif 'japan47go.travel' in r['url']:
  ds=[json.loads(j) for j in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',s,re.S)]
  matches=[d for d in ds if d.get('@type')=='LocalBusiness' and d.get('geo',{}).get('latitude')==lat and d.get('geo',{}).get('longitude')==lng]
  assert len(matches)==1;assert matches[0]['name']==ps[i]['name'],(i,matches[0]['name'],ps[i]['name']);kind='named LocalBusiness.geo'
 elif 'maps/embed' in r['url']:
  assert f'[{lat},{lng}]' in s
  assert r.get('linkedFrom') in m
  parent=read(m[r['linkedFrom']]);assert r['url'] in html.unescape(parent)
  names={1:'旭区役所',18:'ラスカ小田原',31:'座間市観光協会',35:'HAYAMA STATION',41:'山北町ふるさと交流センター'}
  assert names[i] in s;kind='official embedded named marker'
 elif 'maps.app.goo.gl' in r['url']:
  assert f'!3d{lat}!4d{lng}' in s and '道の駅 湘南ちがさき' in s;kind='official linked place feature (not @viewport)'
 else:
  urls=re.findall(r'(?:href|src)=[\"\']([^\"\']+)',s)
  qs=[urllib.parse.parse_qs(urllib.parse.urlparse(html.unescape(h)).query).get('q',[]) for h in urls]
  assert any(f'{lat},{lng}' in q or f'loc:{lat},{lng}' in q for q in qs),(i,qs);kind='official numeric destination q'
 verified.append({'facilityId':u['facilityId'],'coordinate':u['coordinate'],'sourceCheck':kind,'sha256':r['sha256']})
for row in unresolved:
 assert len(row['attempts'])>=2 and row['reason']
 for a in row['attempts']:
  assert a['url'] in m and a['result']
report={'schema':1,'targetFacilities':len(expected),'confirmedAdditions':len(updates),'unresolvedFacilities':len(unresolved),'manifestRecords':len(M),'hashedSnapshots':sum(bool(r.get('snapshotPath')) for r in M),'verified':verified,'result':'PASS'}
(ROOT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='verified'},ensure_ascii=False))
