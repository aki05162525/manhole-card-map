import json,pathlib,re
import html
D=pathlib.Path('data/evidence/issue7/kinki-west');rs=json.load(open(D/'inventory.json')); logs={r['url']:r for r in json.load(open(D/'fetch-log.json'))}
out=[]
for r in rs:
 out.append('\n### '+r['facilityId']+' '+r['name']+' '+r['address'])
 for u in r['fetchUrls']:
  l=logs[u];out.append(u)
  if 'path' not in l:out.append(str(l.get('error')));continue
  b=pathlib.Path(l['path']).read_bytes();raw=b.decode('utf-8',errors='replace');txt=html.unescape(re.sub('<[^>]+>',' ',raw));txt=re.sub(r'\s+',' ',txt)
  # strip navigation by extracting around substantive terms
  chunks=[]
  for pat in ['配布場所','配布場所・','所在地','住所','新庁舎','別館','移転','休館']:
   for m in list(re.finditer(pat,txt))[:5]:chunks.append(txt[max(0,m.start()-40):m.start()+200])
  out.append(' | '.join(dict.fromkeys(chunks)))
  hits=[]
  for pat in [r'.{0,100}(?:markerInfos|L\.marker|new google.maps.Marker|google.maps.LatLng|latitude|longitude|!3d|[?&]q=\d|latlng).{0,300}']:
   hits+=re.findall(pat,raw,re.I)
  out+=hits[:12]
(D/'inspection.txt').write_text('\n'.join(out))
