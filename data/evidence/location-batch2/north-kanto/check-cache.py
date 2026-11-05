"""Exercise cached range reuse and rejection without network writes."""
import runpy
from pathlib import Path
from unittest.mock import patch
s = runpy.run_path('data/evidence/location-batch2/north-kanto/vector-scan.py',run_name='cache_test')
f = s['get_bytes']; g = f.__globals__; record = g['records'][0]
offset,length = map(int,Path(record['path']).stem.split('-')[1:])
with patch('urllib.request.urlopen',side_effect=AssertionError('cache must not fetch')):
    assert f(offset,length) == Path(record['path']).read_bytes()
    original = g['records']; g['records'] = []
    try:
        f(offset,length)
        raise RuntimeError('missing provenance accepted')
    except AssertionError as e:
        assert 'provenance' in str(e)
    finally: g['records'] = original
    changed = [dict(r) for r in original]; changed[0]['sha256'] = '0'*64; g['records'] = changed
    try:
        f(offset,length)
        raise RuntimeError('hash mismatch accepted')
    except AssertionError as e:
        assert 'hash mismatch' in str(e)
    finally: g['records'] = original
print('PASS: cached reuse; missing provenance rejected; bad hash rejected; no network')
