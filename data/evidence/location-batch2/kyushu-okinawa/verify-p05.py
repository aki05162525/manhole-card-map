"""Independently compare original P05 points with the saved GSI exterior (no adoption)."""
import hashlib
import io
import json
import math
from pathlib import Path
import zipfile
from pyproj import Transformer
from shapely.geometry import Point, shape
from shapely.ops import transform
E = Path(__file__).resolve().parent
R = E.parents[3]
archive = R / 'data/evidence/issue5/chubu/P05-22_GML.zip'
assert hashlib.sha256(archive.read_bytes()).hexdigest() == '3056d3e0d02248143f1f2c9a5e62fd37717eb761a7257106b5d252415aef4cdc'
with zipfile.ZipFile(archive) as outer:
    for row in json.loads((E / 'building-comparisons.json').read_text())['rows']:
        if not row['p05Comparison']:
            continue
        prefecture = '42' if row['area'] == 'isahaya' else '46'
        with zipfile.ZipFile(io.BytesIO(outer.read(f'P05-22_{prefecture}_GML.zip'))) as inner:
            features = json.loads(inner.read(f'P05-22_{prefecture}.geojson'))['features']
        tr = Transformer.from_crs('EPSG:6668', row['metricCRS'], always_xy=True)
        def local(x, y, z=None):
            return tr.transform(x / (4096 * 65536) * 360 - 180,
                                math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / (4096 * 65536))))))
        g = transform(local, shape(row['footprint']['geometry']))
        for p in row['p05Comparison']:
            lng, lat = features[p['P05FeatureIndex']]['geometry']['coordinates']
            assert p['coordinate'] == {'lat': lat, 'lng': lng}
            point = Point(*tr.transform(lng, lat))
            assert g.contains(point) == p['within']
            assert abs(g.distance(point) - p['distanceToFootprintMeters']) < 1e-6
            print(row['area'], p['P05FeatureIndex'], p['within'], round(g.distance(point), 6))
