"""Offline north-up comparison views. Requires mapbox-vector-tile==2.2.0 matplotlib==3.10.8.
Source: 国土地理院最適化ベクトルタイル; processed by manhole-card-map (PDL1.0).
"""
import gzip,json,math
from pathlib import Path
from mapbox_vector_tile import decode
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT=Path(__file__).resolve().parents[4]; E=Path(__file__).resolve().parent; W=ROOT/'data/work/location-batch2/kinki-west/revision'
spec=json.loads((E/'footprint-tiles.json').read_text())
for name,(lng,lat) in spec['searchHintsOnly'].items():
    fig,ax=plt.subplots(figsize=(11,11)); rows=[]
    scale=math.cos(math.radians(lat))*2*math.pi*6378137/2**16
    hx=(lng+180)/360*2**16;hy=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**16
    for tile in [r for r in spec['rows'] if r['name']==name]:
        layers=decode(gzip.decompress((ROOT/tile['path']).read_bytes()),default_options={'y_coord_down':True})
        for layername in ['RdEdg','BldA']:
            layer=layers.get(layername,{'features':[],'extent':4096});ext=layer['extent']
            for i,f in enumerate(layer['features']):
                typ=f['geometry']['type'];coords=f['geometry']['coordinates']
                lines=[coords] if typ=='LineString' else coords if typ in ['Polygon','MultiLineString'] else [ring for poly in coords for ring in poly] if typ=='MultiPolygon' else []
                for ring in lines:
                    xx=[(tile['x']+p[0]/ext-hx)*scale for p in ring]; yy=[-(tile['y']+p[1]/ext-hy)*scale for p in ring]
                    ax.plot(xx,yy,color='#909090' if layername=='RdEdg' else '#0044aa',linewidth=.7)
                if layername=='BldA' and lines:
                    cx=sum(p[0] for p in lines[0])/len(lines[0]);cy=sum(p[1] for p in lines[0])/len(lines[0]); px=(tile['x']+cx/ext-hx)*scale;py=-(tile['y']+cy/ext-hy)*scale
                    label=f"{tile['x']%100}-{tile['y']%100}:{i}"
                    if abs(px)<210 and (-260 if name=='kashiwara' else -100)<py<(80 if name=='kashiwara' else 100): ax.text(px,py,label,fontsize=6,color='darkred',clip_on=True)
                    rows.append(dict(label=label,tile=tile,featureIndex=i,feature=f,extent=ext))
    bspec=json.loads((E/'building-inputs.json').read_text())
    derived=json.loads((E/'derived-buildings.json').read_text())
    brow=next(r for r in bspec['rows'] if r['name']==name)
    drow=next(r for r in derived['rows'] if r['facilityId']==brow['facilityId'])
    t=brow['tile'];ext=brow['extent']
    ring=drow['selectedGeometry']['coordinates'][0]
    ax.fill([(t['x']+p[0]/ext-hx)*scale for p in ring],[-(t['y']+p[1]/ext-hy)*scale for p in ring],color='lime',alpha=.35)
    p=drow['tilePoint'];ax.plot((t['x']+p[0]/ext-hx)*scale,-(t['y']+p[1]/ext-hy)*scale,'ro')
    ax.set(xlim=((-100,150) if name=='kashiwara' else (-130,90)),ylim=((-260,80) if name=='kashiwara' else (-100,100)),aspect='equal',xlabel='metres east of search hint',ylabel='metres north of search hint',title=name+' | GSI optimal vector (2026-07-01) | north up')
    ax.grid(alpha=.2);fig.tight_layout();fig.savefig(W/f'{name}-footprints.png',dpi=150);plt.close(fig)
    (W/f'{name}-features.json').write_text(json.dumps(rows))
