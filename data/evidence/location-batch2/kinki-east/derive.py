"""Reproduce selected numerical building comparisons, never perform adoption.
Requires mapbox-vector-tile 2.2.0, shapely 2.2.0, pyproj 3.7.2.
"""
import gzip
import hashlib
import json
import math
from pathlib import Path
from mapbox_vector_tile import decode
from shapely.geometry import shape, Point
from pyproj import Geod
E = Path(__file__).resolve().parent
ROOT = E.parents[3]
TARGETS = {'suzuka':['37fb3b43','19fe902c','76954e17'], 'miyazu':['9a7e2ec8','5ab4','1aaa7df0','e67144b1'], 'kyotamba':['2890fb14','4ff9'], 'rakusai':['c7bd9f8f','9c075aa8','c9f40153']}
geod = Geod(ellps='GRS80')
def geo(x,y,extent,tx,ty):
    return [(tx+x/extent)/65536*360-180, math.degrees(math.atan(math.sinh(math.pi*(1-2*(ty+y/extent)/65536))))]

def derive():
    result = []
    for site in json.loads((E/'vector-acquisition.json').read_text())['sites']:
        seen = set()
        for tile in site['tiles']:
            raw = (ROOT/tile['rawPath']).read_bytes()
            assert hashlib.sha256(raw).hexdigest() == tile['sha256']
            layer = decode(gzip.decompress(raw), default_options={'y_coord_down':True}).get('BldA')
            if not layer: continue
            for feature in layer['features']:
                key = hashlib.sha256(json.dumps(feature['geometry'],sort_keys=True).encode()).hexdigest()[:8]
                if not any(key.startswith(k) for k in TARGETS[site['name']]) or key in seen: continue
                seen.add(key)
                geom = shape(feature['geometry']); ext = layer['extent']; tx,ty=tile['x'],tile['y']
                area = 0
                for part in getattr(geom,'geoms',[geom]):
                    for sign,ring in [(1,part.exterior)]+[(-1,r) for r in part.interiors]:
                        points = [geo(x,y,ext,tx,ty) for x,y in ring.coords]
                        area += sign*abs(geod.polygon_area_perimeter([p[0] for p in points],[p[1] for p in points])[0])
                point = geom.centroid
                method = 'MVT平面面積重心'
                if not geom.contains(point): point = geom.representative_point(); method = '重心外部・穴のためShapely representative_point'
                lng,lat = [round(v,7) for v in geo(point.x,point.y,ext,tx,ty)]
                x=((lng+180)/360*65536-tx)*ext
                y=((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*65536-ty)*ext
                assert geom.contains(Point(x,y)), 'rounded point outside polygon'
                result.append({'site':site['name'],'key':key,'tile':tile,'properties':feature['properties'],'geometry':feature['geometry'],'extent':ext,'geodesicAreaM2':round(area,2),'pointMethod':method,'pointLngLat':[lng,lat],'roundedInside':True,'role':'比較用。採用済みを意味しない。'})
    return result

if __name__ == '__main__':
    print(json.dumps(derive(), ensure_ascii=False, indent=2))
