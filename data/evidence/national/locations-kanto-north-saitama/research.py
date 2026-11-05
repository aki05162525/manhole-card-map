import json,pathlib,hashlib,datetime,time,re,sys,urllib.parse
import requests
from bs4 import BeautifulSoup
ROOT=pathlib.Path('data/evidence/national/locations-kanto-north-saitama')
BASE=json.load(open('data/overrides/regions/kanto-north.json'))
IDS={r['placeId'] for r in BASE['relations'] if r['cardId'].startswith('11')}
TARGETS=[p for p in BASE['places'] if p['id'] in IDS and not p.get('coordinate')]
OLD=json.load(open('data/evidence/national/kanto-north/manifest.json'))
MAN=json.load(open(ROOT/'manifest.json')) if (ROOT/'manifest.json').exists() else []
CACHE={m['url']:m for m in OLD+MAN}
LAST={}
def save():
 existing=json.load(open(ROOT/'manifest.json')) if (ROOT/'manifest.json').exists() else []
 merged={m['url']:m for m in existing+MAN}
 (ROOT/'manifest.json').write_text(json.dumps(list(merged.values()),ensure_ascii=False,indent=2)+'\n')
def fetch(url):
 if url in CACHE:
  m=dict(CACHE[url])
  if m not in MAN:
   m['cacheReused']=True; MAN.append(m); save()
  return m
 host=urllib.parse.urlparse(url).netloc
 time.sleep(max(0,1.05-(time.monotonic()-LAST.get(host,0))))
 m={'url':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  r=requests.get(url,timeout=25); LAST[host]=time.monotonic()
  p=ROOT/(hashlib.sha256(url.encode()).hexdigest()[:20]+'.html');p.write_bytes(r.content)
  m.update(status=r.status_code,finalUrl=r.url,contentType=r.headers.get('Content-Type',''),snapshotPath=str(p),snapshotSHA256=hashlib.sha256(r.content).hexdigest())
 except requests.RequestException as e:m['error']=str(e)
 MAN.append(m);CACHE[url]=m;save();return m
def content(m):
 if not m.get('snapshotPath'):return ''
 b=pathlib.Path(m['snapshotPath']).read_bytes()
 if b.startswith(b'%PDF'):return ''
 s=BeautifulSoup(b,'html.parser');return str(s)
def inspect(url):
 m=fetch(url);s=content(m); soup=BeautifulSoup(s,'html.parser')
 print('URL',url,'STATUS',m.get('status',m.get('error')))
 print('TEXT',soup.get_text(' ',strip=True)[-22000:])
 print('MAP', '\n'.join(re.findall(r'.{0,150}(?:maps|[Mm]arker|[Ll]atitude|[Ll]ongitude|[Ll]at[Ll]ng|destination|geo\-|!3d|!2d).{0,250}',s)))
 print('LINKS',[(a.get_text(' ',strip=True),urllib.parse.urljoin(m.get('finalUrl',url),a.get('href',''))) for a in soup.select('a[href]') if re.search('アクセス|交通|所在地|案内|地図|庁舎|施設|センター|観光',a.get_text())][-100:])
if __name__=='__main__':
 if sys.argv[1]=='inspect':
  for u in sys.argv[2:]:inspect(u)
 elif sys.argv[1]=='targets':
  a=json.load(open('data/national/regions/kanto-north.json'))
  for i,p in enumerate(TARGETS):
   rs=[r for c in a['cards'] for r in c.get('relations',[]) if r.get('facilityId')==p['id']]
   print(i,p['name'],p['address']); print(sorted({u for r in rs for u in r.get('sourceUrls',[])}))
