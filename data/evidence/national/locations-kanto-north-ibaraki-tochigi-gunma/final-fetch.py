from research import *
e=json.load(open(ROOT/'extra-queue.json'))
q={6:['https://www.city.tsuchiura.lg.jp/map.php?code=869','https://www.city.tsuchiura.lg.jp/map.php?code=42'],10:['https://www.city.tsuchiura.lg.jp/tsuchiura-kijo-plaza/page001099.html'],11:['https://www.city.tsuchiura.lg.jp/map.php?code=204'],105:['https://www.town.ora.gunma.jp/map/030/030/20180901155000.html']}
for i,us in q.items():
 for u in us:
  e.setdefault(str(i),[])
  if u not in e[str(i)]:e[str(i)].append(u)
  m=fetch(u);d=inspect(m);print(i,u,d['status'],d['numeric'][:3]);print([a for a in d['links'] if 'map.php' in a['url']])
dump('extra-queue.json',e)
