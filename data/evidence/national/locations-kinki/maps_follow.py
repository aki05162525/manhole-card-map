import research as r
idx=r.json.load(open(r.ROOT/'research-index.json'));found=[]
for i,x in enumerate(idx):
 for u in dict.fromkeys(x['sourceUrls']+[a['url'] for a in x['links']+x.get('followLinks',[])]):
  m=r.cache.get(u)
  if not m:continue
  for label,v in r.links(m):
   if r.re.search(r'https?://(?:maps.app.goo.gl/|goo.gl/maps/)',v):found.append({'facilityIndex':i,'sourceUrl':u,'label':label,'url':v})
r.save(r.ROOT/'map-links.json',found)
urls=sorted({a['url'] for a in found});print(len(urls),flush=True)
# Google is a single host; keep serialized pacing.
for u in urls:r.fetch(u)
r.save(r.ROOT/'manifest.json',r.fresh)
for u in urls:
 m=r.cache[u];print(u,m.get('status'),r.urllib.parse.unquote(m.get('finalUrl',''))[:1400])
