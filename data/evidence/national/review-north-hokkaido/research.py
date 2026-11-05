import json,hashlib,urllib.request,datetime,pathlib,concurrent.futures
R=pathlib.Path('data/evidence/national/review-north-hokkaido')
def fetch(url):
 e={'url':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(url,timeout=35) as f:b=f.read();e.update(status=f.status,finalUrl=f.url,contentType=f.headers.get('Content-Type'))
  p=R/(hashlib.sha256(url.encode()).hexdigest()[:20]+'.html');p.write_bytes(b);e.update(snapshotPath=str(p),snapshotSHA256=hashlib.sha256(b).hexdigest(),bytes=len(b))
 except Exception as x:e['error']=str(x)
 return e
if __name__=='__main__':
 urls=['https://www.harp.lg.jp/opendata/terms.html','https://nlftp.mlit.go.jp/ksj/other/agreement_02.html','https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P27.html','https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P28.html','https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P34.html','https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05.html']
 es=list(concurrent.futures.ThreadPoolExecutor(4).map(fetch,urls));(R/'manifest.json').write_text(json.dumps(es,ensure_ascii=False,indent=2));print(json.dumps(es,ensure_ascii=False,indent=2))
