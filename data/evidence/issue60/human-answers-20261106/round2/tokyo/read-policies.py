import urllib.request,datetime,hashlib,json,pathlib,concurrent.futures
out=pathlib.Path('/tmp/issue60-round2-tokyo');(out/'raw').mkdir(exist_ok=True)
urls=['https://www.ur-net.go.jp/site/guide.html','https://akabanemuseum.ur-net.go.jp/wedsitenote/','https://www.city.akiruno.tokyo.jp/site_policy/0000000005.html','https://www.city.edogawa.tokyo.jp/e004/aboutweb/riyo.html']
def get(url):
 r={'url':url,'requestStartedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as f:
   b=f.read();sha=hashlib.sha256(b).hexdigest();p=out/'raw'/f'{sha}.html';p.write_bytes(b);r.update(status=f.status,finalURL=f.url,sha256=sha,bytes=len(b),rawPath=str(p))
 except Exception as e:r['error']=str(e)
 r['completedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();return r
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:rs=list(ex.map(get,urls))
(out/'policy-retrievals.json').write_text(json.dumps(rs,ensure_ascii=False,indent=2)+'\n')
print([(r['url'],r.get('status',r.get('error')))for r in rs])
