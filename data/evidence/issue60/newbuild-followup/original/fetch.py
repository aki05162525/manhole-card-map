import urllib.request,json,math,hashlib,datetime,concurrent.futures
from pathlib import Path
from PIL import Image
O=Path('/tmp/issue60-own-georef-newbuild')
pts={27:(36.13244,139.24571),35:(36.11722,139.19458),42:(36.358244,139.59225),43:(36.43624,139.90943),45:(36.40533,139.33047)}
def fetch(j):
 name,url=j;p=O/'raw'/name
 try:
  r=urllib.request.urlopen(url,timeout=30);b=r.read();p.write_bytes(b)
  return dict(path=str(p),url=url,retrievedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),sha256=hashlib.sha256(b).hexdigest(),status=r.status,lastModified=r.headers.get('Last-Modified'))
 except Exception as e:return dict(url=url,error=str(e))
if __name__=='__main__':
 jobs=[];windows={}
 for n,(lat,lon) in pts.items():
  z=18;x=int((lon+180)/360*2**z);y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z);windows[n]=dict(z=z,x0=x-2,y0=y-2,tiles=5,pixelsPerTile=256)
  for dx in range(-2,3):
   for dy in range(-2,3):
    for layer,ext in [('seamlessphoto','jpg'),('std','png')]:jobs.append((f'{n}-{layer}-{z}-{x+dx}-{y+dy}.{ext}',f'https://cyberjapandata.gsi.go.jp/xyz/{layer}/{z}/{x+dx}/{y+dy}.{ext}'))
  jobs.append((f'{n}-spec.geojson',f'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto_spec/14/{x//16}/{y//16}.geojson'))
 with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:rows=list(ex.map(fetch,jobs))
 (O/'retrievals.json').write_text(json.dumps(rows,indent=2,ensure_ascii=False));(O/'windows.json').write_text(json.dumps(windows,indent=2))
 for n,w in windows.items():
  for layer,ext in [('seamlessphoto','jpg'),('std','png')]:
   im=Image.new('RGB',(1280,1280),'white')
   for dx in range(5):
    for dy in range(5):
     p=O/'raw'/f'{n}-{layer}-18-{w["x0"]+dx}-{w["y0"]+dy}.{ext}'
     if p.exists():im.paste(Image.open(p),(dx*256,dy*256))
   im.save(O/f'{n}-{layer}.png')
 print('fetched',len(rows),'errors',[r for r in rows if 'error' in r])
