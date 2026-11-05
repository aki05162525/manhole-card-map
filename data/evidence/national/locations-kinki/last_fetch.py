from research import *
rs=json.load(open(ROOT/'research-index.json'))
extra={125:['https://www.town.nose.osaka.jp/soshiki/soumuka/jinkensoumu/gaiyou/11263.html','https://www.town.nose.osaka.jp/soshiki/soumuka/jinkensoumu/chosei/10468.html'],143:['https://www.city.sumoto.lg.jp/map/10001.html'],144:['https://www.city.sumoto.lg.jp/map/10001.html'],142:['https://www.nishi.or.jp/bunka/kanko/jouhouhasshin/create_nishinomiya.html','https://mitsui-shopping-park.com/lalaport/koshien/shopguide/701517.html'],183:['https://www.kamikawa-navi.jp/guide/spot/780'],99:['https://www.city.kashiwara.lg.jp/docs/2022030100022/']}
for i,us in extra.items():
 for u in us:
  m=fetch(u);rs[i].setdefault('followLinks',[]).append({'url':u,'label':'個別施設アクセス追加調査','from':'公式検索'});s=soup(m)
  print(i,u,m.get('status'))
  if s:
   print('MAP',[(a.get_text(' ',strip=True),a.get('href',a.get('src'))) for a in s.select('a[href],iframe[src]') if re.search('maps|map\.html',a.get('href',a.get('src','')))])
   for sc in s.select('script'):
    if re.search('markerInfos|new google.maps.Marker|L.marker|the_spot',sc.text):print(sc.text[:4000])
save(ROOT/'research-index.json',rs)
