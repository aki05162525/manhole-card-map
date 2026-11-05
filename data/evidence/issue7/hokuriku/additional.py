import runpy,json,concurrent.futures
from pathlib import Path
m=runpy.run_path('data/evidence/issue7/hokuriku/fetch.py');fetch=m['fetch'];B=m['B']
urls=[
'https://www.town.noto.lg.jp/kakuka/1012/gyomu/kyouikufront/syokannshisetsu/syougaigakusyuushisetsu/4876.html',
'https://www.city.shibata.lg.jp/shisetsu/kanko/kanko/index.html',
'https://www.city.kahoku.lg.jp/006/612/613/d002017_d/fil/kahoku_169_53.pdf',
'https://www.city.sado.niigata.jp/uploaded/attachment/51975.pdf',
'https://www.ikunesu-shibata.jp/faq.html',
'https://www.city.murakami.lg.jp/site/kouminkan/arakawa-chiku.html',
'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-v3_0.html',
'https://nlftp.mlit.go.jp/ksj/other/agreement.html']
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:r=list(ex.map(fetch,[(u,[])for u in urls]))
(B/'additional-fetches.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print([(x['sourceUrl'],x.get('snapshotPath',x.get('error')))for x in r])
