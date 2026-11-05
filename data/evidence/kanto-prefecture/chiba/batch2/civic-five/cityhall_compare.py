from pathlib import Path
import hashlib,json,math
from shapely.geometry import shape
W=Path(__file__).resolve().parent;P=W.parent
src=W/'cityhall-reused-combined.json';c=json.loads(src.read_text());ids=['58245-25862-BldA-104','58245-25862-BldA-105','58245-25862-BldA-111','58246-25862-BldA-3','58245-25862-BldA-113','58246-25863-BldA-15','58245-25862-BldA-114','58245-25863-BldA-255']
# Record all actual matches without guessing a missing tile suffix.
features=[f for f in c['features'] if f['sourceLayer']=='BldA' and f['layerFeatureIndex'] in [104,105,111,3,113,15,114,255] and 2500<shape(f['geometry']).centroid.x<4500 and 2500<shape(f['geometry']).centroid.y<5000]
scale=math.cos(math.radians(35.43))*2*math.pi*6378137/65536/4096
r={'source':str(src),'sourceSHA256':hashlib.sha256(src.read_bytes()).hexdigest(),'baseTile':c['baseTile'],'features':[dict(f,areaM2Approx=shape(f['geometry']).area*scale**2) for f in features],'warning':'Clipped/buffered pieces are separate. Do not sum their areas: duplicate tile buffer not dissolved. Areas are approximate and belong to obsolete footprints, never candidate current South Hall.','currentCandidate':None}
(W/'cityhall-rejected-footprints.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print([(f['id'],f['tileBoundaryTouched']) for f in features])
