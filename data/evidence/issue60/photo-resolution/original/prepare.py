from pathlib import Path
import json,hashlib,shutil,urllib.request,datetime,ssl
ctx=ssl.create_default_context();ctx.options |= 0x4 # server legacy renegotiation; certificate verification stays enabled
from PIL import Image
O=Path(__file__).resolve().parent;S=Path('/tmp/issue60-own-georef-newbuild')
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(n,v):(O/n).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
# Preserve checksums for all preexisting research files (excluding venv/cache).
prior={str(p.relative_to(S)):h(p) for p in S.rglob('*') if p.is_file() and '.venv' not in p.parts and '__pycache__' not in p.parts}
save('prior-bundle-hashes.json',prior)
copy=['georef-inputs.json','windows.json','candidates.json','43-plan-north.png','45-official-plan.png','43-more-retrievals.json','45-plan-retrieval.json','raw/43-basic.pdf','raw/45-parking.pdf','raw/43-spec.geojson','raw/45-spec.geojson']
for f in copy:
 dest=O/'inherited'/f;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(S/f,dest)
save('inherited-inputs.json',[{'source':str(S/f),'path':str(Path('inherited')/f),'sha256':h(S/f)} for f in copy])
w=json.loads((S/'windows.json').read_text());save('windows.json',{n:w[n] for n in ['43','45']})
# Only 2x3 tiles per facility around all fit/check points and representative point.
retr=json.loads((S/'retrievals.json').read_text());rr=[]
for n,xrange,yrange in [('43',range(2,4),range(1,3)),('45',range(1,4),range(1,4))]:
 for dx in xrange:
  for dy in yrange:
   name=f'{n}-seamlessphoto-18-{w[n]["x0"]+dx}-{w[n]["y0"]+dy}.jpg';src=S/'raw'/name
   r=next(r for r in retr if r.get('path')==str(src));assert h(src)==r['sha256']
   shutil.copyfile(src,O/'raw'/name);rr.append({**r,'inheritedPath':r['path'],'path':f'raw/{name}'})
 im=Image.new('RGB',(1280,1280),'white')
 for r in rr:
  if Path(r['path']).name.startswith(n+'-'):
   a=Path(r['path']).stem.split('-');x,y=map(int,a[-2:]);im.paste(Image.open(O/r['path']),((x-w[n]['x0'])*256,(y-w[n]['y0'])*256))
 im.save(O/f'{n}-photo-reference.png')
save('photo-retrievals.json',rr)
save('metadata-retrievals.json',[r for r in retr if Path(r.get('path','')).name in ['43-spec.geojson','45-spec.geojson']])
r=[]
for name,url in [('gsi-tiles.html','https://maps.gsi.go.jp/development/ichiran.html'),('gsi-terms.html','https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html'),('pdl.html','https://www.digital.go.jp/resources/open_data/public_data_license_v1.0')]:
 with urllib.request.urlopen(url,timeout=30,context=ctx) as res:
  p=O/'raw'/name;p.write_bytes(res.read());r.append(dict(path=f'raw/{name}',url=url,retrievedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),sha256=h(p),status=res.status))
save('terms-retrievals.json',r)
v=json.loads((S/'georef-inputs.json').read_text());new={}
ref={'43':[[810,520],[671,510],[848,746],[650,741]],'45':[[684,392],[796,601]]}
checks={'43':[[[422,255],[801,416],'既存建物東側折れ'],[[190,462],[681,472],'既存建物西側南寄り凹角']], '45':[[[345,75],[429,619],'北西道路屈曲（未使用）'],[[349,650],[606,789],'南西アクセス路と南東道路の接続（未使用）']]}
for n in ['43','45']:
 old=v[n];new[n]={k:old[k] for k in ['method','target','outline']};new[n]['sourceImage']='inherited/'+old['image'];new[n]['referenceImage']=f'{n}-photo-reference.png';new[n]['control']=[[p,ref[n][i],l] for i,(p,q,l) in enumerate(old['control'])];new[n]['check']=checks[n];new[n]['referenceReading']='GSI写真の画素を今回独自に目視読取。旧標準地図のreference画素値・変換行列は不使用。図面側の対応点・代表点・モデルは継承。'
save('georef-inputs.json',new)
print('prepared',len(rr),'photo tiles; 3 official terms pages')
