from research import *
U={23:['https://www.city.narashino.lg.jp/kigyoukyoku/jigyosha/26529.html'],25:['https://www.city.kashiwa.lg.jp/documents/3436/chousyaannaizu.pdf'],34:['https://www.city.sodegaura.lg.jp/uploaded/attachment/44755.pdf'],35:['https://www2.wagmap.jp/sodegaura/Portal'],38:['https://www.city.shiroi.chiba.jp/material/files/group/22/R8tyousya_huroamappu.pdf']}
p=ROOT/'targets.json';d=json.load(open(p))
for i,us in U.items():
 d[str(i)]=list(dict.fromkeys(d.get(str(i),[])+us))
 for u in us:print(fetch(u))
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
