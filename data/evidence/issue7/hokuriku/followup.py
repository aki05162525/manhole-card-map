import runpy,json,concurrent.futures
m=runpy.run_path('data/evidence/issue7/hokuriku/fetch.py');fetch=m['fetch'];B=m['B']
urls=['https://www.city.shibata.lg.jp/shisetsu/kanko/kanko/1022382.html','https://www.city.murakami.lg.jp/soshiki/90/arakawakouminnkann.html','https://www.city.sado.niigata.jp/uploaded/attachment/56203.pdf','https://www.city.sado.niigata.jp/soshiki/2028/55001.html','https://www.city.kahoku.lg.jp/soshiki/400000/400300/index.html']
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:r=list(ex.map(fetch,[(u,[])for u in urls]))
(B/'followup-fetches.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print([(x['sourceUrl'],x.get('snapshotPath',x.get('error')))for x in r])
