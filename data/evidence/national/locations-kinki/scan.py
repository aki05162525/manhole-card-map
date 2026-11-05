import research as r
out=[]
for m in r.cache.values():
 s=r.soup(m)
 if s is None:continue
 for el in s.select('a[href],iframe[src]'):
  u=r.urllib.parse.unquote(el.get('href',el.get('src','')))
  pts=r.re.findall(r'!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)',u)+r.re.findall(r'[?&](?:q|query|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)',u)
  # Embed viewport centers are deliberately excluded; these are NOT marker coordinates.
  if pts:out.append({'url':m['url'],'coordinates':pts,'label':el.get_text(' ',strip=True),'context':el.parent.get_text(' ',strip=True)[:500],'mapUrl':u,'title':s.title.get_text() if s.title else ''})
r.save(r.ROOT/'candidates.json',out)
for i,a in enumerate(out):print(i,a['url'],a['coordinates'],a['label'],a['title'],a['context'][:100])
