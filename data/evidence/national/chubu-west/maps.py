import json,pathlib,re
from bs4 import BeautifulSoup
R=pathlib.Path('data/evidence/national/chubu-west')
for m in json.load(open(R/'manifest.json')):
 if m.get('status')!=200:continue
 s=BeautifulSoup(pathlib.Path(m['snapshotPath']).read_bytes(),'html.parser'); hits=[]
 for e in s.select('a[href],iframe[src]'):
  u=e.get('href',e.get('src',''))
  if re.search(r'(?:q|query|destination)=(-?\d+\.\d+)[,% ]',u): hits.append(u)
 if hits:print(m['url'], '\n'+'\n'.join(hits))
