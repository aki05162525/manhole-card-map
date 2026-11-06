from pathlib import Path
import json,hashlib,urllib.request
from shapely.geometry import shape,Point
O=Path(__file__).parent
receipt=json.load(open('data/evidence/issue60/human-answers-20261106/receipt.json'))
idx=json.load(open('data/national/issue76/remaining-index-after-twelve.json'))
rows=[r for r in receipt['answers']if r['number'] in [7,13,14,40,41]]
(O/'identity.json').write_text(json.dumps({'receiptRows':rows,'remainingIndexTopKeys':list(idx) if isinstance(idx,dict)else None,'historicalIndexCaution':'latest /tmp assessments and user corrections override unresolvedReason strings'},ensure_ascii=False,indent=2))
raws=['data/evidence/issue60/human-answers-20261106/receipt.json','data/national/issue76/remaining-index-after-twelve.json','data/evidence/issue60/human-answers-20261106/round2/shiraoka-position-evidence.json','data/evidence/kanto-prefecture/tokyo/east/connect-comparison.json','data/evidence/kanto-prefecture/kanagawa/north/miura-followup/nearby-geometries.json','data/evidence/kanto-prefecture/kanagawa/north/miura-followup/observation.json','/tmp/issue60-recheck-six/kanagawa/assessment.json','/tmp/issue60-recheck-north-final-nov6/assessment.json','/tmp/issue60-shiraoka-followup/layout.jpg','/tmp/issue60-shiraoka-followup/report.md','docs/verification/issue76-common.md']
(O/'input-hashes.json').write_text(json.dumps([{'path':p,'sha256':hashlib.sha256(Path(p).read_bytes()).hexdigest()}for p in raws],indent=2))
pts={7:(35.71043,139.80579),13:(35.18845,139.6533),14:(35.4338,139.43125),40:(36.017642,139.677572),41:(36.1947,139.7096)}
spec={}
for n,(lat,lon) in pts.items():
 j=json.load(open(O/f'raw/{n}-photo-spec.geojson'));spec[n]=[f['properties'] for f in j['features'] if shape(f['geometry']).covers(Point(lon,lat))]
(O/'photo-editions.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2))
u='https://web.archive.org/web/20250000000000im_/https://www.jreast.co.jp/estation/stations/img/floormap/0676_1f-2f.png'
try:
 r=urllib.request.urlopen(urllib.request.Request(u,method='HEAD'),timeout=25);(O/'41-archive-redirect.json').write_text(json.dumps({'requestedURL':u,'finalURL':r.url,'headers':dict(r.headers)},indent=2));print(r.url)
except Exception as e:print(e)
print('IDs',[(r['number'],r['facilityId'])for r in rows])
