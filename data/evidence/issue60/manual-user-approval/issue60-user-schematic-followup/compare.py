import math,json,hashlib,pathlib,shutil
from PIL import Image,ImageDraw
from shapely.geometry import shape,Point
O=pathlib.Path('/tmp/issue60-user-schematic-followup');R=pathlib.Path('/home/akihiro/personal/manhole-card-map')
def xy(lat,lng,z,x,y,e=256):return (((lng+180)/360*2**z-x)*e,((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z-y)*e)
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
inputs=[]
def record(p):
 p=pathlib.Path(p);inputs.append({'path':str(p),'sha256':digest(p)});return p
sources=[('6','c82d9773-3bef-42f3-8aa1-911112782743'),('11','3e3d0d7a-90c7-403b-b5b6-69a180566941'),('19','1869960b-734f-4cfe-9802-06b0596cdf2d')]
for n,s in sources:
 p=record('/home/akihiro/.t3/userdata/attachments/fb63a4cd-1c0e-4a8f-b4bd-a3badad279dc-'+s+'.png');shutil.copyfile(p,O/(n+'-user-schematic.png'))
p=record(R/'data/evidence/kanto-prefecture/kanagawa/peninsula/kinugasa-comparison.json');d=json.loads(p.read_text());t=d['rows'][0]['baseTile'];scale=2*math.pi*6378137*math.cos(math.radians(35.25792))/(2**t['z']*4096)
res=[]
for label,lat,lng in [('latest',35.25792,139.66228),('previous-east',35.25791,139.66228),('reported-police',35.25791,139.66216)]:
 q=Point(xy(lat,lng,**t,e=4096));rows=[]
 for row in d['rows']:
  f=row['feature'];g=shape(f['geometry']);rows.append({'index':f['sourceFeatureIndex'],'inside':g.contains(q),'distanceM':round(g.distance(q)*scale,3),'boundaryM':round(g.boundary.distance(q)*scale,3)})
 res.append({'label':label,'coordinate':[lat,lng],'pointXY':list(q.coords)[0],'rows':rows})
im=Image.new('RGB',(900,900),'white');dr=ImageDraw.Draw(im);q=Point(res[0]['pointXY']);fac=12*scale
trans=lambda p:((p[0]-q.x)*fac+450,(p[1]-q.y)*fac+450)
for row in d['rows']:
 f=row['feature'];g=shape(f['geometry']);dr.polygon([trans(v) for v in g.exterior.coords],fill='#dce8ed',outline='black');c=g.representative_point();dr.text(trans((c.x,c.y)),str(f['sourceFeatureIndex']),fill='black')
for r,col in zip(res,['red','orange','blue']):
 x,y=trans(r['pointXY']);dr.ellipse((x-4,y-4,x+4,y+4),outline=col,width=2);dr.text((x+7,y-12),r['label'],fill=col)
dr.text((10,10),'No11: GSI saved footprints; north up; no identity inferred from point alone',fill='black');im.save(O/'11-latest-comparison.png')
(O/'11-calculation.json').write_text(json.dumps(res,ensure_ascii=False,indent=2)+'\n')
p=record('/tmp/issue60-recheck-chiba-nov6/togane-seamlessphoto.png');record('/tmp/issue60-recheck-chiba-nov6/raster-frames.json');im=Image.open(p).convert('RGB');dr=ImageDraw.Draw(im);points=[]
for label,lat,lng,col in [('latest',35.57685,140.38330,'red'),('previous',35.57715,140.38405,'cyan')]:
 x,y=xy(lat,lng,18,233295,103318);points.append({'label':label,'lat':lat,'lng':lng,'pixel':[x,y]});dr.ellipse((x-5,y-5,x+5,y+5),outline=col,width=2);dr.text((x+8,y),label,fill=col)
im.save(O/'19-latest-comparison.png');(O/'19-calculation.json').write_text(json.dumps({'frame':{'z':18,'x':233295,'y':103318,'tileSize':256},'points':points},indent=2)+'\n')
for p in ['/tmp/issue60-flare-followup/layout.pdf','/tmp/issue60-flare-followup/layout.png','/tmp/issue60-flare-followup/current-exterior.jpg','/tmp/issue60-recheck-third-other/raw/11-map.pdf','/tmp/issue60-recheck-third-other/11-map.png',R/'data/evidence/issue60/kinugasa-followup/original/kanagawa/kinugasa-center.jpg','/tmp/issue60-recheck-chiba-nov6/togane-map.jpg','/tmp/issue60-recheck-chiba-nov6/togane-air.jpg','/tmp/issue60-recheck-chiba-nov6/asset-retrievals.json','/tmp/issue60-recheck-chiba-nov6/raster-retrievals.json','/tmp/issue60-recheck-third-other/retrievals-register.json','/tmp/issue60-flare-followup/followup.json',R/'data/evidence/kanto-prefecture/tokyo/outer/flare-reading.json']:
 record(p)
(O/'input-hashes.json').write_text(json.dumps(inputs,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(res,ensure_ascii=False));print(points)
