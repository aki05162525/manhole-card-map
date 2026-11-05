import json,pathlib,hashlib,urllib.request,urllib.error,urllib.parse,time,datetime,re
from bs4 import BeautifulSoup
ROOT=pathlib.Path('data/evidence/national/locations-chubu-east-south'); MP=ROOT/'manifest.json'
manifest=json.loads(MP.read_text()) if MP.exists() else []
cache={}
for p in pathlib.Path('data/evidence').rglob('manifest.json'):
 try:
  entries=json.loads(p.read_text()); entries=entries if isinstance(entries,list) else entries.get('entries',entries.get('sources',[]))
  for e in entries:
   if not isinstance(e,dict):continue
   for k in ['url','sourceUrl','finalUrl']:
    if e.get(k) and e.get('snapshotPath') and pathlib.Path(e['snapshotPath']).exists():cache[e[k]]=e
 except:pass
last={}
def fetch(url):
 if url in cache:
  e=dict(cache[url]);e['url']=url;e['cacheReused']=True
  if not any(x['url']==url for x in manifest):manifest.append(e);MP.write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
  return e
 host=urllib.parse.urlsplit(url).netloc
 time.sleep(max(0,1.05-(time.time()-last.get(host,0))))
 e={'url':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actorType':'ai'}
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (compatible; official-facility-evidence-research)'}),timeout=30) as r:
   b=r.read();e.update(status=r.status,finalUrl=r.url,contentType=r.headers.get('Content-Type',''))
 except urllib.error.HTTPError as ex:b=ex.read();e.update(status=ex.code,error=str(ex))
 except Exception as ex:b=b'';e.update(status=0,error=str(ex))
 last[host]=time.time()
 p=ROOT/(hashlib.sha256(url.encode()).hexdigest()[:24]+'.html');p.write_bytes(b)
 e.update(snapshotPath=str(p),sha256=hashlib.sha256(b).hexdigest(),bytes=len(b))
 manifest.append(e);cache[url]=e;MP.write_text(json.dumps(manifest,ensure_ascii=False,indent=2));return e
def soup(e):
 return BeautifulSoup(pathlib.Path(e['snapshotPath']).read_bytes(),'html.parser')
def inspect(url):
 e=fetch(url);s=soup(e)
 print('\nURL',url,'STATUS',e.get('status'),'FILE',e['snapshotPath'])
 for t in s(['script','style']):
  if re.search(r'lat|[Ll]ng|[Ll]on|[Mm]arker|[Gg]eo',t.get_text()):print('SCRIPT',t.get_text()[:5000])
  t.decompose()
 print('TEXT',s.get_text(' ',strip=True)[-7500:])
 for a in s.find_all(['a','iframe']):
  h=a.get('href',a.get('src','')); label=a.get_text(' ',strip=True)
  if re.search(r'map|access|アクセス|交通|地図|庁舎|所在地',h+' '+label,re.I):print('LINK',label,urllib.parse.urljoin(e.get('finalUrl',url),h))
ledger=json.load(open('data/overrides/regions/chubu-east.json'));audit=json.load(open('data/national/regions/chubu-east.json'))
ids={r['placeId'] for r in ledger['relations'] if r['cardId'][:2] in ['19','20']}
ps=[p for p in ledger['places'] if p['id'] in ids and not p.get('coordinate')]
if __name__=='__main__':
 import sys
 for u in sys.argv[1:]:inspect(u)
