import research as r
for m in r.cache.values():
 if m.get('status')!=200 or 'html' not in m.get('contentType',''):continue
 s=r.soup(m);hits=[]
 for el in s.find_all('script'):
  t=el.get_text()
  if r.re.search(r'LatLng|latitude|geoLatitude|\.Marker|L.marker',t) and r.re.search(r'3[3456]\.\d{3}',t):hits.append(t[:13000])
 if hits:print('\nURL',m['url'],'\n','\n'.join(hits))
