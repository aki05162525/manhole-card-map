exec(open('/tmp/issue60-recheck-north-final-nov6/fetch.py').read().split('jobs=[]')[0])
pts={38:(36.13149,139.60189),39:(36.15154,139.28923),41:(36.1947,139.7096),42:(36.3582,139.59225),45:(36.407,139.3297)}
jobs=[('41-floor.png','https://www.jreast.co.jp/estation/stations/img/floormap/0676_1f-2f.png'),('42-access.html','https://www.city.sano.lg.jp/sp/cricket/28022.html')]
for n,(lat,lon) in pts.items():
 z=17;x=(lon+180)/360*2**z;y=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z
 for dx in [-1,0,1]:
  for dy in [-1,0,1]:
   tx=int(x)+dx;ty=int(y)+dy;jobs.append((f'{n}-target-std-{z}-{tx}-{ty}.png',f'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{tx}/{ty}.png'))
exec(open('/tmp/issue60-recheck-north-final-nov6/fetch.py').read().split('def fetch(job):')[1].split('with concurrent')[0].join(['def fetch(job):','']))
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex: rows=list(ex.map(fetch,jobs))
(O/'extra-retrievals.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
for n,(lat,lon) in pts.items():
 z=17;x=(lon+180)/360*2**z;y=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z;im=Image.new('RGB',(768,768),'white')
 for dx in [-1,0,1]:
  for dy in [-1,0,1]:
   p=O/'sources'/f'{n}-target-std-{z}-{int(x)+dx}-{int(y)+dy}.png'
   if p.exists():im.paste(Image.open(p),((dx+1)*256,(dy+1)*256))
 im.save(O/f'{n}-target-map.png')
print([r for r in rows if 'error'in r])
