from research import *
q={'11':['https://www.city.tsuchiura.lg.jp/suigotennis-court/page001070.html'],'16':['https://www.city.ishioka.lg.jp/map.php?type=0'],'39':['https://www.city.sakuragawa.lg.jp/map.php?type=0'],'97':['https://www.town.yoshioka.lg.jp/chousei/access/map.html'],'105':['https://www.town.ora.gunma.jp/map/index.html']}
extra=json.load(open(ROOT/'extra-queue.json'))
for i,us in q.items():
 extra.setdefault(i,[])
 for u in us:
  if u not in extra[i]:extra[i].append(u)
  m=fetch(u);d=inspect(m)
  print(i,u,d['status']);print('NUM',d['numeric'][:10]);print('LINK',[(a['label'],a['url']) for a in d['links'] if re.search('タワー|テニス|map.php|役場',a['label']+' '+a['url'])][:20])
dump('extra-queue.json',extra)
for i in [34,55,56,63,71,76,89,93]:
 for u in extra.get(str(i),[])+([f'https://www.city.naka.lg.jp/map.php?code=42'] if i==34 else []):
  if u in cache:
   d=inspect(cache[u]);print(i,u,'\n',d['numeric'][:16])
