import json,pathlib,re,urllib.parse
from bs4 import BeautifulSoup
R=pathlib.Path('data/evidence/national/chubu-west');m=json.load(open(R/'manifest.json'));found=[]
for a in m:
 if a.get('status')!=200:continue
 s=BeautifulSoup(pathlib.Path(a['snapshotPath']).read_bytes(),'html.parser')
 for e in s.select('a[href]'):
  t=e.get_text(' ',strip=True);u=urllib.parse.urljoin(a['finalUrl'],e['href']).split('#')[0]
  if not re.search('マンホールカード|交通アクセス|アクセスマップ|交通案内',t):continue
  if urllib.parse.urlparse(u).hostname!=urllib.parse.urlparse(a['finalUrl']).hostname:continue
  if u in {b['url'] for b in m} or u in {b['finalUrl'] for b in m if 'finalUrl' in b}:continue
  if not u.startswith('http') or re.search(r'\.(pdf|jpg|png)$',u):continue
  found.append({'url':u,'from':a['url'],'label':t})
(R/'follow-links.json').write_text(json.dumps(found,ensure_ascii=False,indent=2))
print('\n'.join(sorted({a['url'] for a in found})))
