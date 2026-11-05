from research import *
rs=json.load(open(ROOT/'research-index.json'))
for i,pattern in [(26,'real-ninjakan'),(64,'1164'),(99,'2019011500018'),(108,'Manhole'),(123,'1240'),(163,'1002872'),(191,'1391486590155'),(198,'/info/'),(199,'7689')]:
 r=rs[i];print('\nINDEX',i,r['name'])
 for u in dict.fromkeys(r['sourceUrls']+[x['url'] for x in r['links']+r.get('followLinks',[])]):
  if pattern not in u:continue
  s=soup(cache.get(u,{}))
  if not s:continue
  for t in s(['script','style','nav','header','footer']):t.decompose()
  st=s.get_text(' ',strip=True)
  print(u,st[-8500:])
