from research import *
U={9:['https://www.city.funabashi.lg.jp/shisetsu/shiyakusho/shiyakusho/0001/0001/p011000.html'],12:['https://maruchiba.jp/spot/detail_10427.html'],16:['https://wwwp.pref.chiba.lg.jp/pbbfmap/facility/1658'],19:['https://www.chiba-muse.or.jp/SEKIYADO/'],28:['https://www.city.abiko.chiba.jp/kouko/siteibunkazai/inoueke.html','https://maruchiba.jp/spot/detail_10469.html'],29:['https://www.abikoinfo.jp/user-guide/'],42:['https://www.fuwarishibayama.com/share/js/map.js'],43:['https://www.vill.chosei.chiba.jp/map/map1/map2.html']}
p=ROOT/'targets.json';d=json.load(open(p));
for k,v in U.items():d[str(k)]=d.get(str(k),[])+v
p.write_text(json.dumps(d,ensure_ascii=False,indent=2))
for i,us in U.items():
 print('FACILITY',i,P[i]['name'],flush=True)
 for u in us:inspect(u)
