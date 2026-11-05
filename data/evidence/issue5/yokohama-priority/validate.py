import json,pathlib,hashlib,gzip,xml.etree.ElementTree as E,zipfile,datetime,math,re
import pyproj
from shapely.geometry import Polygon,Point
D=pathlib.Path(__file__).resolve().parent.relative_to(pathlib.Path.cwd())
read=lambda p:json.loads(pathlib.Path(p).read_text())
rows=read(D/'fetch-records.json')+read(D/'reused-sources.json');checks=[]
for r in rows:
 raw=pathlib.Path(r['snapshotPath']).read_bytes()
 assert hashlib.sha256(raw).hexdigest()==r['snapshotSHA256'],r['snapshotPath']
 if 'uncompressedResponseSHA256' in r: assert hashlib.sha256(gzip.decompress(raw)).hexdigest()==r['uncompressedResponseSHA256']
 checks.append({'path':r['snapshotPath'],'sha256':r['snapshotSHA256'],'ok':True})
result=read('data/national/issue5/yokohama-priority.json');assert len(result['updates'])==1 and not result['unresolved']
u=result['updates'][0];assert u['facilityId']=='facility:kanto-south-4ecb948da292cb16373b' and u['scope']=='building'
keys=set(re.findall(r'json:"([^"]+)"',pathlib.Path('cmd/builddata/ledger.go').read_text().split('type Evidence struct {')[1].split('}')[0]))
assert set(u['evidence'])==keys
assert any(r['snapshotSHA256']==u['evidence']['snapshotSHA256'] and r['sourceUrl']==u['evidence']['sourceUrl'] for r in rows)
r=E.fromstring(gzip.decompress((D/'53391459.gml.gz').read_bytes()));G='{http://www.opengis.net/gml}';B='{http://www.opengis.net/citygml/building/2.0}'
b=next(b for b in r.findall('.//'+B+'Building') if b.get(G+'id')=='bldg_1754b772-2d39-48d3-9eb2-c5f0d933215a')
assert next(e.text for e in b.iter() if e.tag.endswith('}buildingID'))=='14100-bldg-120521'
assert r.find('.//'+G+'Envelope').get('srsName').endswith('/6697')
coords=b.findall('.//'+B+'lod0FootPrint//'+G+'posList');assert len(coords)==1
assert not b.findall('.//'+B+'lod0FootPrint//'+G+'interior')
a=list(map(float,coords[0].text.split()));f=pyproj.Transformer.from_crs(6668,6677,always_xy=True);inv=pyproj.Transformer.from_crs(6677,6668,always_xy=True)
xy=[f.transform(a[j+1],a[j]) for j in range(0,len(a),3)];poly=Polygon(xy);assert poly.is_valid
# Independent centroid via shoelace formula, translated locally to avoid cancellation.
x0,y0=xy[0];q=[(x-x0,y-y0) for x,y in xy];cross=[x*v-u*y for (x,y),(u,v) in zip(q,q[1:])];area2=sum(cross)
cx=x0+sum((q[j][0]+q[j+1][0])*v for j,v in enumerate(cross))/(3*area2)
cy=y0+sum((q[j][1]+q[j+1][1])*v for j,v in enumerate(cross))/(3*area2)
assert math.hypot(cx-poly.centroid.x,cy-poly.centroid.y)<1e-7
assert poly.contains(Point(cx,cy));lng,lat=inv.transform(cx,cy)
assert u['coordinate']=={'lat':round(lat,7),'lng':round(lng,7)}
assert poly.contains(Point(*f.transform(u['coordinate']['lng'],u['coordinate']['lat'])))
with zipfile.ZipFile(D/'metadata.zip') as z:
 meta=E.fromstring(z.read('metadata\\udx_14100_city_2024_op.xml'))
 assert any(e.text=='Licensed under CC BY 4.0' for e in meta.iter() if e.tag.endswith('}useLimitation'))
for row in read(D/'reused-sources.json'):
 if 'manholecard' in row['sourceUrl'] or 'stationcity' in row['sourceUrl']:
  s=pathlib.Path(row['snapshotPath']).read_text();assert '横浜タワー' in s and '観光案内所' in s
old=read('data/national/issue5/south-kanto.json');assert any(x['facilityId']==u['facilityId'] for x in old['unresolved'])
validation={'validatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'ok':True,'sourceHashes':checks,'evidenceKeys':sorted(keys),'independentCentroid':{'lat':lat,'lng':lng},'centroidInside':True,'roundedPointInside':True,'CCBYMetadata':True,'existingSouthKantoStillUnresolved':True,'note':'機械検証は資料照合の意味・法的適用判断を自動保証しない。配置図目視の判断はREADME参照。'}
(D/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
print('PASS: 1 candidate; source hashes, archival decompression, Go Evidence fields, original building polygon, independent centroid and containment, CC BY metadata')
