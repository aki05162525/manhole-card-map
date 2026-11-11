"""Offline GSI BldA centroid candidates. PBF decoding uses optional requirements-research.txt dependencies.

Usage: python candidate_pipeline.py config.json --out /tmp/candidate.json
References in config are relative to config's directory. Never approves locations.
"""
import argparse
import hashlib
import json
from pathlib import Path
import tempfile
from urllib.parse import urlsplit

from acquisition import safe_path, verify, write_record
from research_common import decode_tile, rounded_coordinate

VERSION = '1'


def centroid(geometry):
    polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
    if geometry['type'] not in ('Polygon', 'MultiPolygon'):
        raise ValueError('polygon required')
    total = sx = sy = 0.0
    for rings in polygons:
        for index, ring in enumerate(rings):
            area = cx = cy = 0.0
            for a, b in zip(ring, ring[1:] + ring[:1]):
                cross = a[0]*b[1]-b[0]*a[1]
                area += cross
                cx += (a[0]+b[0])*cross
                cy += (a[1]+b[1])*cross
            if not area:
                raise ValueError('degenerate ring')
            weight = abs(area) * (1 if index == 0 else -1)
            total += weight
            sx += cx/(3*area)*weight
            sy += cy/(3*area)*weight
    if total <= 0:
        raise ValueError('positive polygon area required')
    return [sx/total, sy/total]


def check_tile_source(record, tile):
    # The source hash proves the bytes, not that the configured tile numbers describe them.
    if not urlsplit(record.get('url', '')).path.endswith(f"/{tile['z']}/{tile['x']}/{tile['y']}.pbf"):
        raise ValueError('tile does not match source URL')


def check_not_clipped(geometry, extent):
    # A clipped building's centroid moves; combining adjacent tiles is not supported here.
    polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
    if any(not 0 < value < extent for rings in polygons for ring in rings for vertex in ring for value in vertex):
        raise ValueError('feature touches tile boundary; adjacent tiles required')


def generate(config, root):
    source = config['source']
    record = json.loads(safe_path(root, source['record']).read_text())
    raw = verify(record, root if source['storage'] == '.' else safe_path(root, source['storage']))
    if record['status'] == 'failed' or raw is None or hashlib.sha256(raw).hexdigest() != source['sha256']:
        raise ValueError('source hash/status mismatch')
    if config['layer'] != 'BldA' or config['method'] != 'centroid':
        raise ValueError('only BldA centroid supported')
    check_tile_source(record, config['tile'])
    layer = decode_tile(raw).get(config['layer'])
    index = config['featureIndex']
    if layer is None or type(index) is not int or not 0 <= index < len(layer['features']):
        raise ValueError('missing layer or feature')
    feature = layer['features'][index]
    geometry = feature['geometry']
    point = centroid(geometry)
    check_not_clipped(geometry, layer['extent'])
    checks = rounded_coordinate(geometry, config['tile'], point, layer['extent'])
    if not checks['mechanicalChecksPassed']:
        raise ValueError('centroid or rounded point outside strict interior')
    return dict(schema=1, result='candidate', facilityId=config['facilityId'],
                tool={'name': 'candidate_pipeline', 'version': VERSION}, input=config,
                acquisition=record, tile=dict(config['tile'], extent=layer['extent'],
                layer=config['layer'], featureIndex=index, featureIndexBase=0,
                vtCode=feature['properties'].get('vt_code', feature['properties'].get('vtCode'))),
                geometry=geometry, pointMethod='area-weighted centroid; holes subtracted; 7 decimal rounding',
                coordinate=checks['coordinate'], checks=checks,
                crs='GSI optimal_bvmap-v1; JGD2011 geographic; inverse Web Mercator; no WGS84 datum transformation',
                precision='Tile quantization and 7 decimal rounding; positional accuracy unverified',
                unchecked=['site identity', 'railway or river separation', 'point off roads', 'licence', 'geometry validity'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('config', type=Path)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    try:
        output = args.out
        if output is None:
            output = Path(tempfile.mkdtemp(prefix='candidate-')) / 'candidate.json'
        repo = Path(__file__).resolve().parents[2]
        target = output.resolve()
        if target.is_relative_to(repo/'data') and not target.is_relative_to(repo/'data/work'):
            raise ValueError('source data output forbidden')
        if output.exists() or output.is_symlink():
            raise FileExistsError(output)
        write_record(output, generate(json.loads(args.config.read_text()), args.config.resolve().parent))
        print(output)
    except (ValueError, OSError, KeyError, TypeError, ImportError) as error:
        parser.exit(1, f'candidate failed: {error}\n')


if __name__ == '__main__':
    main()
