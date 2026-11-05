import research as r
from concurrent.futures import ThreadPoolExecutor
jobs={
'https://www.town.higashisonogi.lg.jp/gyoseijoho/annai/783.html':['kyushu-4c93c76776a06838fe00'],
'https://www.city.nakama.lg.jp/soshiki/26/':['kyushu-e7eae1c92a37ac5f0745'],
'https://www.city.minamisatsuma.lg.jp/shisetsu/':['ws-a33e80c6dd86bf6e7f'],
'https://www.city-kirishima.jp/soumu/shise/annai/choshaannai/201704kokubu.html':['kyushu-a7f2c9a57f74387fbabb'],
'https://www.city.ogori.fukuoka.jp/1139/1145/4453':['kyushu-e6d46c885e30b1c754cb'],
'https://www.tokunoshima-town.org/kensetsuka/documents/sintyousya.pdf':['kyushu-7a9f8dae19665147953f','ws-61c944585418f01447'],
'https://www.sagabai.com/balloon-museum/main/9.html':['kyushu-a4ba2e23eab057c818dc'],
'https://www.city.koga.fukuoka.jp/floor/':['kyushu-36b4ad8b697e9a275512'],
'https://cototoba.com/floor/':['kyushu-3be846e318561ee431e9','kyushu-3c3902d19243e599e3c4'],
'https://mitinoeki-ginoza.com/area/facility/':['kyushu-4aca915a11bca836ac11'],
'https://www.town.china.lg.jp/soshiki/1001/12/2709.html':['ws-f5ea517afaab927bb9'],
'https://www.city.onojo.fukuoka.jp/list00249.html':['ws-6ba1bca2e1474a7cd2','ws-c42fbe5f44427d0284'],
'https://www.katsuren-jo.jp/access/':['kyushu-5adca0ddeb2263d545e6'],
'https://www.oishiimati-oita.jp/access':['kyushu-e401ae7935c2f856b758','kyushu-f4947f3eb4091dab6430'],
}
with ThreadPoolExecutor(max_workers=4) as ex:rows=list(ex.map(r.fetch,[(u,[{'facilityId':'facility:'+i,'purpose':'additional-building-identification'} for i in ids]) for u,ids in jobs.items()]))
r.save(r.E/'followup-fetches.json',rows)
for x in rows:print(x['url'],x.get('status',x.get('error')))
