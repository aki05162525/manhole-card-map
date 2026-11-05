import json,pathlib,urllib.parse
from bs4 import BeautifulSoup
R=pathlib.Path('data/evidence/national/kinki'); ms=json.load(open(R/'manifest.json'));out=[]
for m in ms:
 if m.get('status')!=200 or 'html' not in m.get('contentType',''):continue
 if any(h in m['url'] for h in ['sakai','neyagawa','kasai','ashiya','kato.lg','harima','owgs','sayama','toin','yokkaichi','toyosato','ayabe','ninjakan','ujitawara']):
  s=BeautifulSoup(pathlib.Path(m['snapshotPath']).read_bytes(),'html.parser')
  for a in s.select('a[href]'):
   t=a.get_text(' ',strip=True);u=urllib.parse.urljoin(m.get('finalUrl',m['url']),a['href'])
   if any(w in t for w in ['マンホールカード','第8弾','第12弾','営業フロア','再開','移転']):
    print(m['url'],t,u);out.append(u)
(R/'follow-urls.json').write_text(json.dumps(sorted(set(out)),ensure_ascii=False,indent=2))
