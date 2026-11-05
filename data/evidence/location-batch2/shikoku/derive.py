"""Reproduce candidate geometry from licensed GSI tiles, without approving identity.

mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 \
    python data/evidence/location-batch2/shikoku/derive.py
"""
import gzip
import hashlib
import json
import math
from pathlib import Path
from mapbox_vector_tile import decode
from shapely.geometry import shape, Point
from shapely.affinity import translate
from shapely.ops import unary_union

E = Path(__file__).resolve().parent
spec = json.loads((E / 'vector-inputs.json').read_text())
expected = json.loads((E / 'reassessment-calculations.json').read_text())
for path, digest in expected['dependencies'].items():
    assert hashlib.sha256((E.parents[3] / path).read_bytes()).hexdigest() == digest
inputs = {r['name']: r for r in spec['rows']}
layers = {}
for name, row in inputs.items():
    raw = (E / Path(row['path']).name).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == row['sha256']
    layers[name] = decode(gzip.decompress(raw), default_options={'y_coord_down': True})['BldA']
    assert layers[name]['extent'] == 4096
results = []
for row in expected['rows']:
    base = row['baseTile']
    polygons = []
    for part in row['parts']:
        tile = inputs[part['tile']]['tile']
        feature = layers[part['tile']]['features'][part['featureIndex']]
        assert feature['geometry'] == part['geometry']
        assert feature['properties'] == part['properties']
        polygons.append(translate(shape(feature['geometry']),
                                  xoff=(tile['x']-base['x'])*4096,
                                  yoff=(tile['y']-base['y'])*4096))
    polygon = unary_union(polygons)
    assert polygon.is_valid and polygon.geom_type == 'Polygon'
    assert polygon.equals(shape(row['geometry']))
    centroid = polygon.centroid
    inside = polygon.contains(centroid)
    assert inside == row['centroidWithin']
    method = 'centroid' if inside else 'representative_point'
    assert method == row['method']
    point = centroid if inside else polygon.representative_point()
    def geographic(p):
        return {'lat': math.degrees(math.atan(math.sinh(math.pi*(1-2*(base['y']+p.y/4096)/2**base['z'])))),
                'lng': (base['x']+p.x/4096)/2**base['z']*360-180}
    coordinate = {k: round(v, 7) for k, v in geographic(point).items()}
    assert coordinate == row['coordinate']
    px = ((coordinate['lng']+180)/360*2**base['z']-base['x'])*4096
    py = ((1-math.asinh(math.tan(math.radians(coordinate['lat'])))/math.pi)/2*2**base['z']-base['y'])*4096
    assert polygon.contains(Point(px, py))
    scale = 2*math.pi*6378137*math.cos(math.radians(geographic(centroid)['lat']))/(2**base['z']*4096)
    area = polygon.area*scale**2
    assert abs(area-row['areaApproxM2']) < 0.001
    results.append({'name': row['name'], 'coordinate': coordinate, 'method': method,
                    'centroidWithin': inside, 'roundedWithin': True, 'areaApproxM2': area})
print(json.dumps({'schema': 1, 'rows': results}, ensure_ascii=False, indent=2))
