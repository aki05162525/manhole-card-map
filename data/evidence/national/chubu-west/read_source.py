import json,pathlib,re,sys
from bs4 import BeautifulSoup
from urllib.parse import urljoin
R=pathlib.Path('data/evidence/national/chubu-west');m=json.load(open(R/'manifest.json'))
for a in m:
 if a.get('status')!=200:continue
 if sys.argv[1] not in a['url']:continue
 s=BeautifulSoup(pathlib.Path(a['snapshotPath']).read_bytes(),'html.parser');print('\nURL',a['url'])
 if len(sys.argv)>2 and sys.argv[2]=='links':
  for e in s.select('a[href],iframe[src]'):
   h=e.get('href',e.get('src',''));t=e.get_text(' ',strip=True)
   if re.search(r'マンホール|アクセス|地図|交通|maps|map\?|緯度|経度',t+h,re.I):print(t,urljoin(a['finalUrl'],h))
 else:
  for z in s(['script','style','nav','footer','header']):z.decompose()
  main=s.select_one('#main-content,#main_body,#main,main,#content');print((main or s).get_text('\n',strip=True))
