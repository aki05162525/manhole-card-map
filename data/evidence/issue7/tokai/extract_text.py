from research import *
import html
records=read(OUT/'fetch-records.json')
def plain(s):
 s=re.sub(r'<(script|style)\b[^>]*>.*?</\1>','',s,flags=re.S|re.I)
 return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',s)))
for i,id in enumerate(ids):
 print('\n',i,places[id]['name'])
 for r in records:
  if id not in r['facilityIds']:continue
  print(r['url'],r.get('status',r.get('error')))
  if 'snapshotPath' not in r:continue
  s=pathlib.Path(r['snapshotPath']).read_text(errors='replace');t=plain(s)
  if 'gk-p.jp' not in r['url']:
   matches=list(re.finditer(r'(?:配布場所|配付場所|配布先|所在地|所在地図|北口警備|分庁舎|緯度|longitude|latitude|new google.maps.Marker|new GLatLng|new google.maps.LatLng)',t))
   print(' / '.join(t[max(0,m.start()-25):m.end()+170] for m in matches[:4]))
   nums=re.findall(r'.{0,100}(?:3[45]\.\d{4,}|13[6789]\.\d{4,}).{0,150}',s)
   print('NUM',str(nums[:5])[:1200])
