import urllib.request,hashlib,json,datetime,pathlib,concurrent.futures
ROOT=pathlib.Path('data/evidence/issue5/north-kanto')
urls=[
'https://www.city.chikusei.lg.jp/kurashi-tetsuzuki/gesuidou/page006377.html',
'https://www.city.chikusei.lg.jp/gyousei/soshiki-shisetsu/floor-map/page001123.html',
'https://www.city.chikusei.lg.jp/site-policy/',
'https://www.town.kaminokawa.lg.jp/0023/genre1-0-001.html',
'https://www.agrinet.pref.tochigi.lg.jp/tochigi-nouson-meguri/archives/spot_all_season/origaminomachi_kaminokawa']
def get(url):
 p=ROOT/(hashlib.sha256(url.encode()).hexdigest()[:20]+'.html');m={'sourceUrl':url,'requestedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actorType':'ai'}
 try:
  with urllib.request.urlopen(url,timeout=25) as r:
   b=r.read();p.write_bytes(b);m.update(status=r.status,finalUrl=r.url,snapshotPath=str(p),snapshotSHA256=hashlib.sha256(b).hexdigest(),bytes=len(b),headers=dict(r.headers),fetchedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
 except Exception as e:m.update(error=str(e),failedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
 return m
results=list(concurrent.futures.ThreadPoolExecutor(5).map(get,urls));(ROOT/'fetch-records.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n');print(json.dumps([{k:v for k,v in r.items() if k not in ['headers']} for r in results],ensure_ascii=False,indent=2))
