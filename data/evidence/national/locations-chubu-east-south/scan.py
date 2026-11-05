from research import *
urls=sorted({u for c in audit['cards'] if c['cardId'][:2] in ['19','20'] for u in c['sourceUrls']})
for u in urls:
 if u not in cache:continue
 e=cache[u];s=soup(e);raw=str(s)
 print('\nURL',u)
 for line in raw.splitlines():
  if re.search(r'(initlat|initlong|setMarkers|LatLng|latitude|longitude|[Mm]arker|lat[\"\x27]?\s*[:=])',line):print('COORD',line[:2500])
 for a in s.find_all('a',href=True):
  h=a['href'];t=a.get_text(' ',strip=True)
  if re.search('アクセス|交通案内|所在地|庁舎案内|施設案内|施設概要|周辺地図|交通アクセス|問い合わせ|お問合せ|地図を見る|access',h+' '+t,re.I):print('LINK',t,urllib.parse.urljoin(e.get('finalUrl',u),h))
