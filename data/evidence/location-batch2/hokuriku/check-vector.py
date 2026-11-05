"""Verify saved research tiles; no automatic building selection."""
import gzip
import hashlib
import json
from pathlib import Path
from mapbox_vector_tile import decode

root = Path(__file__).resolve().parents[4]
spec = json.loads((Path(__file__).parent / 'vector-observations.json').read_text())
for row in spec['rows']:
    raw = (root / row['path']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == row['sha256']
    layer = decode(gzip.decompress(raw), default_options={'y_coord_down': True})['BldA']
    assert layer['extent'] == row['extent']
    assert len(layer['features']) == row['buildingFeatures']
    assert all(f['geometry']['type'] in ('Polygon', 'MultiPolygon') for f in layer['features'])
    assert row['candidateCoordinate'] is None
    print(row['id'], row['tile'], len(layer['features']), 'no adoption')
