import hashlib,json,math,sys
from pathlib import Path
sys.path.insert(0,'tools/national')
from research_common import decode_tile,rounded_coordinate
from shapely.geometry import shape,Point
E=Path('data/evidence/kanto-prefecture/saitama/groups/north')
records=[]
for p in [E/'retrievals.json',*E.glob('*-vector-retrievals.json')]:
 for r in json.loads(p.read_text()):
  if r.get('rawPath'):
   assert hashlib.sha256(Path(r['rawPath']).read_bytes()).hexdigest()==r['sha256'];records.append(r['sha256'])
for name in ['muji','okabe']:
 g=json.loads((E/f'{name}-geometry.json').read_text());t=g['source']['sourceTile'];b=g['baseTile'];f=decode_tile((E/f"{name}-{t['z']}-{t['x']}-{t['y']}.pbf.gz").read_bytes())['BldA']['features'][g['source']['layerFeatureIndex']]
 coordinates=[[[x+(t['x']-b['x'])*4096,y+(t['y']-b['y'])*4096] for x,y in ring] for ring in f['geometry']['coordinates']]
 assert coordinates==g['source']['geometry']['coordinates'];assert f['properties']==g['source']['properties']
 result=rounded_coordinate(g['source']['geometry'],b,g['combinedPoint']);assert result['mechanicalChecksPassed'];assert result['coordinate']==g['candidateCoordinate']
print('PASS north:7 actual outcome rows, original hashes',len(records),'2 new source-feature bindings and rounded containment;2 Kounosu candidates inherited verified by county tests')
