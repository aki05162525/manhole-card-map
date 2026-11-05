from research import *
import sys
m=json.load(open(MAN));cs=[c for c in json.load(open('data/work/national-input/full.json'))['cards'] if c['id'][:2] in sys.argv[1:]]
urls={u for c in cs for u in c.get('links') or []}
for n,e in enumerate(m):
 if e['url'] not in urls:continue
 print('\nPAGE',n,e['url'],e.get('status',e.get('error')))
 if e.get('status')!=200:continue
 t=plain(Path(e['snapshotPath']).read_bytes());a=t.splitlines()
 # Last card-heading occurrence before actual distribution content, avoid navigation header.
 starts=[i for i,l in enumerate(a) if any(w in l for w in ['配布場所','配布時間','配布日時','配布状況','在庫状況','配布窓口'])]
 if not starts:print('NO DISTRIBUTION SECTION');continue
 selected=set()
 for i in starts:
  for j in range(max(0,i-4),min(len(a),i+36)):selected.add(j)
 print('\n'.join(f'{i}: {a[i]}' for i in sorted(selected))[:14000])
