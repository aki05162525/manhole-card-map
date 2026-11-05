"""Re-render saved BldA for local inspection, without selecting a building.
mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with pillow==12.0.0 python data/evidence/location-batch2/south-kanto/inspect-vector.py
"""
import gzip
import hashlib
import json
from pathlib import Path
from mapbox_vector_tile import decode
from PIL import Image, ImageDraw

D = Path(__file__).resolve().parent
W = Path('data/work/location-batch2/south-kanto')
W.mkdir(parents=True, exist_ok=True)
for row in json.loads((D / 'vector-inspection.json').read_text())['tiles']:
    raw = Path(row['snapshotPath']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == row['sha256']
    layer = decode(gzip.decompress(raw), default_options={'y_coord_down': True})['BldA']
    assert layer['extent'] == row['extent'] == 4096
    assert len(layer['features']) == row['buildingCount']
    im = Image.new('RGB', (1200, 1200), 'white')
    draw = ImageDraw.Draw(im)
    for i, feature in enumerate(layer['features']):
        g = feature['geometry']
        polygons = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
        for polygon in polygons:
            outer = [(x * 1200 / 4096, y * 1200 / 4096) for x, y in polygon[0]]
            draw.polygon(outer, fill='#ffc080', outline='red')
            for hole in polygon[1:]:
                draw.polygon([(x * 1200 / 4096, y * 1200 / 4096) for x, y in hole], fill='white', outline='red')
            draw.text((sum(x for x, y in outer) / len(outer), sum(y for x, y in outer) / len(outer)), str(i), fill='black')
    im.save(W / (row['key'] + '-inspection.png'))
print('10 tiles decoded and rendered; no coordinate derived or approved')
