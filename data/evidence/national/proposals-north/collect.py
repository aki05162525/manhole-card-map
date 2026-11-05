#!/usr/bin/env python3
"""Reuse original cache; preserve new HTTP outcomes without bypasses."""
import sys,json,pathlib
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'north'))
import collect as base
base.ROOT=pathlib.Path('data/evidence/national/proposals-north')
p=base.ROOT/'manifest.json'
m=json.load(open(p)) if p.exists() else []
old=json.load(open('data/evidence/national/north/manifest.json'))
cache={r['url']:r for r in old+m}
for u in sys.argv[1:]:
 if u in cache:print('cached',u,cache[u].get('status'));continue
 r=base.fetch(u);m.append(r);cache[u]=r;p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');print(u,r.get('status',r.get('error')),flush=True)
