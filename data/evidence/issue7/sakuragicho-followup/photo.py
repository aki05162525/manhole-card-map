import pathlib,math,gzip,xml.etree.ElementTree as E
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image
D=pathlib.Path(__file__).resolve().parent
fig,ax=plt.subplots(figsize=(14,14))
def xy(lon,lat):return ((lon+180)/360*2**18*256,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**18*256)
ox,oy=xy(139.6312274,35.4511374)
for p in D.glob('photo-*.jpg'):
 _,z,x,y=p.stem.split('-');x=int(x)*256;y=int(y)*256
 ax.imshow(Image.open(p),extent=(x-ox,x+256-ox,oy-y-256,oy-y))
G='{http://www.opengis.net/gml}';B='{http://www.opengis.net/citygml/building/2.0}'
r=E.fromstring(gzip.decompress((D.parent/'sakuragicho/53391540.gml.gz').read_bytes()))
for b in r.findall('.//'+B+'Building'):
 pos=b.find('.//'+B+'lod0FootPrint//'+G+'posList')
 if pos is None:continue
 v=list(map(float,pos.text.split()));coords=[xy(lon,lat) for lat,lon in zip(v[::3],v[1::3])]
 if not any(abs(x-ox)<450 and abs(y-oy)<450 for x,y in coords):continue
 ax.plot([x-ox for x,y in coords],[oy-y for x,y in coords],c='yellow',lw=.6)
ax.scatter([0],[0],c='red',s=35);ax.text(8,0,'J47',c='red');ax.set_xlim(-350,350);ax.set_ylim(-400,300);ax.set_title('GSI seamlessphoto + Yokohama PLATEAU LOD0; north up')
fig.savefig(D/'photo-overlay.png',dpi=180)
