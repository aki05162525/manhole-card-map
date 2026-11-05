import urllib.request,urllib.error,hashlib,json,datetime,sys,pathlib,concurrent.futures
ROOT=pathlib.Path('data/evidence/issue5/west-south')
def fetch(url):
 rec={'url':url,'attemptedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  r=urllib.request.urlopen(url,timeout=35); b=r.read(); h=hashlib.sha256(b).hexdigest();p=ROOT/(h+'.bin');p.write_bytes(b)
  rec.update(status=r.status,finalUrl=r.geturl(),fetchedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),snapshotPath=str(p),snapshotSHA256=h,contentType=r.headers.get('Content-Type'))
 except Exception as e:rec['error']=str(e)
 return rec
if __name__=='__main__':
 urls=sys.argv[1:];records=list(concurrent.futures.ThreadPoolExecutor(5).map(fetch,urls));p=ROOT/'fetches.json';old=json.loads(p.read_text()) if p.exists() else [];p.write_text(json.dumps(old+records,ensure_ascii=False,indent=2)+'\n');print(json.dumps(records,ensure_ascii=False,indent=2))
