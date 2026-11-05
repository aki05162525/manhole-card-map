from research import *
j=read(ROOT/'jobs.json');e=read(ROOT/'extra.json');out={}
for p in P:
 out[str(p['index'])]=[]
 for u in dict.fromkeys(p['urls']+j.get(str(p['index']),[])+e.get(str(p['index']),[])):
  for t,v in links(u):
   if any(w in v for w in ['goo.gl/maps/','maps.app.goo.gl/']):out[str(p['index'])].append({'url':v,'from':u,'text':t})
write(ROOT/'map-links.json',out)
us=list(dict.fromkeys(r['url'] for rs in out.values() for r in rs))
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
 for r in ex.map(fetch,us):write(ROOT/'manifest.json',new);print(r['url'],r.get('status'),urllib.parse.unquote(r.get('finalUrl','')),flush=True)
