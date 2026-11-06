import urllib.request,json,math,hashlib,datetime,concurrent.futures,io
from pathlib import Path
from PIL import Image,ImageDraw
O=Path('/tmp/issue60-recheck-north-final-nov6');(O/'sources').mkdir(exist_ok=True)
pts={38:(36.13250,139.60800),39:(36.14138,139.29735),41:(36.19655,139.70990),42:(36.35740,139.58300),43:(36.43624,139.90943),44:(36.31361,139.80414),45:(36.40533,139.33047)}
urls={38:['https://www.city.kazo.lg.jp/soshiki/soumu/shisetsu/5043.html','https://www.city.kazo.lg.jp/soshiki/soumu/shisetsu/5025.html'],39:['https://www.city.fukaya.saitama.jp/soshiki/sangyoshinko/shokoshinkou/tanto/michinoeki/michjnoeki_kawamoto.html','https://www.city.fukaya.saitama.jp/soshiki/kankyosuido/gesuido/tanto/00218/18676.html'],41:['https://www.kogakanko.jp/news/annaijo','https://www.jreast.co.jp/estation/stations/676.html'],42:['https://www.city.sano.lg.jp/sp/cricket/28597.html','https://cycletownsano.studio.site/cricket'],43:['https://www.town.kaminokawa.lg.jp/0366/info-0000003312-0.html'],44:['https://www.city.oyama.tochigi.jp/shisei/shisetsu/etc/page006531.html','https://oyama-kankou.info/buy/machinoeki_shikisaikan/'],45:['https://www.city.kiryu.lg.jp/shisei/1017216/1024700.html','https://www.city.kiryu.lg.jp/shisei/1017216/1021185.html']}
jobs=[]
for n,us in urls.items():
 for i,u in enumerate(us):jobs.append((f'{n}-official-{i}.html',u))
for n,(lat,lon) in pts.items():
 z=17;x=(lon+180)/360*2**z;y=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z
 for dx in [-1,0,1]:
  for dy in [-1,0,1]:
   tx=int(x)+dx;ty=int(y)+dy;jobs.append((f'{n}-std-{z}-{tx}-{ty}.png',f'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{tx}/{ty}.png'))
def fetch(job):
 name,u=job
 try:
  r=urllib.request.urlopen(u,timeout=25);content=r.read();p=O/'sources'/name;p.write_bytes(content)
  return dict(path=str(p),url=u,finalURL=r.url,retrievedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),sha256=hashlib.sha256(content).hexdigest(),status=r.status)
 except Exception as e:return dict(path=name,url=u,error=str(e))
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:rows=list(ex.map(fetch,jobs))
(O/'retrievals.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
for n,(lat,lon) in pts.items():
 z=17;x=(lon+180)/360*2**z;y=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z;im=Image.new('RGB',(768,768),'white')
 for dx in [-1,0,1]:
  for dy in [-1,0,1]:
   p=O/'sources'/f'{n}-std-{z}-{int(x)+dx}-{int(y)+dy}.png'
   if p.exists():im.paste(Image.open(p),((dx+1)*256,(dy+1)*256))
 im.save(O/f'{n}-map-clean.png');d=ImageDraw.Draw(im);px=(x-int(x)+1)*256;py=(y-int(y)+1)*256;d.ellipse((px-7,py-7,px+7,py+7),outline='red',width=2);d.text((10,10),f'{n}: user point (red) / GSI std / north up',fill='red');im.save(O/f'{n}-map.png')
print('retrieved',len(rows),'failures',[r for r in rows if 'error'in r])
