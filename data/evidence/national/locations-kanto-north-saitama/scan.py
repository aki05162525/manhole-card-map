from research import *
a=json.load(open('data/national/regions/kanto-north.json'))
for i,p in enumerate(TARGETS):
 print('\nTARGET',i,p['name'])
 us=sorted({u for c in a['cards'] for r in c.get('relations',[]) if r.get('facilityId')==p['id'] for u in r.get('sourceUrls',[])})
 for u in us:
  if u not in CACHE: continue
  m=fetch(u);s=content(m);soup=BeautifulSoup(s,'html.parser')
  print('URL',u)
  print('MAP', '\n'.join(re.findall(r'.{0,70}(?:[Mm]arker|[Ll]atitude|[Ll]ongitude|[Ll]at[Ll]ng|destination|!3d|!2d|maps\?|maps/embed).{0,200}',s))[:5000])
  links=[(x.get_text(' ',strip=True),urllib.parse.urljoin(m.get('finalUrl',u),x.get('href',''))) for x in soup.select('a[href]') if re.search('アクセス|交通|所在地|地図|案内所|本庁舎|水循環|浄化センター|施設紹介',x.get_text())]
  print('LINKS',links[:30])
