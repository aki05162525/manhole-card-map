from fetch import *
urls=['https://www.city.tomi.nagano.jp/category/soshikiitiran/101437.html','https://www.city.ueda.nagano.jp/soshiki/ttiiki/42264.html','https://www.city.ueda.nagano.jp/ssi/js/shisetsu-detail-googlemap.js','https://www.city.ueda.nagano.jp/soshiki/uedapr/132245.html','https://www.tomikan.jp/','https://www.sakukankou.jp/sightseeing/hotpark-asashina/','https://otsuki-kanko.info/category/content-page/view/2','https://www.city.saku.nagano.jp/kurashi/gesuido/gesuidojigyo/designmanhole/mannholkard.files/koiki.pdf']
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:rows=list(ex.map(fetch,urls))
dump(R/'fetch-focused.json',rows);print([(r['sourceUrl'],r['status']) for r in rows])
