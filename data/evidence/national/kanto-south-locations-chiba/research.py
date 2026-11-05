import json,pathlib,hashlib,datetime,time,urllib.parse,requests,re,sys
from bs4 import BeautifulSoup
ROOT=pathlib.Path('data/evidence/national/kanto-south-locations-chiba')
OLD=json.load(open('data/evidence/national/kanto-south/manifest.json'))
M=json.load(open(ROOT/'manifest.json')) if (ROOT/'manifest.json').exists() else []
X=json.load(open('data/overrides/regions/kanto-south.json')); ids={r['placeId'] for r in X['relations'] if r['cardId'].startswith('12')};P=[p for p in X['places'] if p['id'] in ids and 'coordinate' not in p]
def save(): (ROOT/'manifest.json').write_text(json.dumps(M,ensure_ascii=False,indent=2)+'\n')
def fetch(u):
 for m in M:
  if u in (m['url'],m.get('finalUrl')):return m
 for m in OLD:
  if u in (m['url'],m.get('finalUrl')):
   m=dict(m);m['reusedFrom']=m.get('snapshotPath');
   if m.get('snapshotPath'):
    p=ROOT/pathlib.Path(m['snapshotPath']).name;p.write_bytes(pathlib.Path(m['snapshotPath']).read_bytes());m['snapshotPath']=str(p)
   M.append(m);save();return m
 time.sleep(1.1);m={'url':u,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  r=requests.get(u,timeout=25);p=ROOT/(hashlib.sha256(u.encode()).hexdigest()[:20]+'.html');p.write_bytes(r.content);m.update(status=r.status_code,finalUrl=r.url,snapshotPath=str(p),sha256=hashlib.sha256(r.content).hexdigest())
 except Exception as e:m['error']=str(e)
 M.append(m);save();return m
def soup(m):
 if not m.get('snapshotPath'):return BeautifulSoup('','html.parser')
 return BeautifulSoup(pathlib.Path(m['snapshotPath']).read_bytes(),'html.parser')
def inspect(u):
 m=fetch(u);s=soup(m);print('\nURL',u,m.get('status',m.get('error')))
 for el in s(['script','iframe']):
  t=str(el)
  if re.search('maps|latitude|LatLng|longitude',t,re.I):print(t[:3500])
 for a in s.find_all('a',href=True):
  h=urllib.parse.urljoin(m.get('finalUrl',u),a['href']);t=a.get_text(' ',strip=True)
  if re.search('google|map|access',h,re.I) or any(w in t for w in ['アクセス','交通','所在地','施設案内','観光案内','図書館','文化','市役所','センター','博物館','科学館','公民館','井上','佐蘭花']):print(t,h)
if __name__=='__main__':
 for u in sys.argv[1:]:inspect(u)
