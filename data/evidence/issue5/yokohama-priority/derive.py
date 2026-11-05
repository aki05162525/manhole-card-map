import gzip,json,pathlib,xml.etree.ElementTree as E
import pyproj,shapely
from shapely.geometry import Polygon
D=pathlib.Path(__file__).resolve().parent.relative_to(pathlib.Path.cwd())
G='{http://www.opengis.net/gml}';B='{http://www.opengis.net/citygml/building/2.0}'
ID='bldg_1754b772-2d39-48d3-9eb2-c5f0d933215a'
r=E.fromstring(gzip.decompress((D/'53391459.gml.gz').read_bytes()))
b=next(b for b in r.findall('.//'+B+'Building') if b.get(G+'id')==ID)
a=list(map(float,b.find('.//'+B+'lod0FootPrint//'+G+'posList').text.split()))
vertices=[a[i:i+3] for i in range(0,len(a),3)]
f=pyproj.Transformer.from_crs(6668,6677,always_xy=True)
i=pyproj.Transformer.from_crs(6677,6668,always_xy=True)
p=Polygon([f.transform(lon,lat) for lat,lon,z in vertices])
assert p.is_valid and not p.interiors and p.contains(p.centroid)
lon,lat=i.transform(p.centroid.x,p.centroid.y)
result={'gmlId':ID,'buildingId':'14100-bldg-120521','sourceCRS':r.find('.//'+G+'Envelope').get('srsName'),'horizontalCRS':'EPSG:6668 JGD2011','calculationCRS':'EPSG:6677 JGD2011 / Japan Plane Rectangular CS IX','method':'lod0FootPrint exterior (lat,lon,height), discard height; project horizontal to EPSG:6677; area centroid; inverse project EPSG:6668. No WGS84 datum conversion.','originalVerticesLatLonHeight':vertices,'projectedCentroidXY':[p.centroid.x,p.centroid.y],'areaM2':p.area,'centroidWithinFootprint':p.contains(p.centroid),'coordinateUnrounded':{'lat':lat,'lng':lon},'coordinate':{'lat':round(lat,7),'lng':round(lon,7)},'software':{'pyproj':pyproj.__version__,'PROJ':pyproj.proj_version_str,'shapely':shapely.__version__},'forwardOperation':f.description,'inverseOperation':i.description}
(D/'derived-point.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
