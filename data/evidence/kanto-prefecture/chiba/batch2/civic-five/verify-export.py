from pathlib import Path
import json,hashlib,sys,subprocess,datetime
from shapely.geometry import shape,Point
sys.path.insert(0,'tools/national')
from research_common import rounded_coordinate
E=Path(__file__).resolve().parent;sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();n=0
for row in json.loads((E/'input-registry.json').read_text()):assert sha(E/row['path'])==row['sha256'];n+=1
scope=json.loads((E/'scope-inheritance.json').read_text());assert sha(Path(scope['source']))==scope['sha256'];assert len(scope['rows'])==5
for group in ['plant','yachimata','kashiwa']:
 c=json.loads((E/f'{group}-calculation.json').read_text());combined=json.loads((E/f'{group}-combined.json').read_text());f=next(f for f in combined['features'] if f['id']==c['feature']['id']);assert c['feature']==f
 assert next(r for r in scope['rows'] if r['facilityId']==c['facilityId'])['currentPlace']['id']==c['facilityId']
 g=shape(f['geometry']);centroid=g.centroid;assert [centroid.x,centroid.y]==c['centroidXY']
 result=rounded_coordinate(f['geometry'],combined['baseTile'],[centroid.x,centroid.y]);assert result==c['result'];assert g.contains(Point(result['roundedTileXY']));assert not c['adoptionApproval']
 for row in json.loads((E/f'{group}-tile-inputs.json').read_text())['tiles']:assert sha(Path(row['path']))==row['sha256']
 n+=1
r=json.loads((E/'cityhall-rejected-footprints.json').read_text());assert sha(Path(r['source']))==r['sourceSHA256'];assert r['currentCandidate'] is None
out={'executedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'gitCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'command':'mise exec -- uv run --with shapely python data/evidence/kanto-prefecture/chiba/batch2/civic-five/verify-export.py','exitCode':0,'integrityFilesAndCandidateChecks':n,'scope':'5 IDs; 3 rounded candidate calculations, 2 cityhall held. Original evidence reading is separate.','fullSuite':'not run by child; parent integrates','adoptionApproval':False}
(E/'export-verification.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps(out,ensure_ascii=False))
