import research as r
from bs4 import BeautifulSoup
import urllib.parse,concurrent.futures,json
selectors=['katsushika','adachi','narashino','isleshinagawa','funabashi','aikawa','tama','gesui.metro','karigurashi']
urls={}
for m in r.manifest:
 if m.get('status')!=200 or not any(s in m['url'] for s in selectors):continue
 soup=BeautifulSoup(r.pathlib.Path(m['snapshotPath']).read_bytes(),'html.parser')
 for a in soup.find_all('a',href=True):
  u=urllib.parse.urljoin(m.get('finalUrl',m['url']),a['href']).split('#')[0]
  if ('マンホールカード' in a.get_text() or 'manhole' in u) and u not in r.done and 'gk-p.jp' not in u and u.startswith('http') and not u.endswith('.pdf'):
   urls[u]=a.get_text(' ',strip=True)
for u in urls:r.locks.setdefault(urllib.parse.urlsplit(u).netloc,r.threading.Lock())
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
 for m in ex.map(r.fetch,urls):
  m['discoveredAnchor']=urls[m['url']];r.manifest.append(m);(r.ROOT/'manifest.json').write_text(json.dumps(r.manifest,ensure_ascii=False,indent=2));print(m['url'],m.get('status',m.get('error')),flush=True)
