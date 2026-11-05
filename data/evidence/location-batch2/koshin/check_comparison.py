"""Recheck diagnostic containment and the uncut Chikuma outline from saved PBF bytes.
uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python data/evidence/location-batch2/koshin/check_comparison.py
No geocoder or semantic building inference is used here.
"""
import gzip
import hashlib
import json
import math
from pathlib import Path
from mapbox_vector_tile import decode
from shapely.geometry import Point, shape

D = Path(__file__).resolve().parent
ROOT = D.parents[3]
comparison = json.loads((D / 'building-comparison.json').read_text())
for path, expected in comparison['filesSHA256'].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected
spec = json.loads((D / 'matsumoto-comparison.json').read_text())
t = spec['tile']
features = decode(gzip.decompress((D / 'matsumoto-tile.pbf.gz').read_bytes()),
                  default_options={'y_coord_down': True})['BldA']['features']
for row in spec['rows']:
    lat, lng = row['coordinate']['lat'], row['coordinate']['lng']
    p = Point(((lng + 180) / 360 * 2**t['z'] - t['x']) * t['extent'],
              ((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2**t['z'] - t['y']) * t['extent'])
    polygons = [shape(f['geometry']) for f in features]
    assert [i for i, g in enumerate(polygons) if g.contains(p)] == row['containsFeatureIndices']
    i = min(range(len(polygons)), key=lambda i: polygons[i].distance(p))
    assert i == row['nearestFeatureIndex']
    assert features[i]['geometry'] == row['nearestGeometry']
    scale = 40075016.68557849 * math.cos(math.radians(lat)) / 2**t['z'] / t['extent']
    assert abs(polygons[i].distance(p) * scale - row['nearestDistanceApproxMeters']) < 1e-8
    assert abs(polygons[i].area * scale**2 - row['nearestAreaApproxSquareMeters']) < 1e-8
sw = decode(gzip.decompress((D / 'chikuma-sw-tile.pbf.gz').read_bytes()), default_options={'y_coord_down': True})['BldA']['features'][10]['geometry']
nw = decode(gzip.decompress((D / 'chikuma-nw-tile.pbf.gz').read_bytes()), default_options={'y_coord_down': True})['BldA']['features'][153]['geometry']
# SW complete ring lies strictly inside the tile buffer (-80..4176).
assert all(-80 < c < 4176 for point in sw['coordinates'][0] for c in point)
sw_top = {tuple(p) for p in sw['coordinates'][0] if p[1] < 80}
nw_top = {(x, y-4096) for x, y in nw['coordinates'][0] if y-4096 < 80}
assert sw_top == nw_top
print('Matsumoto two-point containment/distance and Chikuma uncut northern tip: OK')
