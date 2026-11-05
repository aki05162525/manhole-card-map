"""Decode saved GSI tiles, clip their buffers, union footprints, and measure.
uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 --with pyproj==3.7.2 --with matplotlib python <script>
Outputs exploratory metrics/figures to ignored work. Geometry selection is reviewed separately.
"""
import gzip,hashlib,json,math
from pathlib import Path
from mapbox_vector_tile import decode
from shapely.geometry import shape,box,Point,mapping
from shapely.ops import unary_union,transform
from shapely.affinity import translate
from pyproj import CRS,Transformer
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.path import Path as PlotPath
from matplotlib.patches import PathPatch
from shapely.geometry.polygon import orient
E=Path(__file__).resolve().parent; ROOT=E.parents[3]; W=ROOT/'data/work/location-batch2/kyushu-okinawa/recheck';W.mkdir(exist_ok=True)
spec=json.loads((E/'recheck-tiles.json').read_text());results={}
for name,(lat,lon) in spec['hints'].items():
 local=CRS.from_proj4(f'+proj=aeqd +lat_0={lat} +lon_0={lon} +ellps=GRS80 +units=m +no_defs'); tr=Transformer.from_crs('EPSG:6668',local,always_xy=True);inv=Transformer.from_crs(local,'EPSG:6668',always_xy=True)
 def geographic(x,y,z=None):
  return x/(4096*65536)*360-180,math.degrees(math.atan(math.sinh(math.pi*(1-2*y/(4096*65536)))))
 def tolocal(x,y,z=None):return tr.transform(*geographic(x,y))
 polys=[];context=[];sources=[]
 for row in spec['rows']:
  if row['area']!=name:continue
  raw=(E/row['file']).read_bytes();assert hashlib.sha256(raw).hexdigest()==row['sha256'];layers=decode(gzip.decompress(raw),default_options={'y_coord_down':True});tx,ty=row['tile']['x'],row['tile']['y'];extent=4096
  for layer in ['BldA','RdEdg','WA','WL']:
   if layer not in layers:continue
   assert layers[layer]['extent']==extent
   for index,f in enumerate(layers[layer]['features']):
    g=shape(f['geometry']);assert g.is_valid
    # Clip MVT buffer to its own tile before union; adjacent fragments then share exact edge coordinates.
    g=g.intersection(box(0,0,extent,extent));g=translate(g,tx*extent,ty*extent)
    if g.is_empty:continue
    if layer=='BldA':polys.append(g);sources.append({'file':row['file'],'featureIndex':index,'properties':f['properties'],'geometry':mapping(g)})
    else:context.append((layer,g))
 merged=unary_union(polys);buildings=sorted([g for g in merged.geoms if transform(tolocal,g).distance(Point(0,0))<155],key=lambda g:(g.centroid.x,g.centroid.y))
 fig,ax=plt.subplots(figsize=(11,11));out=[]
 for layer,g in context:
  m=transform(tolocal,g)
  if not m.intersects(box(-180,-180,180,180)):continue
  gs=list(m.geoms) if hasattr(m,'geoms') else [m]
  for part in gs:
   if part.geom_type=='Polygon':ax.fill(*part.exterior.xy,color='#d6efff',zorder=0)
   elif part.geom_type=='LineString':ax.plot(*part.xy,color='#82bed8' if layer=='WL' else '#aaaaaa',lw=.6,zorder=0)
 for i,g in enumerate(buildings):
  m=transform(tolocal,g);c=m.centroid;rp=m.representative_point();p=c if m.contains(c) else rp;lng,lt=inv.transform(p.x,p.y);co={'lat':round(lt,7),'lng':round(lng,7)};rounded=Point(*tr.transform(co['lng'],co['lat']));assert m.contains(rounded)
  oriented=orient(m,sign=1)
  rings=[oriented.exterior]+list(oriented.interiors)
  paths=[PlotPath(list(ring.coords),[PlotPath.MOVETO]+[PlotPath.LINETO]*(len(ring.coords)-2)+[PlotPath.CLOSEPOLY]) for ring in rings]
  ax.add_patch(PathPatch(PlotPath.make_compound_path(*paths),facecolor='#e2d6bf',edgecolor='#555',lw=.5))
  ax.text(rp.x,rp.y,f'{i}\n{m.area:.0f}',fontsize=7,ha='center',va='center')
  pieces=[r for r in sources if shape(r['geometry']).intersection(g).area>0]
  out.append({'index':i,'areaM2':m.area,'boundsMeters':list(m.bounds),'centroidMeters':[c.x,c.y],'geometry':mapping(g),'sourcePieces':pieces,'centroidWithin':m.contains(c),'method':'centroid' if m.contains(c) else 'representative_point','derivedCoordinate':co,'roundedPointWithin':True})
 ax.plot(0,0,'r+',label='search hint only');ax.set(xlim=(-180,180),ylim=(-180,180),xlabel='east metres',ylabel='north metres',title=name+' | JGD2011 local AEQD; source GSI optimal vector');ax.set_aspect('equal');ax.grid(alpha=.2);fig.savefig(W/(name+'-comparison.png'),dpi=150);plt.close(fig)
 results[name]={'hint':{'lat':lat,'lng':lon},'metricCRS':local.to_string(),'buildings':out}
(W/'comparisons.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print({k:len(v['buildings']) for k,v in results.items()})
