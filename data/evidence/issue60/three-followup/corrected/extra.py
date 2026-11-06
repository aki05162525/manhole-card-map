import urllib.request,hashlib,json,datetime
from pathlib import Path
O=Path('/tmp/issue60-own-georef-other'); logs=[]
urls={'41-floor-jreastcom.png':'https://www.jreast.co.jp/estation/stations/img/floormap/0676_1f-2f.png?20261106','41-station.html':'https://www.jreast.co.jp/estation/stations/676.html','gsi-photo-layer.txt':'https://maps.gsi.go.jp/layers_txt/layers6.txt','gsi-use.html':'https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html'}
for name,url in urls.items():
 try:
  r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':'https://www.jreast.co.jp/estation/stations/676.html'}),timeout=25);b=r.read();(O/'raw'/name).write_bytes(b);logs.append(dict(url=url,file=str(O/'raw'/name),status=r.status,sha256=hashlib.sha256(b).hexdigest(),retrievedAt=datetime.datetime.now(datetime.timezone.utc).isoformat()))
 except Exception as e:logs.append(dict(url=url,error=str(e)))
(O/'extra-retrievals.json').write_text(json.dumps(logs,indent=2));print(logs)
