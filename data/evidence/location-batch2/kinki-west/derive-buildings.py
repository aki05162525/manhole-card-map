"""Reproduce proposed building points from frozen GSI geometries; not approval.
Run: mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python -B data/evidence/location-batch2/kinki-west/derive-buildings.py
"""
import gzip,hashlib,json,math
from pathlib import Path
from mapbox_vector_tile import decode
from shapely.geometry import shape,Polygon,Point
ROOT=Path(__file__).resolve().parents[4]; E=Path(__file__).resolve().parent
spec=json.loads((E/'building-inputs.json').read_text()); output=[]
for row in spec['rows']:
    tile=row['tile'];data=(ROOT/tile['path']).read_bytes();assert hashlib.sha256(data).hexdigest()==tile['sha256']
    layer=decode(gzip.decompress(data),default_options={'y_coord_down':True})['BldA'];assert layer['extent']==row['extent']
    feature=layer['features'][row['featureIndex']];assert feature==row['feature']
    full=shape(feature['geometry']);assert full.is_valid
    if row['method']=='identified-wing-centroid':
        # Named wing in municipal plan. Use existing perimeter vertices, close the
        # cut across its narrow connection to the northeast main building.
        ring=feature['geometry']['coordinates'][0]
        selected=Polygon(ring[row['wingVertexStart']:row['wingVertexEndInclusive']+1])
        assert full.covers(selected)
    else:
        assert row['method']=='footprint-centroid';selected=full
    assert selected.is_valid and selected.area>0
    pt=selected.centroid;assert selected.contains(pt) and full.contains(pt)
    z,x,y=tile['z'],tile['x'],tile['y'];ext=layer['extent']
    lng=(x+pt.x/ext)/2**z*360-180
    lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*(y+pt.y/ext)/2**z))))
    coordinate={'lat':round(lat,7),'lng':round(lng,7)}
    rp=Point(((coordinate['lng']+180)/360*2**z-x)*ext,((1-math.asinh(math.tan(math.radians(coordinate['lat'])))/math.pi)/2*2**z-y)*ext)
    assert selected.contains(rp) and full.contains(rp)
    output.append(dict(facilityId=row['facilityId'],coordinate=coordinate,method=row['method'],selectedGeometry=selected.__geo_interface__,tilePoint=[pt.x,pt.y],valid=True,centroidWithin=True,roundedPointWithin=True,withinOriginalFootprint=True))
print(json.dumps({'schema':1,'rows':output},ensure_ascii=False,indent=2))
