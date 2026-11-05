from research import *
d=json.load(open('data/work/national-input/full.json'));m={e['url']:e for e in json.load(open(MAN))}
import sys
for c in d['cards']:
 if c['id'][:2] not in sys.argv[1:]:continue
 print('\n###',c['id'],c['city'])
 for u in dict.fromkeys(c.get('links') or []):
  e=m.get(u,{});print('URL',u,e.get('status',e.get('error','not fetched')))
  if e.get('status')!=200:continue
  t=plain(Path(e['snapshotPath']).read_bytes());lines=t.splitlines();inds=[i for i,l in enumerate(lines) if 'マンホールカード' in l or '配布場所' in l or '配布時間' in l or '在庫' in l]
  selected=set()
  for i in inds:
   for j in range(max(0,i-2),min(len(lines),i+28)):selected.add(j)
  print('\n'.join(f'{i}: {lines[i]}' for i in sorted(selected))[:14500] if inds else '本文にカード記載なし（施設情報の照合対象）')
