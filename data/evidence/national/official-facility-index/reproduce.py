#!/usr/bin/env python3
"""Fetch missing captured public sources, then replay against frozen input bytes."""
import json,subprocess,sys
from fetch import E,ROOT,fetch
for p in sorted(E.glob('*.source.json')):
    m=json.loads(p.read_text())
    if m.get('status')!=200:continue # Do not retry denial/TLS failure.
    fetch(m['url'],p.name.removesuffix('.source.json'),m['path'].startswith('data/work/'))
subprocess.run([sys.executable,str(E/'build.py'),'--frozen'],check=True)
subprocess.run([sys.executable,str(E/'approve.py')],check=True)
subprocess.run([sys.executable,str(E/'test_index.py')],check=True)
