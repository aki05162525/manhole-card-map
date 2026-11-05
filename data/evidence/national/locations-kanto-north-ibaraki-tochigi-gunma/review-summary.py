from research import *
e=json.load(open(ROOT/'extra-queue.json')); disc=json.load(open(ROOT/'discovery-queue.json'))
for i,f in enumerate(targets):
 print('\n',i,f['name'],f['address'])
 us=list(dict.fromkeys(urls[f['id']]+e.get(str(i),[])))
 for u in us:
  if u not in cache:continue
  d=inspect(cache[u]);ls=[a for a in d['links'] if re.search('google.*map|maps.app|goo.gl|access|アクセス|map.php|地図|交通案内',a['url']+' '+a['label'],re.I)]
  print(u,d['status'],d['title'][:40]);print([(a['label'][:25],a['url'][:240]) for a in ls if 'api/js' not in a['url']][-8:])
