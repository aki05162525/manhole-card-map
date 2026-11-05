from research import *
q=json.load(open(ROOT/'extra-queue.json'));out={}
for k,us in q.items():
 for u in us:
  if u not in cache:continue
  d=inspect(cache[u]);links=[a for a in d['links'] if re.search(r'map\.php|maps|地図|アクセス|access|\.csv',a['url']+' '+a['label'],re.I)]
  print(k,targets[int(k)]['name'],u,'\n',json.dumps(links,ensure_ascii=False))
  print('NUM', '\n'.join(dict.fromkeys(d['numeric']))[:2200])
  for a in links:
   if 'map.php?code=' in a['url']:out.setdefault(k,[]).append(a['url'])
dump('map-queue.json',out)
