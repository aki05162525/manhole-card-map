import urllib.request,json,hashlib,datetime,concurrent.futures,pathlib
out=pathlib.Path('/tmp/issue60-recheck-third-tokyo')
urls={
'flare-page.html':'https://www.city.akiruno.tokyo.jp/kanko/0000019221.html',
'exhibition.html':'https://www.city.suginami.tokyo.jp/s100/7585.html',
'ogikubo.html':'https://ogikubo3gardens.jp/tekigaiso/',
'visitor-map.svg':'https://ogikubo3gardens.jp/img/tekigaiso/visitor-map.svg',
'access.svg':'https://ogikubo3gardens.jp/img/tekigaiso/access.svg'}
def fetch(item):
 name,url=item; r={'url':url,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(url,timeout=30) as f:
   b=f.read(); p=out/'raw'/name;p.write_bytes(b);r.update(status=f.status,finalURL=f.url,path=str(p),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
 except Exception as e:r['error']=str(e)
 return r
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:r=list(ex.map(fetch,urls.items()))
(out/'retrievals.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(r,ensure_ascii=False,indent=2))
