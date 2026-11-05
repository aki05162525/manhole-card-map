import json,math,pathlib
from PIL import Image,ImageDraw,ImageFont
from shapely.geometry import shape
D=pathlib.Path('data/work/location-batch2/north-kanto');font=ImageFont.truetype('/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf',14)
def xy(lon,lat):return ((lon+180)/360*65536*4096,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*65536*4096)
for name,lat,lon,width in [('hitachi',36.599,140.6505,650),('hanyu',36.172,139.602,350),('kumagaya',36.139,139.389,650),('shiraoka',36.019,139.677,650),('yaita',36.794,139.917,650),('tsuchiura',36.083,140.197,500)]:
 fs=json.loads((D/f'{name}-features.json').read_text());cx,cy=xy(lon,lat);units=width/(40075016.686*math.cos(math.radians(lat))/(65536*4096));scale=1400/units
 def point(p,f):return ((f['tile'][1]*4096+p[0]-cx)*scale+700,(f['tile'][2]*4096+p[1]-cy)*scale+700)
 im=Image.new('RGB',(1400,1400),'white');dr=ImageDraw.Draw(im);labels=[];ids=[]
 for layer in ['WA','WL','RdEdg','RdCL','BldA','Anno']:
  for n,f in enumerate(fs):
   if f['layer']!=layer:continue
   g=f['geometry'];t=g['type'];coords=g['coordinates'];color={'WA':'#bce8ff','WL':'#269ddd','RdEdg':'#888888','RdCL':'#cccccc','BldA':'#ffdfae','Anno':'black'}[layer]
   if t in ['Polygon','MultiPolygon']:
    for poly in ([coords] if t=='Polygon' else coords):
     ps=[point(p,f) for p in poly[0]];dr.polygon(ps,fill=color,outline='#666666')
     for hole in poly[1:]:dr.polygon([point(p,f) for p in hole],fill='white')
    if layer=='BldA':
     c=shape(g).representative_point();pp=point([c.x,c.y],f)
     if 0<pp[0]<1400 and 0<pp[1]<1400:labels.append((pp,str(n)));ids.append(dict(renderId=n,feature=f))
   elif t in ['LineString','MultiLineString']:
    for line in ([coords] if t=='LineString' else coords):dr.line([point(p,f) for p in line],fill=color,width=2)
   elif t=='Point' and layer=='Anno':
    namep=f['properties'].get('vt_text','');pp=point(coords,f)
    if namep and 0<pp[0]<1400 and 0<pp[1]<1400:labels.append((pp,str(namep)))
 for pos,txt in labels:dr.text(pos,txt,fill='black',font=font,stroke_width=1,stroke_fill='white')
 dr.text((10,10),f'{name} / north up / {width}m approx. / GSI optimal vector processed',fill='black',font=font);im.save(D/f'{name}-comparison.png');(D/f'{name}-render-ids.json').write_text(json.dumps(ids,ensure_ascii=False,indent=2))
