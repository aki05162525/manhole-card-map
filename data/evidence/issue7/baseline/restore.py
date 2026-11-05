"""Restore frozen research inputs; never overwrite an existing destination."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, default=Path('data/work/issue7-baseline'))
args = parser.parse_args()
source = Path(__file__).resolve().parent
entries = json.loads((source / 'manifest.json').read_text())
validated = {}
for name, metadata in entries.items():
    assert Path(name).name == name
    data = gzip.decompress((source / (name + '.gz')).read_bytes())
    assert len(data) == metadata['bytes']
    assert hashlib.sha256(data).hexdigest() == metadata['sha256']
    validated[name] = data
args.out.mkdir(parents=True, exist_ok=False)
for name, data in validated.items():
    (args.out / name).write_bytes(data)
print(f'Restored {len(validated)} verified inputs to {args.out}')
