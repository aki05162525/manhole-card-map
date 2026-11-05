"""Reproduce two proposed points; does not approve them or change the manifest.
uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python data/evidence/location-batch1/west/derive.py
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
    assert layer['extent'] == row['extent']
    matches = [f for f in layer['features'] if f['geometry'] == row['selectedGeometry']]
    assert len(matches) == 1
    feature = matches[0]
    assert feature['properties'] == row['properties']
    polygon = shape(feature['geometry'])
    assert polygon.is_valid
    centroid_within = polygon.contains(polygon.centroid)
    assert centroid_within == row['centroidWithin']
    if row['method'] == 'centroid':
        point = polygon.centroid
    elif row['method'] == 'representative_point':
        assert not centroid_within
        point = polygon.representative_point()
    else:
        raise ValueError('unknown method')
    assert polygon.contains(point)
    z, x, y = (row['tile'][key] for key in ('z', 'x', 'y'))
    extent = layer['extent']
    lng = (x + point.x / extent) / 2**z * 360 - 180
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + point.y / extent) / 2**z))))
    coordinate = {'lat': round(lat, 7), 'lng': round(lng, 7)}
    assert coordinate == row['expectedCoordinate']
    round_x = ((coordinate['lng'] + 180) / 360 * 2**z - x) * extent
    round_y = ((1 - math.asinh(math.tan(math.radians(coordinate['lat']))) / math.pi) / 2 * 2**z - y) * extent
    assert polygon.contains(Point(round_x, round_y))
    results.append({'facilityId': row['facilityId'], 'coordinate': coordinate,
                    'method': row['method'], 'pointTileXY': [point.x, point.y],
                    'centroidWithinFootprint': centroid_within, 'pointWithinFootprint': True,
                    'roundedPointWithinFootprint': True, 'sourceCRS': spec['sourceCRS'],
                    'precision': 'Building representative; source generalization/identification uncertainty not surveyed. Seven decimal places are serialization precision, not measured accuracy.'})
print(json.dumps({'schema': 1, 'rows': results}, ensure_ascii=False, indent=2))
