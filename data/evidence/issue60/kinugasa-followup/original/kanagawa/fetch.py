import urllib.request,hashlib,json,datetime,concurrent.futures
from pathlib import Path
O=Path('/tmp/issue60-recheck-six/kanagawa');items=[('guidebook2009.pdf','https://kinuten.com/hp6/wp-content/uploads/2020/03/guidebook2009.pdf'),('kinugasa-center.jpg','https://kinuten.com/hp7/wp-content/uploads/2025_sc2-1024x615.jpg'),('kinugasa-history.html','https://kinuten.com/hp6/?p=135'),('kinugasa-center.html','https://kinuten.com/?page_id=2263'),('miura-access.html','https://miura-info.ne.jp/access/tourist-information/'),('miura-shonanjin.html','https://shonanjin.com/news/miura-umico-opening/')]
def fetch(i):
 k,u=i;st=datetime.datetime.now(datetime.timezone.utc).isoformat()
 try:
  r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=25);b=r.read();(O/k).write_bytes(b);return {'path':str(O/k),'url':u,'status':r.status,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'fetchedAt':st}
 except Exception as e:return {'url':u,'status':'failed','error':str(e),'fetchedAt':st}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:rs=list(ex.map(fetch,items))
(O/'retrievals.json').write_text(json.dumps(rs,ensure_ascii=False,indent=2));print([(r['url'],r['status']) for r in rs])
