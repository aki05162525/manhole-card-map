import gzip,json,pathlib,xml.etree.ElementTree as E
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from shapely.geometry import Polygon,Point
from pyproj import Transformer
D=pathlib.Path(__file__).resolve().parent
S=D.parent/'sakuragicho'
G='{http://www.opengis.net/gml}';B='{http://www.opengis.net/citygml/building/2.0}'
r=E.fromstring(gzip.decompress((S/'53391540.gml.gz').read_bytes()))
f=Transformer.from_crs(6668,6677,always_xy=True)
p=Point(f.transform(139.6312274,35.4511374)); ox,oy=p.x,p.y
fig,ax=plt.subplots(figsize=(12,12));rows=[]
for b in r.findall('.//'+B+'Building'):
 pos=b.find('.//'+B+'lod0FootPrint//'+G+'posList')
 if pos is None:continue
 v=list(map(float,pos.text.split()));poly=Polygon([f.transform(lon,lat) for lat,lon in zip(v[::3],v[1::3])])
 if poly.distance(p)>160:continue
 x,y=poly.exterior.xy;ax.fill([t-ox for t in x],[t-oy for t in y],color='lightgray',alpha=.5);ax.plot([t-ox for t in x],[t-oy for t in y],color='black',lw=1)
 if b.get(G+'id')!='bldg_4149036a-f412-4dc8-a472-5a740921f2ed':continue
 for i,s in enumerate(b.findall('.//'+B+'RoofSurface')):
  for pos in s.findall('.//'+G+'exterior//'+G+'posList'):
   v=list(map(float,pos.text.split()));q=Polygon([f.transform(lon,lat) for lat,lon in zip(v[::3],v[1::3])]);x,y=q.exterior.xy
   if q.area<.1:continue
   ax.fill([t-ox for t in x],[t-oy for t in y],alpha=.35)
   c=q.centroid;ax.text(c.x-ox,c.y-oy,str(i),fontsize=6)
   rows.append({'index':i,'id':s.get(G+'id'),'area':q.area,'distance':q.distance(p),'zMin':min(v[2::3]),'zMax':max(v[2::3]),'coordinatesLatLngHeight':list(zip(v[::3],v[1::3],v[2::3]))})
ax.scatter([0],[0],c='red',s=40,label='JAPAN47GO published office point');ax.set_aspect('equal');ax.set_xlim(-125,125);ax.set_ylim(-160,160);ax.grid();ax.legend();ax.set_xlabel('East (m), origin = published office point');ax.set_ylabel('North (m)');fig.savefig(D/'plateau-roofs.png',dpi=180)
(D/'roof-analysis.json').write_text(json.dumps(rows,indent=2)+'\n')
print(json.dumps(sorted(rows,key=lambda x:x['distance'])[:8],indent=2))
