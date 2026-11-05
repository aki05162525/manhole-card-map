"""Reproduce a candidate, without approving or selecting it.
Run: mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python data/evidence/location-batch2/hokkaido/derive.py
"""
import gzip
import hashlib
import json
import math
from pathlib import Path
from mapbox_vector_tile import decode
from shapely.geometry import Point, shape

D = Path(__file__).resolve().parent
raw = (D / 'sewage.pbf.gz').read_bytes()
spec = json.loads((D / 'candidate-input.json').read_text())
assert hashlib.sha256(raw).hexdigest() == spec['sha256']
layer = decode(gzip.decompress(raw), default_options={'y_coord_down': True})['BldA']
assert layer['extent'] == 4096
matches = [f for f in layer['features'] if f['geometry'] == spec['geometry']]
assert len(matches) == 1 and matches[0]['properties'] == spec['properties']
p = shape(matches[0]['geometry'])
assert p.is_valid and p.contains(p.centroid)
c = p.centroid
z, x, y = 16, 58498, 24051
lng = (x + c.x / 4096) / 2**z * 360 - 180
lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + c.y / 4096) / 2**z))))
coordinate = {'lat': round(lat, 7), 'lng': round(lng, 7)}
rx = ((coordinate['lng'] + 180) / 360 * 2**z - x) * 4096
ry = ((1 - math.asinh(math.tan(math.radians(coordinate['lat']))) / math.pi) / 2 * 2**z - y) * 4096
assert p.contains(Point(rx, ry))
print(json.dumps({'facilityId': spec['facilityId'], 'coordinate': coordinate,
                  'method': 'polygon centroid in tile plane; inverse Web Mercator',
                  'pointTileXY': [c.x, c.y], 'centroidWithin': True,
                  'roundedPointWithin': True, 'source': '国土地理院最適化ベクトルタイルを加工',
                  'precision': '建物代表点。小数7桁は出力精度で測量精度ではない。'}, ensure_ascii=False, indent=2))
