import urllib.request,hashlib,json,datetime,sys
from pathlib import Path
root=Path(__file__).parent
out=[]
for u in sys.argv[1:]:
 e={'url':u,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actorType':'ai'}
 try:
  req=urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'})
  with urllib.request.urlopen(req,timeout=30) as r:
   b=r.read();p=root/(hashlib.sha256(u.encode()).hexdigest()[:20]+'.html');p.write_bytes(b);e.update(status=r.status,finalUrl=r.url,snapshotPath=str(p),sha256=hashlib.sha256(b).hexdigest())
 except Exception as ex:e['error']=str(ex)
 out.append(e);print(json.dumps(e,ensure_ascii=False))
p=root/'additional-manifest.json';prior=json.loads(p.read_text()) if p.exists() else [];p.write_text(json.dumps(prior+out,ensure_ascii=False,indent=2)+'\n')
