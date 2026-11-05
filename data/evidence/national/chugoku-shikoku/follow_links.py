from research import *
import re
urls=[]
for r in list(manifest):
 if r.get('status')!=200:continue
 p=pathlib.Path(r['snapshotPath'])
 if p.suffix!='.html':continue
 b=p.read_bytes();s=BeautifulSoup(b,'html.parser')
 for a in s.find_all('a',href=True):
  if re.search('マンホールカード|マンホール.*配布|配布.*マンホール',a.get_text()):
   u=urllib.parse.urljoin(r['finalUrl'],a['href'])
   if urllib.parse.urlsplit(u).netloc==urllib.parse.urlsplit(r['finalUrl']).netloc and u not in cache:urls.append(u)
urls=list(dict.fromkeys(urls));(ROOT/'follow-urls.json').write_text(json.dumps(urls,ensure_ascii=False,indent=2));print(len(urls))
