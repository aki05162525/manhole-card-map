exec(open('/tmp/issue60-recheck-third-other/fetch.py').read().split('r=list(')[0])
import math,io
from PIL import Image
frames={};urls={}
for n,lat,lng in [(30,35.814,139.6415),(36,36.0394,139.4212)]:
 z=18;x=int((lng+180)/360*2**z);y=int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z);frames[n]={'z':z,'x':x-1,'y':y-1}
 for dx in range(3):
  for dy in range(3):urls[f'{n}-photo-{dx}-{dy}.jpg']=f'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x-1+dx}/{y-1+dy}.jpg'
r=list(concurrent.futures.ThreadPoolExecutor(6).map(get,urls.items()));(O/'retrievals-aerial18.json').write_text(json.dumps(r,indent=2));(O/'aerial-frames.json').write_text(json.dumps(frames,indent=2))
for n in frames:
 im=Image.new('RGB',(768,768))
 for dx in range(3):
  for dy in range(3):im.paste(Image.open(O/'raw'/f'{n}-photo-{dx}-{dy}.jpg'),(dx*256,dy*256))
 im.save(O/f'{n}-aerial.png')
print('18 tiles assembled; imagery capture dates not established')
