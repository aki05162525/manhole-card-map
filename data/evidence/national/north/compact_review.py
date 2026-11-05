import json,sys,re
from collect import ROOT,CARDS,D
from read_sources import text
m={r['url']:r for r in json.load(open(ROOT/'manifest.json'))};seen=set();pref=sys.argv[1]
for c in CARDS:
 if not c['id'].startswith(pref):continue
 print('\nCARD',c['id'],c['city'],'PLACES',' | '.join(c['placeText'] or []),'HOURS',' | '.join(c['hours'] or []))
 for u in c['links'] or []:
  r=m.get(u,{});s=text(r)
  print('URL',u,'HTTP',r.get('status',r.get('error')))
  if u in seen: print('(reviewed above)');continue
  seen.add(u)
  if 'ここから本文です。' in s:s=s.split('ここから本文です。',1)[1]
  if 'マンホールカード' not in s:print('no card text');continue
  lines=s.splitlines();keep=set()
  for i,l in enumerate(lines):
   if re.search('配布場所|配布時間|在庫|配布を|配布は|配布し|配布して|配布終了|配布休止|配布再開|休館|休業',l): keep.update(range(max(0,i-1),min(len(lines),i+8)))
  print('\n'.join(lines[i] for i in sorted(keep))[:6500])
