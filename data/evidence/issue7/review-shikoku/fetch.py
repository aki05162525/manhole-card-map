import urllib.request,pathlib,hashlib,json,datetime,concurrent.futures
D=pathlib.Path(__file__).parent
urls=['https://maps.pref.tokushima.lg.jp/doc/2026082700018/','https://maps.pref.tokushima.lg.jp/ud/options/info.html','https://www.love-marugame.jp/info/12638','https://www.city.marugame.lg.jp/map/8568.html','https://www.city.marugame.lg.jp/uploaded/attachment/21326.pdf','https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-2022.html','https://nlftp.mlit.go.jp/ksj/other/agreement.html']
def fetch(u):
 r={'sourceUrl':u,'requestedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(u,timeout=30) as f:
   b=f.read();h=hashlib.sha256(b).hexdigest();p=D/(h+('.pdf' if 'pdf' in f.headers.get('Content-Type','') else '.html'));p.write_bytes(b);r.update(snapshotPath=str(p.resolve().relative_to(pathlib.Path.cwd())),snapshotSHA256=h,status=f.status,finalUrl=f.url,contentType=f.headers.get('Content-Type'),fetchedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
 except Exception as e:r['error']=str(e)
 return r
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as e:r=list(e.map(fetch,urls))
(D/'fetches.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(r,ensure_ascii=False,indent=2))
