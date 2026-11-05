"""Compare old search seeds with new Vector footprints; never propose coordinates.
Run: mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python data/evidence/location-batch2/tokai/compare.py
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
for row in spec['rows']:
    raw = (D / row['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == row['sha256']
    layer = decode(gzip.decompress(raw), default_options={'y_coord_down': True})['BldA']
    assert layer['extent'] == 4096
    z, x, y = (row['tile'][k] for k in ('z', 'x', 'y'))
    lat, lng = row['searchSeed']['lat'], row['searchSeed']['lng']
    point = Point(((lng + 180) / 360 * 2**z - x) * 4096,
                  ((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2**z - y) * 4096)
    matches = []
    for index, feature in enumerate(layer['features']):
        polygon = shape(feature['geometry'])
        if polygon.is_valid and polygon.contains(point):
            matches.append({'featureIndex': index, 'geometry': feature['geometry'], 'properties': feature['properties']})
    assert [m['featureIndex'] for m in matches] == row['expectedContainingIndices']
    results.append({'name': row['name'], 'searchSeedTileXY': [point.x, point.y],
                    'containingFeatures': matches, 'adoptionDecision': 'held',
                    'note': 'Contains is only a numerical comparison, not independent building identification.'})
print(json.dumps({'schema': 1, 'rows': results}, ensure_ascii=False, indent=2))
