import pathlib,json,hashlib,re,datetime
from bs4 import BeautifulSoup
R=pathlib.Path('data/evidence/national/chubu-west');original=pathlib.Path('/tmp/gkp-current-design.html');dest=R/'gkp-current-design.html'
if not dest.exists():dest.write_bytes(original.read_bytes())
s=BeautifulSoup(dest.read_bytes(),'html.parser');rows={}
x=json.load(open('data/work/national-input/full.json')); cardkeys={(c['id'][:6],c['id'][7]):c['id'] for c in x['cards'] if c['id'][:2] in ['21','22','23']}
for tr in s.select('tr'):
 im=tr.find('img');td=tr.find_all('td',recursive=False)
 if not im or len(td)<7:continue
 match=re.search(r'/(2[123]-\d{3})-?([A-Z])(?:-?\d+)?\.',im.get('src',''))
 if not match:continue
 cid=cardkeys[(match[1],match[2])] # unique municipality/letter key; image file suffix is not a printed card ID
 if cid in rows:raise ValueError(cid)
 rows[cid]={'city':td[0].get_text(' ',strip=True),'image':im.get('src'),'placeText':td[4].get_text('\n',strip=True),'hours':td[5].get_text('\n',strip=True),'stock':td[6].get_text('\n',strip=True),'links':[a['href'] for el in td[4:7] for a in el.select('a[href]')]}
(R/'gkp-rows.json').write_text(json.dumps({'sourceUrl':'https://www.gk-p.jp/mhcard/?pref=zenkoku','snapshotPath':str(dest),'snapshotSHA256':hashlib.sha256(dest.read_bytes()).hexdigest(),'acquisition':'Parent-provided /tmp/gkp-current-design.html, fetched 2026-11-05 per assignment; exact network acquisition time not available to this worker. Reused without refetch.','rows':rows},ensure_ascii=False,indent=2)+'\n')
x=json.load(open('data/work/national-input/full.json'));norm=lambda t:re.sub(r'\s+','',t)
for c in x['cards']:
 if c['id'][:2] not in ['21','22','23']:continue
 row=rows.get(c['id']);
 if not row:print('MISSING',c['id']);continue
 if norm('\n'.join(c['hours']))!=norm(row['hours']):print('HOURS',c['id'],c['hours'],'=>',row['hours'])
print('rows',len(rows))
