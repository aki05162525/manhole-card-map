"""Record source retrievals and non-overlapping manual investigation intervals."""
import datetime
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, 'tools/national')
from research_common import fetch_cached

E = Path('data/evidence/kanto-prefecture/saitama/groups/north')
D = Path('data/work/kanto-prefecture/saitama/groups/north')

def read(name):
    p = E / name
    return json.loads(p.read_text()) if p.exists() else []

def write(name, data):
    (E / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

command = sys.argv[1]
if command in ('start', 'stop'):
    rows = read('timing.json')
    if command == 'start':
        assert not any('endedEpoch' not in row for row in rows)
        rows.append({'facilityId': sys.argv[2], 'startedEpoch': time.time(), 'scope': 'Manual source/geometry investigation wall-clock interval; parent coordination may intervene; not retroactively divided.'})
    else:
        assert rows and 'endedEpoch' not in rows[-1]
        rows[-1]['endedEpoch'] = time.time()
        rows[-1]['elapsedSeconds'] = rows[-1]['endedEpoch'] - rows[-1]['startedEpoch']
    write('timing.json', rows)
elif command == 'fetch':
    rows = read('retrievals.json')
    for url in sys.argv[3:]:
        raw, metadata = fetch_cached(url, D / 'cache', 'saitama-full-investigation')
        metadata['facilityId'] = sys.argv[2]
        rows.append(metadata)
        write('retrievals.json', rows)
        print(metadata['status'], url, metadata.get('rawPath'), flush=True)
