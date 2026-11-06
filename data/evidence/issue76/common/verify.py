"""Read-only common evidence checks; no facility approval or full suite.

Run from any directory with python3 -B. --raw also requires the saved /tmp
sources; normal checks use tracked inputs only. JSON is written to stdout.
"""
from pathlib import Path
import gzip
import hashlib
import importlib.util
import json
import math
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]


def read(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check():
    inputs = read(HERE / 'repo-inputs.json')
    for row in inputs['files']:
        assert digest(ROOT / row['path']) == row['sha256'], row['path']
    product = read(HERE / 'product.json')
    assert digest(HERE / 'pmtiles-header.bin') == product['headerSHA256']
    assert digest(HERE / 'pmtiles-metadata.bin') == product['compressedMetadataSHA256']
    header = (HERE / 'pmtiles-header.bin').read_bytes()
    assert header[:7] == b'PMTiles' and header[7] == 3
    assert int.from_bytes(header[24:32], 'little') == 2503
    assert int.from_bytes(header[32:40], 'little') == 4168
    metadata = read(HERE / 'pmtiles-metadata.json')
    assert json.loads(gzip.decompress((HERE / 'pmtiles-metadata.bin').read_bytes())) == metadata
    assert metadata['generator'] == 'tile-join v1.36.0'
    assert '-S 2 -Z 14 -z 16 -B 14' in metadata['generator_options']
    for name in ['chiba/range-retrievals.json', 'tochigi/vector-retrievals.json',
                 'tochigi/kanuma-vector-retrievals.json']:
        assert product['etag'].strip('"') in (ROOT / 'data/evidence/kanto-prefecture' / name).read_text()
    raw_count = 0
    if '--raw' in sys.argv:
        index = read(HERE / 'source-index.json')
        for row in index['sources']:
            assert digest(Path(row['rawPath'])) == row['sha256'], row['name']
            raw_count += 1
        assert digest(Path(index['priorReport']['path'])) == digest(HERE / 'prior-crs-report.md')

    spec = importlib.util.spec_from_file_location('research_common', ROOT / 'tools/national/research_common.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    differences = []
    for row in read(HERE / 'prior-code-observations.json')['numericCheck']:
        z, x, y, u, v, extent = (row[k] for k in ['z', 'x', 'y', 'u', 'v', 'extent'])
        polygon = {'type': 'Polygon', 'coordinates': [[[u-1,v-1],[u+1,v-1],[u+1,v+1],[u-1,v+1],[u-1,v-1]]]}
        result = module.rounded_coordinate(polygon, dict(z=z,x=x,y=y), (u,v), extent, 12)
        official_lat = 360/math.pi*math.atan(math.exp((180-360*(v+y*extent)/(extent*2**z))*math.pi/180))-90
        official_lng = 360*(u+x*extent)/(extent*2**z)-180
        error = max(abs(result['coordinate']['lat']-official_lat), abs(result['coordinate']['lng']-official_lng))
        assert error < 1e-11 and result['mechanicalChecksPassed']
        differences.append(error)
    scales = []
    for latitude in [35, 36, 37]:
        scale = 2*math.pi*6378137*math.cos(math.radians(latitude))/(2**16*4096)
        rounding = 6378137*math.radians(0.5e-7)*math.sqrt(1+math.cos(math.radians(latitude))**2)
        scales.append(dict(latitude=latitude,gridMetresApprox=scale,
                           conditionalNearestGridRadialMetres=scale/math.sqrt(2),
                           decimal7RoundingMetresApprox=rounding))
    asuka = read(ROOT / 'data/evidence/kanto-prefecture/tokyo/north/asukayama-comparison.json')
    holdouts = []
    for row in asuka['numericFit']['rows']:
        if row['role'] != 'holdout':
            continue
        units = math.dist(row['predicted'], row['featureCentroid'])
        assert abs(units-row['residualUnits']) < 0.051
        holdouts.append(dict(name=row['name'],unitsRecomputed=units,
                             metresFromRecordedRoundedUnits=row['residualUnits']*asuka['footprint']['scaleMetersPerUnit']))
    reku = read(ROOT / 'data/evidence/kanto-prefecture/tokyo/south/reku-plan-derivation.json')
    point = reku['checkPoint']
    residual = math.dist(point['aerialPx'],point['mappedPx'])*reku['metresPerAerialPixelApprox']
    assert abs(residual-point['residualApproxM']) < 0.051
    return dict(status='pass',scope='Hashes, arithmetic and common inverse projection only; no approval',
                baselineHead=inputs['head'],repoInputHashesChecked=len(inputs['files']),rawHashesChecked=raw_count,
                inverseMaxDegreeDifferences=differences,gridAndRounding=scales,
                scaleCaveat='Local spherical ground approximation, not survey accuracy. Half-grid conditional on nearest rounding; not a generator bound.',
                asukayamaHoldouts=holdouts,rekuHoldoutMetres=residual,
                comparisonCaveat='Plan/image correspondence residuals, not independent absolute ground truth or universal bounds.')


if __name__ == '__main__':
    print(json.dumps(check(), ensure_ascii=False, indent=2))
