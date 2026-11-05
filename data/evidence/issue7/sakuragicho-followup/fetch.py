import pathlib,json,datetime,hashlib,urllib.request,math
D=pathlib.Path(__file__).resolve().parent
urls={'gsi-photo-info.html':'https://maps.gsi.go.jp/development/ichiran.html','cial-access.html':'https://www.jryscc.co.jp/cial/sakuragicho/access/'}
for n in ['01','02']:urls['cial-access'+n+'.png']='https://www.jryscc.co.jp/cial/img/img-sakuragicho-access'+n+'.png'
z=18;x=int((139.6312274+180)/360*2**z); y=int((1-math.asinh(math.tan(math.radians(35.4511374)))/math.pi)/2*2**z)
for dx in [-1,0,1]:
 for dy in [-1,0,1]:urls[f'photo-{z}-{x+dx}-{y+dy}.jpg']=f'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x+dx}/{y+dy}.jpg'
rows=[]
for name,url in urls.items():
 start=datetime.datetime.now(datetime.timezone.utc).isoformat()
 try:
  with urllib.request.urlopen(url,timeout=45) as r:data=r.read();status=r.status;final=r.url
  (D/name).write_bytes(data);rows.append(dict(sourceUrl=url,fetchedAt=start,completedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),status=status,finalUrl=final,snapshotPath=str((D/name).relative_to(pathlib.Path.cwd())),snapshotSHA256=hashlib.sha256(data).hexdigest(),bytes=len(data)))
 except Exception as e:rows.append(dict(sourceUrl=url,fetchedAt=start,error=str(e)))
(D/'fetch-records.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print([(pathlib.Path(r.get('snapshotPath','')).name,r.get('status',r.get('error'))) for r in rows])
