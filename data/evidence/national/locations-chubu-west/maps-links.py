from research import *
res=[]
for m in list({m['url']:m for m in cache.values()}.values()):
 s=soup(m)
 if not s:continue
 for a in s.select('a[href]'):
  u=a['href']
  if re.search(r'maps\.app\.goo\.gl|goo\.gl/maps|maps\.google|google\.(?:co\.jp|com)/maps',u):
   res.append({'source':m['url'],'url':u,'label':a.get_text(' ',strip=True)})
(ROOT/'map-links.json').write_text(json.dumps(res,ensure_ascii=False,indent=2))
for x in res:
 if re.search(r'maps\.app\.goo\.gl|goo\.gl/maps',x['url']):print(x)
batch([x['url'] for x in res if re.search(r'maps\.app\.goo\.gl|goo\.gl/maps',x['url'])])
