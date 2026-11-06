import json,pathlib,hashlib,sys
from shapely.geometry import shape
from shapely.affinity import translate
sys.dont_write_bytecode=True;sys.path.insert(0,str(pathlib.Path.cwd()/'tools/national'))
from research_common import decode_tile
O=pathlib.Path('/tmp/issue60-recheck-third-other');cs=json.load(open(O/'candidates.json'));receipt=json.load(open('data/evidence/issue60/human-answers-20261106/receipt.json'));checks=[]
for c in cs:
 f=c['feature'];t=f['sourceTile'];base=c['baseTile'];prefix=pathlib.Path('data/evidence/kanto-prefecture/saitama/groups')
 p=prefix/('waterworks/nanbu/'+f"{t['z']}-{t['x']}-{t['y']}.pbf.gz" if c['number']==30 else 'tourism/'+f"yoshimi-{t['z']}-{t['x']}-{t['y']}.pbf.gz")
 b=p.read_bytes();raw=decode_tile(b)[f['layer']]['features'][f['layerFeatureIndex']];g=translate(shape(raw['geometry']),(t['x']-base['x'])*4096,(t['y']-base['y'])*4096)
 assert g.equals(shape(f['geometry']));assert c['roundedWithin'];assert not c['adoptionApproved'];assert c['facilityId']==next(r['facilityId'] for r in receipt['answers'] if r['number']==c['number'])
 checks.append(dict(number=c['number'],rawTile=str(p),sha256=hashlib.sha256(b).hexdigest(),rawFeatureMatched=True,roundedWithin=True))
r=dict(checks=checks,rawTilesDecoded=2,scope='Two selected candidate features only; no full re-decode or suite; no adoption approval')
(O/'verification.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(r)
