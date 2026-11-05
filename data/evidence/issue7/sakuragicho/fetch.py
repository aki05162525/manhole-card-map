import urllib.request,urllib.error,types,hashlib,json,datetime,pathlib,sys
D=pathlib.Path(__file__).resolve().parent.relative_to(pathlib.Path.cwd())

def fetch(url,name):
 t=datetime.datetime.now(datetime.timezone.utc).isoformat()
 
 try: response=urllib.request.urlopen(url,timeout=60)
 except urllib.error.HTTPError as e: response=e
 r=types.SimpleNamespace(content=response.read(),status_code=response.status,url=response.url,headers=response.headers)
 p=D/name;p.write_bytes(r.content)
 log=D/'fetch-records.json'; rows=json.loads(log.read_text()) if log.exists() else []
 rows.append(dict(sourceUrl=url,fetchedAt=t,completedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),status=r.status_code,finalUrl=r.url,snapshotPath=str(p),snapshotSHA256=hashlib.sha256(r.content).hexdigest(),bytes=len(r.content),headers={k:v for k,v in r.headers.items() if k.lower() not in ['set-cookie']}))
 log.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
 print(name,r.status_code,len(r.content));return r
if __name__=='__main__':fetch(sys.argv[1],sys.argv[2])
