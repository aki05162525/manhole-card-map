from research import *
U={5:['https://www.city.ichikawa.lg.jp/uploaded/attachment/53042.csv'],19:['https://www.chiba-muse.or.jp/SEKIYADO/visit/page-1519065141259/'],26:['https://www.kankou-kashiwa.jp/about/'],11:['https://tateyamacity.com/access']}
p=ROOT/'targets.json';d=json.load(open(p));
for k,v in U.items():d[str(k)]=d.get(str(k),[])+v
p.write_text(json.dumps(d,ensure_ascii=False,indent=2))
for i,us in U.items():
 print('FACILITY',i,P[i]['name'],flush=True)
 for u in us:inspect(u)
