import research as r
from concurrent.futures import ThreadPoolExecutor
jobs={
'https://www.city.minamisatsuma.lg.jp/goshokai/gaiyo/e018900.html':['ws-a33e80c6dd86bf6e7f'],
'https://www.city.nakama.lg.jp/life/6/23/89/':['kyushu-e7eae1c92a37ac5f0745'],
'https://www.isahaya-kankou.com/hall':['kyushu-0457cc860e34e1f5a582'],
'https://www.city.onojo.fukuoka.jp/list01297.html':['ws-6ba1bca2e1474a7cd2','ws-c42fbe5f44427d0284'],
'https://kc-sks.jp/sougou/':['kyushu-015d01512ed3752919cd'],
}
with ThreadPoolExecutor(max_workers=4) as ex:rows=list(ex.map(r.fetch,[(u,[{'facilityId':'facility:'+i,'purpose':'additional-building-identification'} for i in ids]) for u,ids in jobs.items()]))
r.save(r.E/'extra-fetches.json',rows)
for x in rows:print(x['url'],x.get('status',x.get('error')))
