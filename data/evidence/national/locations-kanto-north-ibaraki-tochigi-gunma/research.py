import json,pathlib,hashlib,urllib.parse,time,datetime,requests,re,threading,concurrent.futures,fcntl
from bs4 import BeautifulSoup
ROOT=pathlib.Path('data/evidence/national/locations-kanto-north-ibaraki-tochigi-gunma')
old=json.load(open('data/evidence/national/kanto-north/manifest.json'))
manifest=json.load(open(ROOT/'manifest.json')) if (ROOT/'manifest.json').exists() else []
cache={m['url']:m for m in old+manifest}
locks={};times={};mu=threading.Lock()
def dump(name,obj): (ROOT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def fetch(url):
 if url in cache:return cache[url]
 host=urllib.parse.urlsplit(url).netloc
 with mu: lock=locks.setdefault(host,threading.Lock())
 with lock:
  time.sleep(max(0,1.05-(time.monotonic()-times.get(host,0))));times[host]=time.monotonic()
  m={'url':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  try:
   r=requests.get(url,timeout=25);m.update(status=r.status_code,finalUrl=r.url,contentType=r.headers.get('Content-Type',''))
   path=ROOT/(hashlib.sha256(url.encode()).hexdigest()[:20]+'.html');path.write_bytes(r.content)
   m.update(snapshotPath=str(path),snapshotSHA256=hashlib.sha256(r.content).hexdigest())
  except Exception as e:m['error']=str(e)
  with mu:
   with open(ROOT/'manifest.lock','w') as lf:
    fcntl.flock(lf,fcntl.LOCK_EX)
    current=json.load(open(ROOT/'manifest.json')) if (ROOT/'manifest.json').exists() else []
    current=[x for x in current if x['url']!=url]+[m];dump('manifest.json',current)
   manifest.append(m);cache[url]=m
  return m
def read(m):
 if not m.get('snapshotPath'):return ''
 b=pathlib.Path(m['snapshotPath']).read_bytes()
 if b[:4]==b'%PDF':return ''
 return BeautifulSoup(b,'html.parser').decode()
def inspect(m):
 s=read(m);soup=BeautifulSoup(s,'html.parser')
 links=[{'url':urllib.parse.urljoin(m.get('finalUrl',m['url']),a.get('href') or a.get('src','')),'label':a.get_text(' ',strip=True)} for a in soup.select('a[href],iframe[src],script[src]')]
 nums=[s[max(0,x.start()-180):x.end()+220] for x in re.finditer(r'(?:3[4567]\.\d{3,}|1(?:39|40)\.\d{3,}|latitude|longitude|LatLng|Marker\(|緯度|経度)',s)]
 return {'url':m['url'],'status':m.get('status',m.get('error')), 'title':soup.title.get_text() if soup.title else '', 'text':soup.get_text(' ',strip=True),'links':links,'numeric':nums}
p=json.load(open('data/overrides/regions/kanto-north.json'))
ids={r['placeId'] for r in p['relations'] if r['cardId'][:2] in ['08','09','10']}
targets=[x for x in p['places'] if x['id'] in ids and 'coordinate' not in x]
audit=json.load(open('data/national/regions/kanto-north.json'))
urls={x['id']:[] for x in targets}
for c in audit['cards']:
 for r in c['relations']:
  if r.get('facilityId') in urls:urls[r['facilityId']]+=r['sourceUrls']
if __name__=='__main__':
 dump('targets.json',targets)
 dump('cached-inspections.json',{f['id']:[inspect(cache[u]) for u in dict.fromkeys(urls[f['id']]) if u in cache] for f in targets})
 for i,f in enumerate(targets):
  print('\n',i,f['name'])
  for u in dict.fromkeys(urls[f['id']]):
   if u not in cache:continue
   d=inspect(cache[u]);print(' PAGE',u)
   for a in d['links']:
    if re.search('アクセス|交通|所在地|施設案内|庁舎|access|location',a['label']+' '+a['url'],re.I):print(' LINK',a['label'][:50],a['url'])
   for n in d['numeric']:print(' NUM',n.replace('\n',' ')[:380])
