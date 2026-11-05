"""Reproduce proposed building points from saved numerical originals; no approval.
 mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python data/evidence/location-batch2/north-kanto/derive.py
"""
import gzip
import hashlib
import json
import math
from pathlib import Path
from mapbox_vector_tile import decode
from shapely.geometry import Point, shape
ROOT = Path(__file__).resolve().parents[4]
D = Path(__file__).resolve().parent
results = []
for row in json.loads((D / 'geometry-inputs.json').read_text())['rows']:
    raw = (ROOT / row['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == row['sha256']
    layer = decode(gzip.decompress(raw), default_options={'y_coord_down': True})[row['layer']]
    assert layer['extent'] == row['extent'] == 4096
    matches = [f for f in layer['features'] if f['geometry'] == row['selectedGeometry']]
    assert len(matches) == 1 and matches[0]['properties'] == row['properties']
    polygon = shape(matches[0]['geometry'])
    assert polygon.is_valid and polygon.contains(polygon.centroid)
    point = polygon.centroid
    z, x, y = (row['tile'][k] for k in ('z', 'x', 'y'))
    lng = (x + point.x / 4096) / 2**z * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + point.y / 4096) / 2**z))))
    coord = {'lat': round(lat, 7), 'lng': round(lng, 7)}
    assert coord == row['expectedCoordinate']
    round_x = ((coord['lng'] + 180) / 360 * 2**z - x) * 4096
    round_y = ((1 - math.asinh(math.tan(math.radians(coord['lat']))) / math.pi) / 2 * 2**z - y) * 4096
    assert polygon.contains(Point(round_x, round_y))
    results.append({'facilityId': row['facilityId'], 'coordinate': coord, 'centroidWithin': True,
                    'roundedPointWithin': True, 'geometrySHA256': hashlib.sha256(json.dumps(row['selectedGeometry'],sort_keys=True).encode()).hexdigest(),
                    'precision': 'Building representative; seven decimals are serialization precision, not survey accuracy.'})
print(json.dumps({'schema': 1, 'rows': results}, ensure_ascii=False, indent=2))
