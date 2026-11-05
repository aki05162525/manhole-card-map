# Reuse fetch routine without rerunning the original batch.
import pathlib,json
p=pathlib.Path(__file__).with_name('research.py');ns={};exec(p.read_text().split('with concurrent.futures.ThreadPoolExecutor')[0],ns)
base=ns['BASE'];m=json.loads((base/'manifest.json').read_text());done={x['url'] for x in m}
for u in ['https://www.city.ayase.kanagawa.jp/soshiki/kanzaikeiyakuka/kanzaitanto/3/4714.html','https://www.nijinogesuidoukan.jp/news/2922/','https://www.city.adachi.tokyo.jp/s-shinko/designmanhole.html','https://www.adachikanko.net/news/archives/56626']:
 if u not in done:m.append(ns['fetch'](u))
(base/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print([(x['url'],x.get('status')) for x in m[-4:]])
