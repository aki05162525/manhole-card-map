import urllib.request,hashlib,json,datetime,pathlib,concurrent.futures
ROOT=pathlib.Path('data/evidence/issue5/north-kanto')
def get(url):
 p=ROOT/(hashlib.sha256(url.encode()).hexdigest()[:20]+'.html');m={'sourceUrl':url,'requestedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actorType':'ai'}
 try:
  with urllib.request.urlopen(url,timeout=25) as r:
   b=r.read();p.write_bytes(b);m.update(status=r.status,finalUrl=r.url,snapshotPath=str(p),snapshotSHA256=hashlib.sha256(b).hexdigest(),bytes=len(b),headers=dict(r.headers),fetchedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
 except Exception as e:m.update(error=str(e),failedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
 return m
urls=['https://www.city.sakuragawa.lg.jp/map.php?type=0','https://www.city.sakuragawa.lg.jp/kurashi/news/page006330.html','https://www.town.kawajima.saitama.jp/1825.htm','https://www.town.kawajima.saitama.jp/6276.htm','https://www.city.chikusei.lg.jp/page/page000475.html']
r=list(concurrent.futures.ThreadPoolExecutor(5).map(get,urls));(ROOT/'fetch-additional-records.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print([{k:v for k,v in a.items() if k in ['sourceUrl','status','error','snapshotPath']} for a in r])
