import research as r
from pathlib import Path
import json,concurrent.futures
urls=['https://www.city.niigata.lg.jp/kurashi/jyogesuido/gesui/oshirase/mhcard.html','https://www.pref.niigata.lg.jp/site/gesuido/1356925736758.html','https://www.pref.ishikawa.lg.jp/seikatsuhaisui/gesui/manholekard.html','https://www.town.noto.lg.jp/kakuka/1006/gyomu/1/1/1528.html']
for m in r.manifest:
 if m.get('status')!=200 or 'snapshotPath' not in m:continue
 p=r.parse(Path(m['snapshotPath']).read_bytes())
 if any(x in m['url'] for x in ['sado.niigata.jp/soshiki/2021/53417','pref.nagano.lg.jp/azuminoryuiki/index','city.tainai.niigata.jp/sangyo/kanko/manhole2']):
  urls += [r.urllib.parse.urljoin(m['url'],u) for u in p.links if any(v in u for v in ['soshiki/2021/','manhole','manhoru']) and 'gk-p' not in u]
urls=list(dict.fromkeys(urls))
(r.ROOT/'extra-urls.json').write_text(json.dumps(urls,indent=2)+'\n')
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
 for m in ex.map(r.fetch,urls):print(m.get('status','ERR'),m['url'],flush=True)
