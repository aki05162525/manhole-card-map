"""Reproduce the two-point containment diagnostic; never approves a location.

mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 \
    python data/evidence/location-batch2/shikoku/diagnostic.py
"""
import gzip
import hashlib
import json
import math
from pathlib import Path
from mapbox_vector_tile import decode
from shapely.geometry import Point, shape

E = Path(__file__).resolve().parent
spec = json.loads((E / 'vector-inputs.json').read_text())
facts = json.loads((E / 'facts.json').read_text())['welpiaDiagnostic']
row = next(r for r in spec['rows'] if r['name'] == facts['tile'])
raw = (E / Path(row['path']).name).read_bytes()
assert hashlib.sha256(raw).hexdigest() == row['sha256']
layer = decode(gzip.decompress(raw), default_options={'y_coord_down': True})['BldA']
assert layer['extent'] == 4096
polygon = shape(layer['features'][facts['featureIndex']]['geometry'])
assert polygon.is_valid
results = []
for source in facts['points']:
    lat, lng = source['coordinate']['lat'], source['coordinate']['lng']
    z, x, y = (row['tile'][k] for k in ('z', 'x', 'y'))
    px = ((lng + 180) / 360 * 2**z - x) * layer['extent']
    py = ((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2**z - y) * layer['extent']
    inside = polygon.contains(Point(px, py))
    assert inside
    results.append({'source': source['key'], 'withinTileFeature': inside,
                    'tileXY': [px, py], 'accepted': False})
print(json.dumps({'schema': 1, 'facilityId': facts['facilityId'], 'rows': results,
                  'limitation': 'Containment is not independent building identification; no adoption or centroid.'}, indent=2))
