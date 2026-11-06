import requests,math,json,hashlib,datetime
from PIL import Image
from io import BytesIO
from pathlib import Path
out=Path('/tmp/issue60-recheck-chiba-nov6');records=[];frames={}
for key,lat,lon in [('hall',35.42935,139.95445),('togane',35.57715,140.38405)]:
 z=18;n=2**z;x=int((lon+180)/360*n);y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
 frames[key]=dict(z=z,x=x-1,y=y-1)
 for layer in ['std','seamlessphoto']:
  im=Image.new('RGB',(768,768),'white')
  for dx in [-1,0,1]:
   for dy in [-1,0,1]:
    u=f'https://cyberjapandata.gsi.go.jp/xyz/{layer}/{z}/{x+dx}/{y+dy}.'+('jpg' if layer=='seamlessphoto' else 'png');r=requests.get(u,timeout=30);fn=f'{key}-{layer}-{x+dx}-{y+dy}.'+('jpg' if layer=='seamlessphoto' else 'png');(out/fn).write_bytes(r.content)
    records.append(dict(url=u,path=fn,status=r.status_code,sha256=hashlib.sha256(r.content).hexdigest(),fetchedAt=datetime.datetime.now(datetime.timezone.utc).isoformat()))
    if r.status_code==200:im.paste(Image.open(BytesIO(r.content)),((dx+1)*256,(dy+1)*256))
  im.save(out/f'{key}-{layer}.png')
(out/'raster-retrievals.json').write_text(json.dumps(records,indent=2));(out/'raster-frames.json').write_text(json.dumps(frames,indent=2))
