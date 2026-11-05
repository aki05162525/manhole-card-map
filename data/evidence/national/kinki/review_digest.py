import json,pathlib,hashlib,re,sys
from bs4 import BeautifulSoup
from decisions import DECISIONS
root=pathlib.Path('data/evidence/national/kinki');x=json.load(open('data/work/national-input/full.json'));seen=set()
for c in x['cards']:
 if not ('24'<=c['id'][:2]<='30') or (len(sys.argv)>1 and c['id'][:2] not in sys.argv[1:]):continue
 if c['id'] in DECISIONS:continue
 print('\nCARD',c['id'],c['city'],'HOURS',c['hours'],'PLACES',c['placeText'])
 for u in reversed(c.get('links') or []):
  p=root/'snapshots'/(hashlib.sha256(u.encode()).hexdigest()[:20]+'.html')
  if u in seen: print('SEE ABOVE',u);continue
  seen.add(u)
  if not p.exists():print('NOT FETCHED',u);continue
  s=BeautifulSoup(p.read_bytes(),'html.parser');[z.decompose() for z in s(['script','style','header','footer','nav'])];t=s.get_text(' ',strip=True);t=re.sub(r'\s+',' ',t)
  main=s.select_one('#main_body, #tmp_contents, #main_text, .pagebody, article, main');t=re.sub(r'\s+',' ',main.get_text(' ',strip=True)) if main else t
  terms=list(re.finditer('マンホールカード|配布場所|配布時間|在庫状況',t))
  print('URL',u)
  if terms:
   spans=[]
   for m in terms:
    a=max(0,m.start()-60);b=min(len(t),m.start()+1600)
    if spans and a<=spans[-1][1]:spans[-1][1]=max(b,spans[-1][1])
    else:spans.append([a,b])
   print(' ... '.join(t[a:b] for a,b in spans)[:17000])
  else: print('NO CARD MENTION',t[:180])
