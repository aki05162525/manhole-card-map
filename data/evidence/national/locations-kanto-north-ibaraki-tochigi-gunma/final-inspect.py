from research import *
for u,terms in [('https://www.city.ishioka.lg.jp/map.php?type=0',['まち蔵']),('https://www.city.sakuragawa.lg.jp/map.php?type=0',['真壁庁舎','大和庁舎']),('https://www.town.ora.gunma.jp/map/index.html',['タワー']),('https://www.city.naka.lg.jp/map.php?code=42',['L.marker','曲がり屋']),('https://www.pref.ibaraki.jp/doboku/gesui/kikaku/manholecard/aquaworld_manholecard.html',['3d36.','配布場所']),('https://www.gunma-fc.jp/location/yoshioka-town-cultural-center/',['markerData','markerLatLng'])]:
 print('\nURL',u)
 s=read(cache[u])
 for term in terms:
  for m in list(re.finditer(re.escape(term),s))[-4:]:print(s[max(0,m.start()-230):m.end()+300])
