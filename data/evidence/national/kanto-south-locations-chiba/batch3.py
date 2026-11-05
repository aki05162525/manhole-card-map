from research import *
U={24:['https://www.city.narashino.lg.jp/soshiki/kankyohozen/gyomu/shisetu/koenshiseki/yatuhigatakoen.html','https://wwwp.pref.chiba.lg.jp/pbbfmap/facility/1893'],25:['https://www.city.kashiwa.lg.jp/somu/kashiwa_suido/suidobu/gaiyo/chosha.html'],26:['https://www.kankou-kashiwa.jp/'],27:['https://www.city.nagareyama.chiba.jp/institution/1028492/1021196.html'],31:['https://www.city.kamagaya.chiba.jp/sisetsu/kyoudoshiryokan/index.html'],42:['https://www.fuwarishibayama.com/'],43:['https://www.vill.chosei.chiba.jp/0000000397.html'],44:['https://www.vill.chosei.chiba.jp/category/3-5-0-0-0-0-0-0-0-0.html'],45:['https://wwwp.pref.chiba.lg.jp/pbbfmap/facility/2404'],46:['https://www.vill.chosei.chiba.jp/0000001539.html']}
p=ROOT/'targets.json';d=json.load(open(p));d.update(U);p.write_text(json.dumps(d,ensure_ascii=False,indent=2))
for i,us in U.items():
 print('FACILITY',i,P[i]['name'],flush=True)
 for u in us:inspect(u)
