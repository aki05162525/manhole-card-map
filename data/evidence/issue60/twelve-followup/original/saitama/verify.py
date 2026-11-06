import json,sys,hashlib,pathlib,math
from shapely.geometry import shape,Point
from shapely.ops import unary_union
from shapely.affinity import translate
sys.dont_write_bytecode=True
sys.path.insert(0,str(pathlib.Path.cwd()/'tools/national'))
from research_common import decode_tile
O=pathlib.Path('/tmp/issue60-recheck-saitama-nov6');users=json.load(open(O/'user-report.json'));cs=json.load(open(O/'candidates.json'));gs=json.load(open(O/'candidate-geometries.json'));receipt=json.load(open('data/evidence/issue60/human-answers-20261106/receipt.json'))
assert [u['number'] for u in users]==[22,23,24,25,27,29,30,32,35,36]
assert len({u['facilityId'] for u in users})==10
remaining=pathlib.Path('data/national/issue76/remaining-index-after-human-answers.json').read_text()
for u in users:
 assert u['facilityId']==next(r['facilityId'] for r in receipt['answers'] if r['number']==u['number'])
 assert u['facilityId'] in remaining
assert [c['number'] for c in cs]==[22,23,24,25,29,32]
checks=[];cache={}
for c,g in zip(cs,gs):
 assert c['number']==g['number'];t=g['baseTile']
 for f,ref in zip(g['features'],g['rawTiles']):
  p=pathlib.Path(ref['path']);b=p.read_bytes();assert hashlib.sha256(b).hexdigest()==ref['sha256']
  if str(p) not in cache:cache[str(p)]=decode_tile(b)
  # Verify only selected features, no repeat of the original whole-area research.
  layer=cache[str(p)][f['layer']];raw=layer['features'][f['layerFeatureIndex']]
  a=translate(shape(raw['geometry']),(f['sourceTile']['x']-t['x'])*4096,(f['sourceTile']['y']-t['y'])*4096)
  assert a.equals(shape(f['geometry'])),(c['number'],f['layerFeatureIndex'])
 lat,lng=c['coordinate'].values();q=Point(((lng+180)/360*2**t['z']-t['x'])*4096,((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**t['z']-t['y'])*4096)
 union=unary_union([shape(f['geometry']) for f in g['features']]);assert union.contains(q)
 assert c['coordinate']!=next(u['reportedCoordinate'] for u in users if u['number']==c['number'])
 checks.append(dict(number=c['number'],rawFeatureMatches=True,roundedInside=True))
result=dict(scope='10番号ID/現残件照合、6候補の原タイル選択feature照合・丸め後内包。建物同定の独立承認ではない',checks=checks,rawTilesDecoded=len(cache),fullSuiteRun=False,repoChanges=False)
(O/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False))
