from research import *
U={5:['https://www.city.ichikawa.lg.jp/page/2304.html'],6:['https://www.city.ichikawa.lg.jp/site/zoo/7829.html','https://www.city.ichikawa.lg.jp/site/zoo/6709.html'],9:['https://www.city.funabashi.lg.jp/shisetsu/shiyakusho/shiyakusho/0001/index.html'],10:['https://mitsui-shopping-park.com/lalat-tokyobay/access/'],11:['https://tateyamacity.com/'],12:['https://www.city.tateyama.chiba.jp/gesui/page100037.html'],15:['https://www.city.matsudo.chiba.jp/matumado/h29/kankoannaijo.html','https://www.matsudo-kankou.jp/'],19:['https://www.city.noda.chiba.jp/kanko/1021220/1021276/1021279.html'],20:['https://www.city.sakura.lg.jp/section/museum/access.html'],21:['https://www.city.sakura.lg.jp/tourism/2/15396.html'],22:['https://minorinosato-togane.com/accessmap','https://maruchiba.jp/corporate/material/detail_10257.html'],23:['https://www.city.narashino.lg.jp/kigyoukyoku/about/kigyoukyokuaccess.html']}
p=ROOT/'targets.json';d=json.load(open(p));d.update(U);p.write_text(json.dumps(d,ensure_ascii=False,indent=2))
for i,us in U.items():
 print('FACILITY',i,P[i]['name'],flush=True)
 for u in us:inspect(u)
