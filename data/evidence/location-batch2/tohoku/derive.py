"""Reproduce comparison points, never adoption decisions.
Run: mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python data/evidence/location-batch2/tohoku/derive.py
"""
import gzip
import hashlib
import json
import math
from pathlib import Path
from mapbox_vector_tile import decode
from shapely.geometry import Point, shape

D = Path(__file__).resolve().parent
spec = json.loads((D / 'vector-inputs.json').read_text())
results = []
for row in spec['tiles']:
    raw = (D / row['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == row['sha256']
    layer = decode(gzip.decompress(raw), default_options={'y_coord_down': True})['BldA']
    assert layer['extent'] == 4096
    assert len(layer['features']) == row['buildingFeatureCount']
    for comparison in row['comparisons']:
        feature = layer['features'][comparison['featureIndex']]
        assert feature == comparison['feature']
        polygon = shape(feature['geometry'])
        assert polygon.is_valid
        point = polygon.centroid
        method = 'centroid'
        if not polygon.contains(point):
            point = polygon.representative_point()
            method = 'representative_point'
        assert polygon.contains(point)
        z, x, y = (row['tile'][k] for k in ['z', 'x', 'y'])
        lon = (x + point.x / 4096) / 2**z * 360 - 180
        lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + point.y / 4096) / 2**z))))
        coord = {'lat': round(lat, 7), 'lng': round(lon, 7)}
        rx = ((coord['lng'] + 180) / 360 * 2**z - x) * 4096
        ry = ((1 - math.asinh(math.tan(math.radians(coord['lat']))) / math.pi) / 2 * 2**z - y) * 4096
        assert polygon.contains(Point(rx, ry))
        results.append({'facilityId': comparison['facilityId'], 'featureIndex': comparison['featureIndex'],
                        'coordinate': coord, 'method': method, 'centroidWithin': polygon.contains(polygon.centroid),
                        'roundedPointWithin': True, 'status': 'comparison-only-not-approved',
                        'identityConfirmed': False})
print(json.dumps({'schema': 1, 'rows': results}, ensure_ascii=False, indent=2))
