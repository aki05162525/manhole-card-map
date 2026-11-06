from fetch import *
d=json.loads((O/'raw/27-package.json').read_text())['result'];r=next(x for x in d['resources'] if x['url'].endswith('_17.zip'));print(r['name'],r['url'],flush=True)
jobs=[('27-photo17.zip',r['url']),('35-architect.html','https://www.kawabe-office.com/?category_part=6&id=787&page=topic_detail'),('35-town.html','https://www.town.yorii.saitama.jp/soshiki/13/')]
with concurrent.futures.ThreadPoolExecutor() as ex:rows=list(ex.map(fetch,jobs))
(O/'more-retrievals.json').write_text(json.dumps(rows,indent=2));print(rows)
