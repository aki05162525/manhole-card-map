"""Regenerate investigation and validate immutable inputs. Run from repository root.
uv run --with shapely==2.2.0 --with pyproj==3.8.0 python data/evidence/issue7/sakuragicho/build.py
"""
import gzip, hashlib, io, json, pathlib, re, zipfile
import xml.etree.ElementTree as E
from shapely.geometry import Polygon, Point
from pyproj import Transformer

D = pathlib.Path(__file__).resolve().parent.relative_to(pathlib.Path.cwd())
FID = 'facility:kanto-south-7d5b518b29440ef8d976'
def read(p): return json.loads(pathlib.Path(p).read_text())
def sha(p): return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def write(p, x): pathlib.Path(p).write_text(json.dumps(x, ensure_ascii=False, indent=2)+'\n')

for p,h in read(D/'input-hashes.json').items(): assert sha(p)==h, p
for p,h in read('data/work/issue7-baseline/hashes.json').items():
    assert sha(pathlib.Path('data/work/issue7-baseline')/p)==h
assignment=read('data/work/issue7-baseline/assignments.json')
assert assignment['sakuragicho']==[FID]
assert sum(FID in ids for ids in assignment.values())==1
records=read(D/'fetch-records.json')
for row in records:
    assert sha(row['snapshotPath'])==row['snapshotSHA256']
    if row.get('storageEncoding'):
        raw=gzip.decompress(pathlib.Path(row['snapshotPath']).read_bytes())
        assert hashlib.sha256(raw).hexdigest()==row['originalEntitySHA256']
        assert len(raw)==row['originalEntityBytes']

# Reused originals remain in their original locations; no invented fetch times.
review=read('data/national/reviews/facility-point-scope.json')
def objects(x):
    if isinstance(x,dict):
        yield x
        for v in x.values(): yield from objects(v)
    elif isinstance(x,list):
        for v in x: yield from objects(v)
old=next(x for x in objects(review) if x.get('facilityId')==FID)
reused=[]
for x in old['sourcesRead']:
    assert sha(x['snapshotPath'])==x['snapshotSHA256']
    reused.append({**x,'fetchedAt':None,'fetchTimeNote':'旧取得メタデータの時刻は今回未照合。今回の再取得時刻で代用しない。'})
zmeta=read('data/evidence/issue5/chubu/P05-22_GML.zip.source.json')
assert sha(zmeta['path'])==zmeta['sha256']
reused.append(zmeta)
write(D/'reused-sources.json',reused)

z=zipfile.ZipFile(zmeta['path'])
zz=zipfile.ZipFile(io.BytesIO(z.read('P05-22_14_GML.zip')))
features=json.loads(zz.read('P05-22_14.geojson'))['features']
matches=[x for x in features if '桜木町' in str(x) or '観光案内' in str(x)]
assert not any('桜木町駅観光案内所' in str(x) for x in features)
write(D/'p05-search.json',{'archivePath':zmeta['path'],'member':'P05-22_14_GML.zip/P05-22_14.geojson','query':'桜木町 OR 観光案内 in serialized feature','matches':matches,'exactOfficeMatches':0})

html=(D/'japan47go.html').read_text()
ld=[json.loads(s) for s in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',html,re.S)]
office=next(x for root in ld for x in objects(root) if x.get('@type')=='LocalBusiness')
assert office['name']=='桜木町駅観光案内所'
coord={'lat':office['geo']['latitude'],'lng':office['geo']['longitude']}
assert coord==old['coordinate']

G='{http://www.opengis.net/gml}'; B='{http://www.opengis.net/citygml/building/2.0}'
root=E.fromstring(gzip.decompress((D/'53391540.gml.gz').read_bytes()))
f=Transformer.from_crs(6668,6677,always_xy=True)
point=Point(f.transform(coord['lng'],coord['lat']))
near=[]
for b in root.findall('.//'+B+'Building'):
    pos=b.find('.//'+B+'lod0FootPrint//'+G+'posList')
    if pos is None: continue
    v=list(map(float,pos.text.split())); lat=v[::3];lon=v[1::3]
    if min(lat)<35.4518 and max(lat)>35.4506 and min(lon)<139.6316 and max(lon)>139.6306:
        p=Polygon([f.transform(x,y) for x,y in zip(lon,lat)])
        near.append({'gmlId':b.get(G+'id'),'boundsLngLat':[min(lon),min(lat),max(lon),max(lat)],'areaM2':p.area,'containsJapan47GoPoint':p.contains(point),'distanceFromJapan47GoPointM':p.distance(point),'buildingParts':len(b.findall('.//'+B+'BuildingPart'))})
write(D/'coordinate-check.json',{'japan47goLocalBusinessCoordinate':coord,'sourceCRS':root.find('.//'+G+'Envelope').get('srsName'),'calculationCRS':'EPSG:6677; horizontal input EPSG:6668; no WGS84 datum conversion','nearby':near,'interpretation':'外形から約5.4m離れているだけで誤座標とは断定しない。公式図の案内所側店舗列と当該点の対応は未確定。駅全体の重心は算出・採用しない。'})

attempts=[
 {'source':'旧issue5/south-kanto・facility-point-scope・national旧原本','status':'reread','result':'旧分類は建物対応不足＋利用条件未確認。室内窓口測量は旧レビューも要求していない。'},
 {'source':'city-card.html / cial-office.html / cial-floor.html','status':'new-fetch-success','result':'市の現配布案内の南改札正面と、CIAL現店舗ページの横濱情報プラザ・電話045-211-0111が一致。A001の横浜駅とは別。'},
 {'source':'operator-tic.html / operator-access.html','status':'new-fetch-failed','result':'各1回GET、307のchallenge応答。本文として利用しない。回避・反復なし。'},
 {'source':'cial-plaza.html / cial-plaza.png / operator-map.pdf p60 / city-station.pdf p23','status':'new-fetch-success-visual-read','result':'公式図で南改札正面の店舗列の案内所を確認。市資料はJR図の2022年3月版。旧運営マニュアルの時間・他案内所所在地は現行情報として使わない。'},
 {'source':'joint-release.html','status':'new-fetch-success','result':'2014年の市・運営者・ヤマト共同発表を取得。歴史的背景のみ。'},
 {'source':'p05-search.json','status':'new-analysis-of-existing-original','result':'既存全国ZIP内の神奈川GeoJSONを新規検索。当該案内所なし。同住所の社会福祉センターは別施設なので不採用。'},
 {'source':'japan47go.html / japan47go-about.html / coordinate-check.json','status':'new-fetch-success','result':'個別LocalBusiness数値は旧値と一致。一般規約は無断転用・転載を断るが、個別座標事実に限定した条項は確認できず。原本一括再公開と一点利用は別問題。今回の不採用は規約だけが理由ではなく建物対応が未確定。'},
 {'source':'mesh-catalog.json / 53391540.gml.gz / coordinate-check.json','status':'new-fetch-success-new-analysis','result':'公式APIで2024年度横浜GMLを取得。駅付近の一体外形14100-bldg-942560は南北約250m、BuildingPartなし。現公式図と対応する案内所側の棟・屋根面を特定できず、駅全体重心への代用を避けた。LOD2屋根面は存在するが個々の面の同定は未完了。'}
]
out={'schema':1,'updates':[],'unresolved':[{'facilityId':FID,'reasonCategory':'building-correspondence-unresolved','reason':'現配布先の横濱情報プラザ入居は新規公式資料で確認できた。残件は座標原典と南改札正面店舗列の建物対応。JAPAN47GO点を建物点と確定できず、PLATEAUも駅全体外形から案内所側部分をまだ同定できない。入口・室内精度や全施設の改修履歴不存在証明を要求しているのではない。','nextSource':'CIAL/JR/市の地理参照付き横濱情報プラザ配置図、または公式構内図とPLATEAUのLOD2屋根面の位置対応。一般規約については座標事実1点利用と原本全体再公開を分離して親が検討できるが、同意だけでは座標対応は埋まらない。','investigationStatus':'new-investigation-partially-resolved','attempts':attempts}],'corrections':[]}
dest=pathlib.Path('data/national/issue7/sakuragicho.json');dest.parent.mkdir(parents=True,exist_ok=True);write(dest,out)
ids=[x['facilityId'] for k in ['updates','unresolved'] for x in out[k]]
assert ids==assignment['sakuragicho'] and len(ids)==len(set(ids))
allowed={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
for u in out['updates']: assert set(u['evidence'])==allowed
write(D/'validation.json',{'passed':True,'assigned':1,'updates':0,'unresolved':1,'fetchRecordsVerified':len(records),'inputHashesUnchanged':True,'assignmentCompleteNoDuplicates':True,'oldOriginalHashesVerified':True,'numericSourceVerified':True,'goEvidenceFieldsChecked':True,'coordinateAccepted':False})
print(json.dumps(read(D/'validation.json'),ensure_ascii=False))
