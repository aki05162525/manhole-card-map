"""Reproduce studies directly from retained PBF; never select a facility pin.
Default checks committed output; --write records derived research facts.
Dependencies and CRS limitations: README.md.
"""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path
from mapbox_vector_tile import decode
from shapely.geometry import shape, Point, Polygon, LineString

ROOT = Path(__file__).resolve().parents[4]
E = Path(__file__).parent

def read(path):
    return json.loads(path.read_text())

specs = read(E / 'vector-observations.json')['rows'] + read(E / 'recheck-vector-inputs.json')['rows']
layers = {}
for row in specs:
    raw = (ROOT / row['path']).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == row['sha256']
    assert len(raw) == row['bytes']
    layers[row['id']] = decode(gzip.decompress(raw), default_options={'y_coord_down': True})
    assert layers[row['id']]['BldA']['extent'] == row['extent'] == 4096
    assert len(layers[row['id']]['BldA']['features']) == row['buildingFeatures']

def geom(key, idx):
    return shape(layers[key]['BldA']['features'][idx]['geometry'])

def tile(key):
    return next(s['tile'] for s in specs if s['id'] == key)

def geographic(key, point):
    t = tile(key); n = 2**t['z']
    return {'lat': math.degrees(math.atan(math.sinh(math.pi*(1-2*(t['y']+point.y/4096)/n)))),
            'lng': (t['x']+point.x/4096)/n*360-180}

def local(key, c):
    t = tile(key); n = 2**t['z']; lat = math.radians(c['lat'])
    return Point(((c['lng']+180)/360*n-t['x'])*4096,
                 ((1-math.asinh(math.tan(lat))/math.pi)/2*n-t['y'])*4096)

def study(key, idx, indices, other_indices, name, floors):
    whole = geom(key, idx); ring = list(whole.exterior.coords)
    part = Polygon([ring[i] for i in indices]); other = Polygon([ring[i] for i in other_indices])
    assert part.is_valid and whole.covers(part) and whole.covers(other)
    centroid = part.centroid
    # If centroid were outside/inside a hole, do not silently use it.
    assert part.contains(centroid)
    c = geographic(key, centroid); rounded = {k:round(v,6) for k,v in c.items()}
    p = local(key, rounded)
    scale = math.cos(math.radians(c['lat']))*2*math.pi*6378137/(2**tile(key)['z']*4096)
    return {'id':name,'tileId':key,'featureIndex':idx,'wholeGeometry':layers[key]['BldA']['features'][idx]['geometry'],
            'partVertexIndices':indices,'otherPartVertexIndices':other_indices,
            'partGeometry':{'type':'Polygon','coordinates':[[list(p) for p in part.exterior.coords]]},
            'centroidLocal':[centroid.x,centroid.y], 'geographicCandidate':c,'roundedCandidate':rounded,
            'centroidInsidePart':part.contains(centroid),'roundedInsidePart':part.contains(p),
            'roundedInsideWhole':whole.contains(p),'roundedBoundaryClearanceApproxMetres':round(part.boundary.distance(p)*scale,3),
            'partAreaApproxSquareMetres':round(part.area*scale**2,2),
            'otherPartAreaApproxSquareMetres':round(other.area*scale**2,2),
            'publishedFloorAreasSquareMetres':floors,
            'measurementNote':'局所Mercator縮尺cos(latitude)補正の概算。屋根/描画外形と建築床面積は異なり一致を要求しない。棟境界の切断線は資料の細い渡廊下に対応する頂点間で明示。',
            'decision':'research-only; no manifest selection or lifecycle binding'}

sado = study('sado',31,[0,1,2,11,12,13,0],[3,4,5,6,7,8,9,10,3], 'sado-first',[1849.88,1075.76])
asahi = study('asahi-58167-25213',116,[0,1,2,3,14,15,16,17,18],[4,5,6,7,8,9,10,11,12,13,4], 'asahi-product',[940,419])
connector = LineString([geom('sado',29).centroid,geom('sado',31).centroid])
road_indices = [i for i,f in enumerate(layers['sado']['RdCL']['features']) if connector.intersects(shape(f['geometry']))]
assert road_indices
p05_path = ROOT / 'data/evidence/issue7/hokuriku/p05-leads.json'
leads = next(r['matches'] for r in read(p05_path) if r['facilityId'].endswith('9720552572da10795a23'))
p05 = []
for row in leads:
    if row['index'] not in [1193,1194,1215,1218]: continue
    lng,lat = row['feature']['geometry']['coordinates']; point=local('sawata',{'lat':lat,'lng':lng})
    p05.append({'sourceLocator':row['sourceLocator'],'name':row['feature']['properties']['P05_003'],
                'lng':lng,'lat':lat,'inside253':geom('sawata',253).contains(point)})
assert len(p05)==4 and all(r['inside253'] for r in p05)
result = {
 'schema':1,'source':'国土地理院最適化ベクトルタイルを加工。試験公開・基本測量成果ではない。',
 'crsNote':'XYZ Web Mercator格子から経緯度(lat/lng)へ逆変換。一般地理院タイル仕様はJGD2011だがoptbv_dataspec/attributeに測地系の明記なし。製品固有の適用確認は未解決。測地系変換なし。6小数は記録桁数で精度保証でない。',
 'sadoExcluded29':{'bounds':list(geom('sado',29).bounds),'bufferLimit':-80,'touchesBufferLimit':geom('sado',29).bounds[0]==-80,'roadSeparates':bool(road_indices),'intersectedRoadCenterlineIndices':road_indices,
                   'finding':'idx29は西側道路の向こう。minx=-39はbuffer=-80に達せず、タイル端に接することを切断とした旧判断を撤回。'},
 'representativeStudies':[sado,asahi],
 'sawataP05Source':{'path':str(p05_path.relative_to(ROOT)),'sha256':hashlib.sha256(p05_path.read_bytes()).hexdigest(),'retrieval':'既存Issue7抽出の再利用。今回の新規取得ではない。'},
 'sawataP05':p05,
 'fukui':{'tileId':'fukui-57579-25735','comparedFeatureIndices':[3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20],
          'positive':'公式広域図(新パンフ物理5頁)の川西岸・道路西側に南北に延びる復原町並と、Vectorの西側の列状外形(3–10,13–19)、南側11/12の建物群を比較。運営者guideは事務所を南入口、売店をその隣と説明する。',
          'negative':'パンフは複数建物を一括して復原町並と描き、売場・事務所・売店を個々の外形に付記しない。写真も受付棟の名付き全景ではない。11/12や列の端の10を窓口棟とする一意の対応は得られない。',
          'unresolved':'南入口にあることだけでは隣接する別棟を選べない。チケット売場を示す地理参照可能な配置図/建物対応が必要。入口そのものの測量は不要。'}
}
parser=argparse.ArgumentParser();parser.add_argument('--write',action='store_true');args=parser.parse_args()
path=E/'building-comparisons.json'
if args.write: path.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
else: assert read(path)==result, 'derived comparison changed'
print(json.dumps({'checkedTiles':len(specs),'studies':[(r['id'],r['roundedCandidate'],r['partAreaApproxSquareMetres'],r['otherPartAreaApproxSquareMetres']) for r in result['representativeStudies']], 'p05Inside253':len(p05)},ensure_ascii=False))
