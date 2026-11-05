import runpy,json
m=runpy.run_path('data/evidence/issue7/hokuriku/fetch.py')
urls=['https://www.city.fukui.lg.jp/kurasi/suido/youkoso/jyougesuidoukyoku.html', 'https://www.city.shibata.lg.jp/about/index.html', 'https://www.city.nagaoka.niigata.jp/kurashi/cate13/s-center/', 'https://www.city.shibata.lg.jp/about/1005541.html']
r=[m['fetch']((u,[]))for u in urls]
(m['B']/'final-fetches.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
