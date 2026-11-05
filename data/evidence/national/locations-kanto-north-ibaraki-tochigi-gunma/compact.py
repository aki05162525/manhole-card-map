from research import *
q=json.load(open(ROOT/'extra-queue.json'));disc=json.load(open(ROOT/'discovery-queue.json'))
for i,f in enumerate(targets):
 print('\n',i,f['name'])
 us=list(dict.fromkeys(urls[f['id']]+q.get(str(i),[])+list(disc.get(str(i),{}))))
 for u in us:
  if u not in cache:continue
  d=inspect(cache[u]);
  matches=[a for a in d['links'] if re.search(r'map.php|map_route.php|maps|map.js|gmap|\.csv|geojson',a['url'],re.I) and not re.search('googleapis|rwdImage|sitemap',a['url'])]
  if matches:print(u,'\n ',json.dumps(matches,ensure_ascii=False)[:1500])
