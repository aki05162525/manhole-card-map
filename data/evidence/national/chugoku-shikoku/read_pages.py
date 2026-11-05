from research import *
import sys,re
seen=set()
for c in CARDS:
 if c['id'][:2] not in sys.argv[1:]:continue
 print('\n###',c['id'],c['city']); print('INPUT',c['placeText'],c['hours'])
 for u in c['links'] or []:
  
  if u in seen:print('URL already read',u);continue
  seen.add(u)
  r=cache.get(u,{});p=pathlib.Path(r.get('snapshotPath','/none')).with_suffix('.txt')
  print('URL',u,'STATUS',r.get('status',r.get('error')))
  if p.exists():
   t=p.read_text();lines=t.splitlines();hits=[i for i,l in enumerate(lines) if re.search('配布|配付|在庫|休止|終了|マンホールカード',l)]; ix=set()
   for i in hits:
    ix.update(range(max(0,i-2),min(len(lines),i+12)))
   print('\n'.join(lines[i] for i in sorted(ix))[:14000])
