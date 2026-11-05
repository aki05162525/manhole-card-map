from pathlib import Path
import json,math,sys
from shapely.geometry import shape,Point
sys.path.insert(0,'tools/national');from research_common import rounded_coordinate
W=Path(__file__).resolve().parent;group,fid,featureid=sys.argv[1:4];c=json.loads((W/f'{group}-combined.json').read_text());f=next(f for f in c['features'] if f['id']==featureid);g=shape(f['geometry']);p=g.centroid
r=rounded_coordinate(f['geometry'],c['baseTile'],[p.x,p.y]);scale=math.cos(math.radians(r['coordinate']['lat']))*2*math.pi*6378137/65536/4096
out={'facilityId':fid,'feature':f,'frame':c['baseTile'],'extent':4096,'centroidXY':[p.x,p.y],'areaM2Approx':g.area*scale**2,'areaMeaning':'latitude-scaled Mercator footprint area approximation, not surveyed area','validPolygon':g.is_valid,'result':r,'independentShapelyRoundedWithin':g.contains(Point(r['roundedTileXY'])),'adoptionApproval':False};(W/f'{group}-calculation.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps(out,ensure_ascii=False))
