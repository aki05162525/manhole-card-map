"""Reproduce proposed building points from saved, hash-checked GSI source tiles.
Run with mapbox-vector-tile==2.2.0 shapely==2.2.0 pyproj==3.7.2.
No network and no adoption authority. --check compares saved output exactly.
"""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path
from mapbox_vector_tile import decode
from pyproj import Transformer
from shapely.affinity import translate
from shapely.geometry import Point, box, shape
from shapely.ops import transform, unary_union

E = Path(__file__).resolve().parent
spec = json.loads((E / 'recheck-tiles.json').read_text())
comparisons = json.loads((E / 'building-comparisons.json').read_text())
tiles = {r['file']: r for r in spec['rows']}

def geographic(x, y, z=None):
    return (x / (4096 * 65536) * 360 - 180,
            math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / (4096 * 65536))))))

def reconstruct(piece):
    row = tiles[piece['file']]
    raw = (E / row['file']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == row['sha256']
    layer = decode(gzip.decompress(raw), default_options={'y_coord_down': True})['BldA']
    assert layer['extent'] == 4096 and row['tile']['z'] == 16
    feature = layer['features'][piece['featureIndex']]
    assert feature['properties'] == piece['properties']
    g = shape(feature['geometry']).intersection(box(0, 0, 4096, 4096))
    g = translate(g, row['tile']['x'] * 4096, row['tile']['y'] * 4096)
    assert g.equals(shape(piece['geometry'])) and g.is_valid
    return g

rows = []
for comparison in comparisons['rows']:
    footprint = comparison['footprint']
    # Verify all selected and contextual geometries against numerical originals.
    for f in [footprint] + comparison['contextFootprints']:
        g = unary_union([reconstruct(p) for p in f['sourcePieces']])
        assert g.equals(shape(f['geometry'])) and g.is_valid
    pieces = footprint['sourcePieces']
    if comparison['area'] == 'tokunoshima':
        # Do not incorporate the surrounding 3111 (ordinary open-sided structure).
        pieces = [p for p in pieces if p['properties']['vt_code'] == 3102]
    g = unary_union([reconstruct(p) for p in pieces])
    assert g.geom_type == 'Polygon'
    tr = Transformer.from_crs('EPSG:6668', comparison['metricCRS'], always_xy=True)
    inv = Transformer.from_crs(comparison['metricCRS'], 'EPSG:6668', always_xy=True)
    metric = transform(lambda x, y: tr.transform(*geographic(x, y)), g)
    centroid = metric.centroid
    p = centroid if metric.contains(centroid) else metric.representative_point()
    lng, lat = inv.transform(p.x, p.y)
    coordinate = {'lat': round(lat, 7), 'lng': round(lng, 7)}
    rounded = Point(*tr.transform(coordinate['lng'], coordinate['lat']))
    assert metric.contains(rounded)
    rows.append({'area': comparison['area'],
                 'status': 'held-outline-mismatch' if comparison['area'] == 'naha' else 'proposed-review-pending',
                 'sourcePieces': [{k: p[k] for k in ('file', 'featureIndex', 'properties')} for p in pieces],
                 'metricCRS': comparison['metricCRS'], 'areaM2': round(metric.area, 3),
                 'method': 'centroid' if metric.contains(centroid) else 'representative_point',
                 'centroidWithin': metric.contains(centroid), 'coordinate': coordinate,
                 'roundedPointWithin': True,
                 'roundedBoundaryDistanceMeters': round(metric.boundary.distance(rounded), 3)})
result = {'schema': 1, 'attribution': '国土地理院最適化ベクトルタイルをmanhole-card-mapが加工。施設の同定・代表点は国土地理院の承認を意味しない。',
          'version': 'README: 2026-07-01; PMTiles metadata: 26-07',
          'crs': '原典JGD2011。z16 MVT extent4096 y-down格子を逆WebMercator、経度/緯度をEPSG:6668として局所AEQD GRS80へ変換。WGS84への測地系変換なし。出力JSONはlat,lng。',
          'accuracy': '地図の建物代表点。個別建物の整備日・実測精度は不明。小数7桁は丸めの再現用でcm精度を意味しない。入口・窓口測量ではない。',
          'license': '試験Vectorは基本測量成果ではない。GSI利用規約PDL1.0、出典・加工表示。一般資料の原本再配布許諾と分離。',
          'rows': rows}
text = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
output = E / 'derived-points.json'
if args.check:
    assert output.read_text() == text, 'derived output differs from source computation'
else:
    output.write_text(text)
print(json.dumps({'verifiedAreas': len(rows), 'proposedBuildings': 4, 'heldBuildings': 1}))
