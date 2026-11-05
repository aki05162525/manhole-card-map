from fetch import *
old=json.loads(Path('data/national/location-updates/chubu-east-south.json').read_text())
links={}
for r in old['unresolved']:
 if r['facilityId'] in ids:
  links[r['facilityId']]=[a['url'] for a in r['attempts'] if 'HTTP 200' in a['result']]
extra=['https://www.city.ueda.nagano.jp/soshiki/ttiiki/127168.html','https://www.city.ueda.nagano.jp/map/13805.html','https://db.go-nagano.net/topics_detail6/id%3D3402','https://www.city.tsuru.yamanashi.jp/contact/jyogesuido/index.html','https://www.city.tomi.nagano.jp/category/soshiki/101437.html','https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-v3_0.html','https://nlftp.mlit.go.jp/ksj/other/agreement.html']
urls=list(dict.fromkeys([u for a in links.values() for u in a]+extra))
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:rows=list(ex.map(fetch,urls))
dump(R/'additional-links.json',links);dump(R/'fetch-additional.json',rows);print([(r['sourceUrl'],r['status']) for r in rows])
