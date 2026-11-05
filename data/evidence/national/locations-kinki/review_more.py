from research import *
from decisions import APPROVED
from urllib.parse import unquote
rs=json.load(open(ROOT/'research-index.json'))
for i,r in enumerate(rs):
 if i in APPROVED:continue
 urls=r['sourceUrls']+[x['url'] for x in r['links']+r.get('followLinks',[])]
 for u in dict.fromkeys(urls):
  m=cache.get(u,{});s=soup(m)
  if not s:continue
  found=[]
  for a in s.select('a[href],iframe[src]'):
   v=unquote(a.get('href',a.get('src','')))
   if re.search(r'!3d(3[3456]\.\d+)!4d(13[4567]\.\d+)|[?&](?:q|query|destination)=(3[3456]\.\d+),\s*(13[4567]\.\d+)',v):found.append((a.get_text(' ',strip=True),v))
  if found:
   print(i,r['name'],r['address'],u)
   for a in found:print(a)
