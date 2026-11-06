"""Read-only scoped distances. Run from repo root with Shapely 2.2.0 and
mapbox-vector-tile 2.2.0: python -B data/evidence/issue76/saitama/measure.py
Print JSON only; never fetch, regenerate research, or write inputs.
"""
import hashlib
import json
import math
from pathlib import Path
import re
import sys
from shapely.geometry import Point, shape
from shapely.affinity import translate
sys.path.insert(0, 'tools/national')
from research_common import decode_tile

N = Path('data/national/kanto-prefecture/saitama')

def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def main():
    output = []
    for row in json.loads((N / 'full-locations.json').read_text())['updates']:
        evidence = row['evidence']
        path = Path(evidence['snapshotPath'])
        assert sha(path) == evidence['snapshotSHA256']
        match = re.search(r'(?:layerFeatureIndex=|features\[)(\d+)', evidence['sourceLocator'])
        index = int(match[1])
        match = re.search(r'(.*?)(16)-(\d+)-(\d+)\.pbf.gz$', path.name)
        prefix, z, tx, ty = match.groups()
        z, tx, ty = map(int, (z, tx, ty))
        data = decode_tile(path.read_bytes())
        extent = data['BldA']['extent']
        target = shape(data['BldA']['features'][index]['geometry'])
        lat, lng = row['coordinate']['lat'], row['coordinate']['lng']
        pt = Point(((lng + 180) / 360 * 2**z - tx) * extent,
                   ((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2**z - ty) * extent)
        assert target.contains(pt), row['facilityId']
        scale = 2 * math.pi * 6378137 * math.cos(math.radians(lat)) / (2**z * extent)
        nearest = {}
        overlapping = []
        tiles = []
        for raw in sorted(path.parent.glob(prefix + '16-*-*.pbf.gz')):
            m = re.search(r'16-(\d+)-(\d+)\.pbf.gz$', raw.name)
            x, y = map(int, m.groups())
            # Only already acquired tiles near target, not county-wide files.
            if abs(x - tx) > 2 or abs(y - ty) > 2:
                continue
            tiles.append({'path': str(raw), 'sha256': sha(raw)})
            decoded = decode_tile(raw.read_bytes())
            for layer in ['BldA', 'RdEdg', 'RdCL']:
                if layer not in decoded:
                    continue
                assert decoded[layer]['extent'] == extent
                for i, f in enumerate(decoded[layer]['features']):
                    g = translate(shape(f['geometry']), (x - tx)*extent, (y - ty)*extent)
                    ref = {'path': str(raw), 'layer': layer, 'featureIndex': i}
                    if layer == 'BldA' and g.intersection(target).area > 0:
                        overlapping.append(ref)
                        continue
                    distance = pt.distance(g) * scale
                    if layer not in nearest or distance < nearest[layer]['distanceMeters']:
                        nearest[layer] = {**ref, 'distanceMeters': distance,
                                          'targetBoundarySeparationMeters': target.distance(g)*scale}
        for value in nearest.values():
            value['distanceMeters'] = round(value['distanceMeters'], 2)
            value['targetBoundarySeparationMeters'] = round(value['targetBoundarySeparationMeters'], 2)
        output.append({'facilityId': row['facilityId'], 'coordinateUnchanged': row['coordinate'],
                       'targetGeometry': {'path': str(path), 'layer': 'BldA', 'featureIndex': index,
                                          'sha256': sha(path)},
                       'pointInside': True, 'boundaryMarginMeters': round(pt.distance(target.boundary)*scale, 2),
                       'nearestNonoverlappingFeatures': nearest,
                       'overlappingFeaturesExcludedFromNeighborSearch': overlapping,
                       'inputs': tiles})
    return {'schema': 1, 'method': 'Exact planar point-to-segment / polygon distances in source MVT coordinates, converted with local spherical Mercator cos(latitude) scale (R=6378137). Rounded unchanged lat/lng projected into target tile. Holes included. Distances approximate ground metres, not geodesic survey.',
            'interpretation': 'Boundary is the selected original feature, conservative where clipped/overlapping fragments exist. No automatic union. Neighbor means nearest nonoverlapping BldA feature, not necessarily separate building: adjoining roof sections can touch. Overlapping source features are listed explicitly, not silently classified as independent buildings. RdEdg and RdCL are mapped edges/centerlines, not legal boundaries or all private drives. Same-source distances measure separation, NOT independent absolute accuracy. No total-error radius or accuracy from grid quantization is inferred.',
            'attribution': '国土地理院最適化ベクトルタイルをmanhole-card-mapが加工', 'rows': output}

if __name__ == '__main__':
    print(json.dumps(main(), ensure_ascii=False, indent=2))
