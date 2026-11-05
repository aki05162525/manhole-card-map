"""Apply exact review patches to a temporary copy; no shared file mutation."""
import json,pathlib,sys,copy
if len(sys.argv)!=2 or not sys.argv[1].startswith('/tmp/'):raise SystemExit('usage: integrate.py /tmp/unique-regional-ledger.json')
def read(p):return json.loads(pathlib.Path(p).read_text())
d=read('data/overrides/regions/kanto-north.json');patches=read('data/national/patches/kanto-north.json')
for p in patches['patches']:
 rows=d[p['section']];matches=[i for i,r in enumerate(rows) if r==p['old']]
 if len(matches)!=1:raise SystemExit('exact old mismatch: '+p['reason'])
 rows[matches[0]]=copy.deepcopy(p['new'])
pathlib.Path(sys.argv[1]).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print(sys.argv[1])
