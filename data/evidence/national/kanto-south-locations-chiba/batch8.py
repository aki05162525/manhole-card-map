from research import *
U={4:['https://maruchiba.jp/feature/detail_89.html'],5:['https://www.city.ichikawa.lg.jp/uploaded/attachment/3513.pdf'],13:['https://tateyamacity.com/citycycle-rental'],30:['https://www.city.kamagaya.chiba.jp/web/Gmaps/js/localmap.js']}
p=ROOT/'targets.json';d=json.load(open(p));
for k,v in U.items():d[str(k)]=d.get(str(k),[])+v
p.write_text(json.dumps(d,ensure_ascii=False,indent=2))
for i,us in U.items():
 print('FACILITY',i,flush=True)
 for u in us:
  if u.endswith('.pdf'):print(fetch(u))
  else:inspect(u)
