from research import *
import sys
m=json.load(open(MAN))
for v in sys.argv[1:]:
 i=int(v);e=m[i];print('\nPAGE',i,e['url'],e.get('status'))
 if e.get('status')==200:
  s=plain(Path(e['snapshotPath']).read_bytes());a=s.splitlines();ix=[j for j,l in enumerate(a) if any(w in l for w in ['配布','在庫','配付'])];sel=set()
  for j in ix:
   for k in range(max(0,j-2),min(len(a),j+14)):sel.add(k)
  print('\n'.join(f'{k}: {a[k]}' for k in sorted(sel))[:10000])
