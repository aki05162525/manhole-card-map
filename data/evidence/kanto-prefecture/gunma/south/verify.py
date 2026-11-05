import json,hashlib,sys,datetime
from pathlib import Path
sys.path.insert(0,'tools/national')
from research_common import decode_tile,combine_tiles,rounded_coordinate
from shapely.geometry import shape
E=Path('data/evidence/kanto-prefecture/gunma/south');N=Path('data/national/kanto-prefecture/gunma/south');checks=[]
for row in json.loads((E/'retrievals.json').read_text()):
 r=row['retrieval'];assert hashlib.sha256(Path(r['rawPath']).read_bytes()).hexdigest()==r['sha256'];checks.append('raw hash '+row['label'])
for name in ['sewage','park','tamajuku','laran']:
 tiles=[]
 for s in json.loads((E/f'{name}-tiles.json').read_text())['sources']:
  b=Path(s['path']).read_bytes();assert hashlib.sha256(b).hexdigest()==s['sha256'];d=decode_tile(b);fs=[]
  for k in ['BldA','RdCL','RdEdg','WA','WL']:
   if k in d:fs.extend(dict(f,layer=k) for f in d[k]['features'] if f['geometry']['type'] in ['Polygon','MultiPolygon','LineString','MultiLineString'])
  tiles.append(dict(tile=s['tile'],extent=4096,features=fs))
 c=combine_tiles(tiles);assert len(tiles)==9
 if name!='park':
  d=json.loads((E/f'{name}-geometry.json').read_text());assert [c['features'][i] for i in d['combinedFeatureIndexes']]==d['sourceFragments'];g=shape(d['unionGeometry']);r=rounded_coordinate(d['unionGeometry'],d['baseTile'],list(g.centroid.coords)[0]);assert r==d['rounding'];assert r['roundedWithin'] and r['unroundedWithin'];assert not any(f['outerBoundaryTouched'] for f in d['sourceFragments'])
 checks.append(name+' 9 raw tiles + decode + geometry + rounded containment')
for u in json.loads((N/'locations-proposed.json').read_text())['updates']:
 e=u['evidence'];assert hashlib.sha256(Path(e['snapshotPath']).read_bytes()).hexdigest()==e['snapshotSHA256'];assert u['coordinate']==json.loads(Path(e['snapshotPath']).read_text())['rounding']['coordinate']
print(json.dumps({'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'result':'PASS','checks':checks,'scope':'原本hash/数値再デコード/候補geometry/丸め内包のみ。棟同定の独立承認や全suiteではない。'},ensure_ascii=False,indent=2))
