"""Reproduce two proposed building points from saved GSI vector tiles.
Run: uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python data/evidence/location-batch1/east/derive.py
The output is a proposal; this script does not change the manifest.
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
    extent = layer['extent']
    z, x, y = (row['tile'][k] for k in ('z', 'x', 'y'))
    lat, lon = row['identificationHint']['lat'], row['identificationHint']['lng']
    tx = ((lon + 180) / 360 * 2**z - x) * extent
    ty = ((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2**z - y) * extent
    hint = Point(tx, ty)
    matches = [f for f in layer['features'] if shape(f['geometry']).contains(hint)]
    assert len(matches) == 1
    feature = matches[0]
    assert feature['geometry'] == row['selectedGeometry']
    polygon = shape(feature['geometry'])
    assert polygon.is_valid and not polygon.interiors
    c = polygon.centroid
    assert polygon.contains(c)
    lng = (x + c.x / extent) / 2**z * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + c.y / extent) / 2**z))))
    scale = 2 * math.pi * 6378137 * math.cos(math.radians(lat)) / (2**z * extent)
    others = [shape(f['geometry']).distance(hint) * scale for f in layer['features'] if f is not feature]
    result = {'facilityId': row['facilityId'], 'tile': row['tile'], 'extent': extent,
              'geometry': feature['geometry'], 'properties': feature['properties'],
              'centroidTileXY': [c.x, c.y], 'centroidWithinFootprint': True,
              'coordinate': {'lat': round(lat, 7), 'lng': round(lng, 7)},
              'hintDistanceMetresApprox': polygon.centroid.distance(hint) * scale,
              'nextBuildingDistanceFromHintMetresApprox': min(others),
              'sourceCRS': 'JGD2011 geographical coordinates; Web Mercator tile lattice',
              'method': 'BldA polygon planar area centroid in tile XY; inverse slippy Web Mercator; round to 7 decimals. No WGS84 datum transformation.',
              'precision': 'Building representative point; no surveyed accuracy claim. Tile quantization about 0.12 m; source generalization and facility identification dominate.'}
    assert result['coordinate'] == row['expectedCoordinate']
    results.append(result)
print(json.dumps({'schema': 1, 'rows': results}, ensure_ascii=False, indent=2))
