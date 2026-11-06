import json,math,pathlib,urllib.request,hashlib,datetime,io
from PIL import Image,ImageDraw
O=pathlib.Path('/tmp/issue60-user-schematic-followup');logs=[];frames={}
for n,lat,lng in [(6,35.732508,139.228674),(11,35.257915,139.662163)]:
 z=18;x=int((lng+180)/360*2**z)-1;y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z)-1;frames[n]={'z':z,'x':x,'y':y,'tileSize':256,'viewerCenterOnly':[lat,lng]};im=Image.new('RGB',(768,768))
 for i in range(3):
  for j in range(3):
   url=f'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x+i}/{y+j}.jpg';p=O/f'{n}-gsi-{x+i}-{y+j}.jpg';b=urllib.request.urlopen(url,timeout=30).read();p.write_bytes(b);logs.append({'url':url,'file':p.name,'sha256':hashlib.sha256(b).hexdigest(),'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'photographedAt':None});im.paste(Image.open(io.BytesIO(b)),(256*i,256*j))
 im.save(O/f'{n}-gsi.png')
(O/'gsi-retrievals.json').write_text(json.dumps(logs,indent=2)+'\n');(O/'gsi-frames.json').write_text(json.dumps(frames,indent=2)+'\n')
