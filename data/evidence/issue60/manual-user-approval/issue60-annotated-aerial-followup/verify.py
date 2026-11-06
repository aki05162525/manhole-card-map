import json,pathlib,hashlib,sys,subprocess
from shapely.geometry import shape
from shapely.affinity import translate
R=pathlib.Path('/home/akihiro/personal/manhole-card-map');O=pathlib.Path('/tmp/issue60-annotated-aerial-followup')
sys.dont_write_bytecode=True;sys.path.insert(0,str(R/'tools/national'))
from research_common import decode_tile
c=json.loads((O/'candidate-11.json').read_text());p=R/'data/evidence/kanto-prefecture/kanagawa/peninsula/kinugasa-16-58192-25901.pbf.gz';b=p.read_bytes()
raw=decode_tile(b)['BldA']['features'][524];g=translate(shape(raw['geometry']),4096,4096);assert g.equals(shape(c['sourceGeometry']))
receipt=json.loads((R/'data/evidence/issue60/human-answers-20261106/receipt.json').read_text());assert next(r['facilityId'] for r in receipt['answers'] if r['number']==11)==c['facilityId']
v=json.loads((O/'verification.json').read_text());v.update(rawDecodeRun=True,rawTilesDecoded=1,selectedFeature524Matched=True,receiptIdMatched=True,rawTileSHA256=hashlib.sha256(b).hexdigest())
s=json.loads((O/'session.json').read_text());v['protectedFileUnchanged']=hashlib.sha256(pathlib.Path('/tmp/kanto-remaining-recheck.md').read_bytes()).hexdigest()==s['protectedFileSHA256'];assert v['protectedFileUnchanged']
v['repoStatusFinal']=subprocess.check_output(['git','status','--porcelain'],cwd=R,text=True)
(O/'verification.json').write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n');print(v)
