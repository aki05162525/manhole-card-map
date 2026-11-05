"""Independent projection of saved MVT shapes; see README for pinned dependencies."""
import gzip
import json
import math
from pathlib import Path
from mapbox_vector_tile import decode
from shapely.geometry import shape, Point

E = Path(__file__).resolve().parent
ROOT = E.parents[3]
def tile(name):
    return decode(gzip.decompress((E / (name + '-tile.pbf.gz')).read_bytes()),
                  default_options={'y_coord_down': True})
def xy(lat, lng, x, y):
    return [((lng + 180) / 360 * 65536 - x) * 4096,
            ((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 65536 - y) * 4096]
h, y = tile('hanamaki'), tile('yamada')
p = shape(h['BldA']['features'][396]['geometry'])
origin = [1976, 796]
width = math.hypot(525, -26)
def normalized(point):
    dx, dy = point[0] - origin[0], point[1] - origin[1]
    return [round((dx * 525 - dy * 26) / width**2, 6),
            round((dx * 26 + dy * 525) / width**2, 6)]
ring = [normalized(c) for c in p.exterior.coords]
appendage = [normalized(c) for c in shape(h['BldA']['features'][398]['geometry']).exterior.coords]
prior = json.loads((ROOT / 'data/national/issue7/tohoku.json').read_text())['unresolved'][44]
candidate = next(a for a in prior['attempts'] if a['kind'] == 'p05-22-name-address-search')['candidates'][0]
lng, lat = candidate['feature']['geometry']['coordinates']
point = Point(xy(lat, lng, 58457, 24955))
scale = 2 * math.pi * 6378137 * math.cos(math.radians(lat)) / 65536 / 4096
operator = Point(xy(39.478015, 141.9533868, 58609, 24934))
yscale = 2 * math.pi * 6378137 * math.cos(math.radians(39.478015)) / 65536 / 4096
result = {
    'schema': 1,
    'method': 'MVT y-down. Hanamaki top edge (1976,796)->(2501,770), rotate to edge axes, normalize both axes by edge length. No PDF georeferencing or coordinate replacement.',
    'hanamaki': {
        'rotationDegrees': math.degrees(math.atan2(-26, 525)),
        'normalized396Ring': ring,
        'normalized398Ring': appendage,
        'topEdgeToHeightRatio': round(1 / max(c[1] for c in ring), 6),
        'normalizedCentroid': normalized([p.centroid.x, p.centroid.y]),
        'annotations': [{'layer': 'Anno', 'featureIndex': i, 'feature': h['Anno']['features'][i],
                         'within396': p.contains(shape(h['Anno']['features'][i]['geometry']))} for i in [4, 5]],
        'oldP05': {'recordRef': 'data/national/issue7/tohoku.json#/unresolved/44/attempts/1/candidates/0',
                   'coordinate': {'lat': lat, 'lng': lng}, 'within396': p.contains(point),
                   'distanceToCentroidApproxM': round(point.distance(p.centroid) * scale, 2),
                   'limitation': 'City hall campus point, cannot distinguish main/new wing; not the adopted coordinate.'}},
    'yamada': {
        'annotation': {'layer': 'Anno', 'featureIndex': 2, 'feature': y['Anno']['features'][2],
                       'within126': shape(y['BldA']['features'][126]['geometry']).contains(shape(y['Anno']['features'][2]['geometry']))},
        'oldOperatorMap': {'recordRef': 'data/national/issue7/tohoku.json#/unresolved/46/attempts/0',
                           'coordinate': {'lat': 39.478015, 'lng': 141.9533868},
                           'distanceToOutlinesApproxM': {str(i): round(operator.distance(shape(y['BldA']['features'][i]['geometry'])) * yscale, 2) for i in [126, 127]},
                           'limitation': 'Same mapped campus vicinity, outside both outlines; no building selection or address-system equivalence inferred.'}}}
print(json.dumps(result, ensure_ascii=False, indent=2))
