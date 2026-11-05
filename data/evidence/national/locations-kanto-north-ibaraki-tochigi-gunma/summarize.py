from research import *
for i,f in enumerate(targets):
 print('\n',i,f['name'])
 for u in dict.fromkeys(urls[f['id']]):
  if u not in cache:continue
  s=read(cache[u]);soup=BeautifulSoup(s,'html.parser'); hits=[]
  for a in soup.select('a[href],iframe[src]'):
   v=urllib.parse.unquote(a.get('href') or a.get('src',''))
   if re.search(r'!3d[\d.]+!4d|[?&](q|destination|query)=3[4567]\.\d',v):hits.append((a.get_text(' ',strip=True),v))
  for mt in re.finditer(r'(?:position\s*:\s*new google|latitude|longitude|geo.position|geo:lat|geo:long)',s):hits.append(('script',s[mt.start():mt.start()+240].replace('\n',' ')))
  if hits:print(u,json.dumps(hits,ensure_ascii=False))
