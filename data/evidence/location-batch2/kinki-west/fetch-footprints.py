"""Acquire GSI PMTiles for independent drawing comparison; hints never become adopted points.
Run from repo root with pmtiles==3.7.0 requests==2.32.5.
"""
import datetime
import hashlib
import json
import math
from pathlib import Path
import requests
from pmtiles.reader import Reader

ROOT = Path(__file__).resolve().parents[4]
E = Path(__file__).resolve().parent
W = ROOT / 'data/work/location-batch2/kinki-west/revision'
W.mkdir(parents=True, exist_ok=True)
URL = 'https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles'
records = []
cache = {}

def get_bytes(offset, length):
    if (offset, length) in cache:
        return cache[offset, length]
    at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    response = requests.get(URL, headers={'Range': f'bytes={offset}-{offset+length-1}'}, timeout=40)
    response.raise_for_status()
    assert response.status_code == 206 and len(response.content) == length
    path = W / f'pmtiles-{offset}-{length}.bin'
    path.write_bytes(response.content)
    records.append(dict(url=URL, range=f'bytes={offset}-{offset+length-1}', fetchedAt=at,
                        path=str(path.relative_to(ROOT)), sha256=hashlib.sha256(response.content).hexdigest(),
                        etag=response.headers.get('etag'), lastModified=response.headers.get('last-modified')))
    (E / 'footprint-retrievals.json').write_text(json.dumps(records, indent=2)+'\n')
    cache[offset, length] = response.content
    return response.content

reader = Reader(get_bytes)
rows = []
for name, lat, lng in [('inami',34.748627,134.913384), ('kashiwara',34.579315,135.628642)]:
    z = 16
    xf = (lng+180)/360*2**z
    yf = (1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z
    # 450m square around existing P05 municipality hint, no selection by containment.
    for x in range(math.floor(xf-.45), math.floor(xf+.45)+1):
        for y in range(math.floor(yf-.45), math.floor(yf+.45)+1):
            data = reader.get(z,x,y)
            path = E / f'{name}-{z}-{x}-{y}.pbf.gz'
            path.write_bytes(data)
            rows.append(dict(name=name,z=z,x=x,y=y,path=str(path.relative_to(ROOT)),sha256=hashlib.sha256(data).hexdigest()))
assert len({r['etag'] for r in records}) == len({r['lastModified'] for r in records}) == 1
(E/'footprint-tiles.json').write_text(json.dumps(dict(schema=1,sourceURL=URL,searchHintsOnly={'inami':[134.913384,34.748627],'kashiwara':[135.628642,34.579315]},hintSource='data/evidence/issue7/kinki-west/inventory.json; p05Candidates 稲美2129 / 柏原1610。概略探索用のみ。',rows=rows),ensure_ascii=False,indent=2)+'\n')
print(len(rows),'tiles')
