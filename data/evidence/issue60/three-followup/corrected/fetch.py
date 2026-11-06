from pathlib import Path
import urllib.request,json,math,hashlib,datetime,concurrent.futures
from PIL import Image,ImageDraw
O=Path('/tmp/issue60-own-georef-other'); (O/'raw').mkdir(exist_ok=True)
logs=[]
def fetch(job):
 name,url=job;p=O/'raw'/name
 try:
  r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':url.split('/estation/')[0]+'/'}),timeout=30); content=r.read();p.write_bytes(content)
  v={'file':str(p),'url':url,'status':r.status,'sha256':hashlib.sha256(content).hexdigest(),'bytes':len(content),'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()};logs.append(v);return r.status
 except Exception as e:logs.append({'url':url,'error':str(e)});return 0
sites={7:(35.71043,139.80579),13:(35.18845,139.6533),14:(35.4338,139.43125),40:(36.017642,139.677572),41:(36.1947,139.7096)}
meta={};jobs=[]
for no,(lat,lon) in sites.items():
 z=18;n=2**z;x=int((lon+180)/360*n);y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)
 meta[no]={'z':z,'tileX0':x-1,'tileY0':y-1,'tileSize':256,'extentPixels':768,'selectionNote':'reported vicinity used only for image retrieval, no reported pixel marker'}
 for layer,ext in [('std','png'),('seamlessphoto','jpg')]:
  for dx in range(-1,2):
   for dy in range(-1,2):
    jobs.append((f'{no}-{layer}-{x+dx}-{y+dy}.{ext}',f'https://cyberjapandata.gsi.go.jp/xyz/{layer}/{z}/{x+dx}/{y+dy}.{ext}'))
obs=json.load(open('data/evidence/kanto-prefecture/kanagawa/north/miura-followup/observation.json'))
plaza=next(x['url'] for x in obs['sourceRefs'] if x.get('key')=='plaza.pdf')
jobs += [('13-plaza.pdf',plaza),('14-parking.pdf','https://www.ayase-bunka.com/src/pdf/dl_guide03_parking.pdf'),('41-floor.png','https://www.jreast.co.jp/estation/stations/img/floormap/0676_1f-2f.png'),('7-plan.png','https://www.tokyo-mizumachi.jp/module/img/index/img_map.png')]
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:list(ex.map(fetch,jobs))
for no,m in meta.items():
 for layer,ext in [('std','png'),('seamlessphoto','jpg')]:
  im=Image.new('RGB',(768,768),'white')
  for dx in range(3):
   for dy in range(3):
    p=O/'raw'/f'{no}-{layer}-{m["tileX0"]+dx}-{m["tileY0"]+dy}.{ext}'
    try:im.paste(Image.open(p),(256*dx,256*dy))
    except:pass
  im.save(O/f'{no}-{layer}.png')
json.dump(meta,open(O/'mosaic-metadata.json','w'),indent=2);json.dump(logs,open(O/'retrievals.json','w'),indent=2)
print('fetched',len(logs),'failed',[(v.get('url'),v.get('status')) for v in logs if v.get('status')!=200])
