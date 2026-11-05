import sys,json,hashlib,subprocess,datetime
from pathlib import Path
sys.path.insert(0,'tools/national')
from research_common import decode_tile,rounded_coordinate
from shapely.geometry import shape
E=Path('data/evidence/kanto-prefecture/saitama/groups/civic');N=Path('data/national/kanto-prefecture/saitama/groups/civic');W=Path('data/work/kanto-prefecture/saitama/groups/civic')
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
assignment=read(N/'assignment.json')['facilities'];rows=read(N/'outcomes.json')['rows'];assert {r['facilityId'] for r in rows}=={r['facilityId'] for r in assignment};assert len(rows)==8
rs=read(E/'retrievals.json');count=0
for r in rs:
 if r.get('sha256'):
  assert sha(Path(r['rawPath']))==r['sha256'];count+=1
geoms=read(E/'geometry-comparisons.json');tilecount=0
for name,j in geoms.items():
 window=read(E/(name+'-vector-window.json'));assert len(window['rawTiles'])==9
 for raw in window['rawTiles']:
  p=Path(raw['path']);assert sha(p)==raw['sha256'];decode_tile(p.read_bytes());tilecount+=1
 for f in j['features']:
  tile=f['sourceTile'];p=E/f"{name}-{tile['z']}-{tile['x']}-{tile['y']}.pbf.gz";source=decode_tile(p.read_bytes())['BldA']['features'][f['layerFeatureIndex']];assert source['properties']==f['properties'];assert f['layer']=='BldA'
  from shapely.affinity import translate
  expected=translate(shape(source['geometry']),xoff=(tile['x']-j['baseTile']['x'])*4096,yoff=(tile['y']-j['baseTile']['y'])*4096)
  assert expected.equals_exact(shape(f['geometry']),0)
  m=f['mechanicalCoordinateForComparisonOnly'];assert m['mechanicalChecksPassed'];assert shape(f['geometry']).contains(__import__('shapely').geometry.Point(m['roundedTileXY']))
loc=read(N/'locations.json')['updates'];assert len(loc)==1 and loc[0]['facilityId']==assignment[2]['facilityId'];ev=loc[0]['evidence'];assert sha(Path(ev['snapshotPath']))==ev['snapshotSHA256'];assert ev['checkedAt']=='2026-11-05'
b=read(N/'old-bindings.json');assert sha(Path(b['inventoryRef']))==b['inventorySHA256'];inv=read(Path(b['inventoryRef']))['rows'];assert all(row==next(x for x in inv if x['facilityId']==row['facilityId']) for row in b['rows'])
selection=read(N/'selection.json');assert sha(Path(selection['locationsPath']))==selection['locationsSHA256'];assert not selection['manifestIntegrated'] and not selection['adoptionApproved']
inputs={str(p):sha(p) for p in [N/'assignment.json',N/'outcomes.json',N/'old-bindings.json',N/'locations.json',N/'selection.json',E/'retrievals.json',E/'geometry-comparisons.json',Path('tools/national/research_common.py')]}
result={'schema':1,'command':'/tmp/saitama-research-venv/bin/python data/evidence/kanto-prefecture/saitama/groups/civic/verify-local.py','headAtVerification':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'dirtyResearchInputs':True,'inputSHA256':inputs,'exitCode':0,'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'counts':{'facilities':8,'generalRetrievalHashes':count,'rawVectorTiles':tilecount,'candidateLocations':len(loc)},'checks':['assignment equals all outcomes','general source raw hashes','all 72 tile hashes/decode','selected comparison features bind exactly to original layer feature index and properties','every mechanical comparison point rounds inside its footprint','candidate snapshot hash and checkedAt','all old bindings equal inventory','selection hash matches location proposal'],'limits':['No independent source-reading approval','No product CRS/conditions approval','No manifest integration','No whole suite or commit; parent handles integration checks']}
(E/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result['counts']));print('PASS: hash, ID, binding, raw numeric geometry, rounded containment. Exit 0.')
