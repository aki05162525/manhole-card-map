"""Reproduce a non-adoption exploration, not a building identity claim.
uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python <this file>
"""
import gzip
import hashlib
import json
import math
from pathlib import Path
from mapbox_vector_tile import decode
from shapely.geometry import Point, shape

D = Path(__file__).resolve().parent
spec = json.loads((D / 'vector-exploration.json').read_text())
b = (D / spec['file']).read_bytes()
assert hashlib.sha256(b).hexdigest() == spec['sha256']
layer = decode(gzip.decompress(b), default_options={'y_coord_down': True})['BldA']
z, x, y, extent = (spec['tile'][key] for key in ('z', 'x', 'y', 'extent'))
assert extent == layer['extent']
hint = spec['hint']
xf = (hint['lng'] + 180) / 360 * 2**z
yf = (1 - math.asinh(math.tan(math.radians(hint['lat']))) / math.pi) / 2 * 2**z
assert (int(xf), int(yf)) == (x, y)
point = Point((xf - x) * extent, (yf - y) * extent)
assert len(layer['features']) == spec['buildings'] == 496
count = sum(shape(f['geometry']).contains(point) for f in layer['features'])
assert count == spec['hintContainingBuildings'] == 0
assert spec['selectedGeometry'] is None and spec['derivedCoordinate'] is None
print('BldA=496; hint-containing=0; selected geometry=none; proposed coordinate=none')
