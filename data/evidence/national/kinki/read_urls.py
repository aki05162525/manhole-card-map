import json,pathlib,sys,re
from bs4 import BeautifulSoup
ms={m['url']:m for m in json.load(open('data/evidence/national/kinki/manifest.json'))}
for u in json.load(open(sys.argv[1])):
 m=ms.get(u,{});print('\nURL',u,m.get('status'),m.get('error',''))
 if not m.get('snapshotPath'):continue
 s=BeautifulSoup(pathlib.Path(m['snapshotPath']).read_bytes(),'html.parser');[a.decompose() for a in s(['script','style','nav','header','footer'])]
 main=s.select_one('#main_body,#tmp_contents,#main_text,.pagebody,article,main') or s
 t=re.sub(r'\s+',' ',main.get_text(' ',strip=True));p=t.find('マンホールカード');print(t[max(0,p-70):max(0,p)+14000])
