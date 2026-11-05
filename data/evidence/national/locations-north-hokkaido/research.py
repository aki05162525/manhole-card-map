import json,pathlib,hashlib,datetime,time,urllib.parse,concurrent.futures,threading,re
import requests
from bs4 import BeautifulSoup
ROOT=pathlib.Path('data/evidence/national/locations-north-hokkaido')
ledger=json.load(open('data/overrides/regions/north.json')); audit=json.load(open('data/national/regions/north.json'))
ids={r['placeId'] for r in ledger['relations'] if r['cardId'].startswith('01')}
targets=[p for p in ledger['places'] if p['id'] in ids and not p.get('coordinate')]
json.dump(targets,open(ROOT/'targets.json','w'),ensure_ascii=False,indent=2)
old=json.load(open('data/evidence/national/north/manifest.json')); manifest=json.load(open(ROOT/'manifest.json')) if (ROOT/'manifest.json').exists() else []
cache={x['url']:x for x in old+manifest}; lock=threading.Lock(); hostlocks={}; last={}
def fetch(url):
 if url in cache:
  entry=cache[url].copy()
  if entry.get('snapshotPath') and not entry['snapshotPath'].startswith(str(ROOT)):
   src=pathlib.Path(entry['snapshotPath']); dst=ROOT/src.name; dst.write_bytes(src.read_bytes()); entry['reusedFrom']=str(src); entry['snapshotPath']=str(dst)
  with lock:
   if not any(x['url']==url for x in manifest):manifest.append(entry)
  return entry
 host=urllib.parse.urlsplit(url).netloc
 with lock: hl=hostlocks.setdefault(host,threading.Lock())
 with hl:
  time.sleep(max(0,1.1-(time.monotonic()-last.get(host,0)))); last[host]=time.monotonic()
  entry={'url':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  try:
   r=requests.get(url,timeout=25); entry.update(status=r.status_code,finalUrl=r.url,contentType=r.headers.get('Content-Type','')); path=ROOT/(hashlib.sha256(url.encode()).hexdigest()[:20]+'.html');path.write_bytes(r.content);entry.update(snapshotPath=str(path),snapshotSHA256=hashlib.sha256(r.content).hexdigest(),bytes=len(r.content))
  except Exception as e:entry.update(status='error',error=str(e))
  with lock: manifest.append(entry); cache[url]=entry
  return entry
def inspect(e):
 if not e.get('snapshotPath'):return {'maps':[],'links':[],'text':''}
 raw=pathlib.Path(e['snapshotPath']).read_bytes();s=BeautifulSoup(raw,'html.parser'); maps=[];links=[]
 for tag in s.find_all(['a','iframe','script']):
  u=tag.get('href',tag.get('src',''));label=tag.get_text(' ',strip=True)
  if re.search('google.*map|maps\\.app|maps\\.google|goo.gl/maps',u):maps.append(u)
  if u and re.search('アクセス|交通|所在地|施設案内|庁舎|access|location',label+' '+u,re.I):
   link=urllib.parse.urljoin(e.get('finalUrl',e['url']),u)
   if urllib.parse.urlsplit(link).netloc==urllib.parse.urlsplit(e.get('finalUrl',e['url'])).netloc and not re.search(r'\.(jpg|png|gif|pdf)(\?|$)',link,re.I):links.append({'url':link,'label':label[:100]})
 geo=re.findall(r'.{0,100}(?:!3d|!2d|new google.maps.LatLng|latitude|longitude|"lat"|"lng"|marker|Marker).{0,180}',raw.decode('utf-8','replace'))
 return {'maps':maps,'links':links,'geo':geo,'text':s.get_text(' ',strip=True)}
def run(urls):
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex: list(ex.map(fetch,sorted(set(urls))))
 json.dump(manifest,open(ROOT/'manifest.json','w'),ensure_ascii=False,indent=2)
if __name__=='__main__':
 import sys
 if len(sys.argv)>1: urls=json.load(open(sys.argv[1])); run(urls)
 else:
  urls=set()
  for p in targets:
   urls.add(p['evidence']['sourceUrl'])
   for c in audit['cards']:
    if any(r['legacyPlaceId'] in p['legacyIds'] for r in c['relations']):
     urls.update(x['url'] for x in c['attempts'])
  run(urls)
 report={e['url']:inspect(e) for e in manifest}
 json.dump(report,open(ROOT/'inspection.json','w'),ensure_ascii=False,indent=2)
 print('urls',len(manifest))
