"""Offline diagnosis only; no facility adoption or derived representative points.
Run with pinned mapbox-vector-tile==2.2.0 and shapely==2.2.0.
Source: 国土地理院最適化ベクトルタイル (PDL1.0), see source-conditions.json.
"""
import gzip
import hashlib
import json
import math
from pathlib import Path
from mapbox_vector_tile import decode
from shapely.geometry import Point, shape

ROOT = Path(__file__).resolve().parents[4]
E = Path(__file__).resolve().parent
spec = json.loads((E / 'vector-check.json').read_text())
observations = json.loads((E / 'numeric-observations.json').read_text())
for row in spec['rows']:
    raw = (ROOT / row['path']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == row['sha256']
    layer = decode(gzip.decompress(raw), default_options={'y_coord_down': True})['BldA']
    assert layer['extent'] == row['extent']
    fields = observations[row['name']]['fields']
    lat = float(fields['緯度'] if row['name'] == 'nara' else fields['K36'])
    lng = float(fields['経度'] if row['name'] == 'nara' else fields['L36'])
    assert abs(lat - row['seed']['lat']) < 1e-12 and abs(lng - row['seed']['lng']) < 1e-12
    z, x, y = (row['tile'][k] for k in ('z', 'x', 'y'))
    xf = (lng + 180) / 360 * 2**z
    yf = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2**z
    assert int(xf) == x and int(yf) == y
    pt = Point((xf - x) * layer['extent'], (yf - y) * layer['extent'])
    matches = [f for f in layer['features'] if shape(f['geometry']).contains(pt)]
    assert matches == row['containingFeatures']
    assert len(matches) == row['containsCount']
    print(row['name'], 'containing BldA:', len(matches), 'not a building identification')
