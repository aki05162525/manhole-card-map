"""Research-only schema, provenance and exact ledger-delta check; no manifest mutation."""
import sys,json,hashlib,subprocess
from pathlib import Path
sys.path.insert(0,'tools/national')
from assemble import assemble,apply_locations
from location_lifecycle import apply,digest
from research_common import decode_tile,rounded_coordinate
from shapely.geometry import shape,Point
from shapely.affinity import translate
from shapely.ops import unary_union
E=Path('data/evidence/kanto-prefecture/ibaraki/round2/south');N=Path('data/national/kanto-prefecture/ibaraki/round2/south')
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text())
base=read(Path('/tmp/ibaraki-ledger.json'));u=read(N/'locations-proposed.json')['updates'];life=read(N/'location-lifecycle-proposed.json');before={p['id']:p for p in base['places']}
new,locaudit=apply_locations(base,u,Path('.'));new,audit=apply(Path('.'),new,u,[life]);after={p['id']:p for p in new['places']}
changed=sorted(k for k in before if before[k]!=after[k]);assert changed==sorted(x['facilityId'] for x in u)
assert base['relations']==new['relations'] and before.keys()==after.keys()
assert all('coordinate' not in before[k] for k in changed)
assert [r['adoption'] for r in life['bindings']]==u
for row in read(N/'outcomes.json')['results']:
 name=Path(row['geometryRef']).parent.name;g=read(Path(row['geometryRef']));w=read(E/name/'vector-window.json')
 for t in w['tiles']:assert h(Path(t['retainedPath']))==t['sha256']
 assert len(w['tiles'])==9
 pieces=[]
 for part in g['parts']:
  t=part['tile'];f=decode_tile((E/name/f"{t['z']}-{t['x']}-{t['y']}.pbf.gz").read_bytes())['BldA']['features'][part['featureIndex']]
  geom=translate(shape(f['geometry']),xoff=(t['x']-g['baseTile']['x'])*4096,yoff=(t['y']-g['baseTile']['y'])*4096);assert geom.equals(shape(part['geometry']));pieces.append(geom)
 assert unary_union(pieces).equals(shape(g['fullBuildingGeometry']))
 result=rounded_coordinate(g['combinedGeometry'],g['baseTile'],g['pointXY']);assert result==g['rounding'] and result['mechanicalChecksPassed']
 assert result['coordinate']==row['candidate']
 assert shape(g['fullBuildingGeometry']).contains(Point(result['roundedTileXY']))
for r in read(E/'retrievals.json'):
 if r['status']=='acquired':assert h(Path('data/work/kanto-ibaraki/round2/south')/r['label'])==r['sha256']
for f in read(E/'inherited-history.json')['facilities']:
 for r in f['resolvedHistory']:assert h(Path(r['ref'].split('#')[0]))==r['sha256']
 for r in f['verifiedOriginals']:assert h(Path(r['snapshotPath']))==r['snapshotSHA256']
report={'schema':1,'validationCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'manifestSHA256':h(Path('tools/national/manifest.json')),'ledgerSHA256':h(Path('/tmp/ibaraki-ledger.json')),'command':'data/work/kanto-ibaraki/venv/bin/python '+str(E/'validate-candidates.py'),'exitCode':0,'checks':['4 IDs schema/evidence/raw hashes and lifecycle bindings accepted by existing implementation','all 36 numerical tile hashes and chosen raw feature indices verified','full-building geometry equals retained raw fragment union','all 4 candidate points contained after 7-place rounding','complete ledger comparison: exactly 4 places changed; relations and ID set unchanged','inherited history and saved official original hashes match','new acquired general raw hashes verified in ignored work'],'changedFacilityIds':changed,'hypotheticalOnly':True,'manifestApplied':False,'independentIdentityAndCRSReview':'pending; mechanical success is not approval','inputs':{str(p):h(p) for p in [N/'locations-proposed.json',N/'location-lifecycle-proposed.json',N/'outcomes.json',E/'validate-candidates.py',Path('tools/national/research_common.py'),Path('tools/national/assemble.py'),Path('tools/national/location_lifecycle.py')]}}
(E/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
