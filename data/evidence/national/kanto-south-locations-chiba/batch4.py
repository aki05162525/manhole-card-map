from research import *
U={3:['https://wwwp.pref.chiba.lg.jp/pbbfmap/facility/4088'],15:['https://www.matsudo-kankou.jp/access/'],29:['https://www.abikoinfo.jp/'],34:['https://www.city.sodegaura.lg.jp/soshiki/gesui/gesuitaisakuka-jimusitu-shuumatushorijyo.html'],40:['https://www.city.oamishirasato.lg.jp/0000005447.html'],41:['https://www.town.shibayama.lg.jp/0000001426.html'],42:['https://www.fuwarishibayama.com/access/index.html'],44:['http://www.chosei-bunkahall.jp/'],46:['https://chosei-koryu.com/']}
p=ROOT/'targets.json';d=json.load(open(p));
for k,v in U.items():d[str(k)]=d.get(str(k),[])+v
p.write_text(json.dumps(d,ensure_ascii=False,indent=2))
for i,us in U.items():
 print('FACILITY',i,P[i]['name'],flush=True)
 for u in us:inspect(u)
# Fetch embedded markers only, never use viewport pairs.
for m in list(M):
 if m.get('status')!=200 or 'google' in m['url']:continue
 for frame in soup(m).find_all('iframe',src=True):
  u=frame['src']
  if 'google.com/maps/embed?pb=' in u and '!1s0x' in u:
   r=fetch(u);r['embeddedBy']=m['url'];save()
   print('EMBED',m['url'],r.get('status'),flush=True)
