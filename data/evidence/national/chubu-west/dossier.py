import json,pathlib,re
from bs4 import BeautifulSoup
R=pathlib.Path('data/evidence/national/chubu-west');m=json.load(open(R/'manifest.json'));x=json.load(open('data/work/national-input/full.json'));seen=set()
for c in x['cards']:
 if c['id'][:2] not in ['21','22','23']:continue
 print('\nCARD',c['id'],c['city'])
 for u in c['links']:
  u=u.split('#')[0]
  if u in seen:continue
  seen.add(u); a=next((a for a in m if a['url']==u),None)
  if not a:print('NOT FETCHED',u);continue
  print('URL',u,a.get('status',a.get('error')))
  if a.get('status')!=200:continue
  s=BeautifulSoup(pathlib.Path(a['snapshotPath']).read_bytes(),'html.parser')
  for z in s(['script','style','header','footer','nav']):z.decompose()
  t=s.get_text('\n',strip=True);hits=[h.start() for h in re.finditer('マンホールカード',t)]
  if hits:
   start=max(0,hits[0]-120);end=min(len(t),hits[-1]+1400);print(t[start:end][-10000:])
  else: print('No card text; title',str(s.title))
