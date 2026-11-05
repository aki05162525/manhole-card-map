"""Arithmetic on explicitly unapproved hypotheses; never emits adoption updates."""
import hashlib
import json
from pathlib import Path
import sys
import time
from shapely.geometry import shape, Point

ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'tools/national'))
from research_common import rounded_coordinate
E=Path(__file__).resolve().parent
W=ROOT/'data/work/issue57/pilot'
if (E/'calculations.json').exists():
 raise SystemExit('Recorded pilot exists; verify offline or use a new evidence directory.')
HYPOTHESES=[
 ('facility:kanto-south-5724e90e3e451f22eeef','shiroi',112,[1550,3970],'PDF新築棟に対応する西側部分の仮点。結合外形の棟境界は未承認。'),
 ('facility:kanto-south-caac2827c5303ba03047','shiroi',112,[2110,3760],'PDF減築改修棟に対応する東側部分の仮点。結合外形の棟境界は未承認。'),
 ('facility:chubu-west-2c746636b1d8b34ff7c1','atami',2614,[4744,4883],'模式図の第二庁舎候補。方位と周辺道路による対応は独立レビュー前。'),
 ('facility:chubu-west-b93c428182c323c9093b','atami',2624,[4980,5050],'第一庁舎+消防庁舎の一体外形候補の北西部分。第一庁舎単独領域は未承認。'),
]
rows=[]
for fid,group,index,point,note in HYPOTHESES:
 started=time.perf_counter()
 data=json.loads((W/f'{group}-combined.json').read_text());f=data['features'][index]
 geometry=f['geometry'];g=shape(geometry)
 assert g.is_valid and g.contains(Point(point))
 result=rounded_coordinate(geometry,data['baseTile'],point,data['extent'])
 assert result['mechanicalChecksPassed']
 # Independent library check of the rounded point after conversion back to XYZ.
 assert g.contains(Point(result['roundedTileXY']))
 rows.append({'facilityId':fid,'group':group,'combinedFeatureIndex':index,'sourceTile':f['sourceTile'],'sourceFeatureId':f['id'],'layerFeatureIndex':f['layerFeatureIndex'],'geometrySHA256':hashlib.sha256(json.dumps(geometry,sort_keys=True).encode()).hexdigest(),'pointInCombinedTileXY':point,'note':note,'geometryValid':True,'independentRoundedContains':'shapely==2.1.2 contains Point(roundedTileXY)',**result,'calculationSeconds':round(time.perf_counter()-started,6)})
(E/'calculations.json').write_text(json.dumps({'schema':1,'algorithm':'research_common.rounded_coordinate; independent Shapely inclusion','rows':rows,'notCalculated':[{'facilityId':'facility:chubu-west-ac91b1a9ed9a8365efe6','reason':'新棟と外形の対応未確定。適当な外形の代表点を作らない。'}]},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'hypothesesChecked':len(rows),'adopted':0}))
