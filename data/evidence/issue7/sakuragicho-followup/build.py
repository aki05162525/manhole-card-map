"""Validate reused sources and regenerate research result, without modifying predecessors."""
import pathlib,json,hashlib,gzip,re,datetime,xml.etree.ElementTree as E
from shapely.geometry import Polygon,Point
from pyproj import Transformer
D=pathlib.Path(__file__).resolve().parent.relative_to(pathlib.Path.cwd());S=D.parent/'sakuragicho'
def read(p):return json.loads(pathlib.Path(p).read_text())
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def write(p,v):pathlib.Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
records=read(S/'fetch-records.json')
for row in records+read(D/'fetch-records.json'):
 assert sha(row['snapshotPath'])==row['snapshotSHA256']
 if row.get('storageEncoding'):assert hashlib.sha256(gzip.decompress(pathlib.Path(row['snapshotPath']).read_bytes())).hexdigest()==row['originalEntitySHA256']
for p,h in read(S/'input-hashes.json').items():assert sha(p)==h,p
for p,h in read('data/work/issue7-baseline/hashes.json').items():assert sha(pathlib.Path('data/work/issue7-baseline')/p)==h,p
# Actual acquisition dates belong to the old original, not this reanalysis.
write(D/'reused-sources.json',records)
G='{http://www.opengis.net/gml}';B='{http://www.opengis.net/citygml/building/2.0}'
r=E.fromstring(gzip.decompress((S/'53391540.gml.gz').read_bytes()))
b=next(x for x in r.findall('.//'+B+'Building') if x.get(G+'id')=='bldg_4149036a-f412-4dc8-a472-5a740921f2ed')
f=Transformer.from_crs(6668,6677,always_xy=True)
v=list(map(float,b.find('.//'+B+'lod0FootPrint//'+G+'posList').text.split()))
p=Polygon([f.transform(lon,lat) for lat,lon in zip(v[::3],v[1::3])]);q=Point(f.transform(139.6312274,35.4511374))
assert p.is_valid and 5.4<p.distance(q)<5.5
html=(S/'japan47go.html').read_text();assert '35.4511374' in html and '139.6312274' in html
metrics={'sourceCRS':'EPSG:6697; horizontal EPSG:6668; calculation EPSG:6677','gmlId':b.get(G+'id'),'japan47goCoordinate':{'lat':35.4511374,'lng':139.6312274},'distanceToLOD0M':p.distance(q),'roofSurfaceCount':len(b.findall('.//'+B+'RoofSurface')),'roofPolygonCount':len(b.findall('.//'+B+'RoofSurface//'+G+'exterior//'+G+'posList')),'allFootprintPosLists':len(b.findall('.//'+B+'lod0FootPrint//'+G+'posList')),'finding':'JAPAN47GO点は駅東側広場の外縁付近。公式構内図の案内所は南改札正面店舗列の西口側端。5.44mだけではこの左右対応を検証できない。'}
write(D/'coordinate-check.json',metrics)
j47=next(x for x in records if x['snapshotPath'].endswith('/japan47go.html'))
ld=[json.loads(t) for t in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',html,re.S)]
office=next(x for x in ld if isinstance(x,dict) and x.get('@type')=='LocalBusiness')
assert office['name']=='桜木町駅観光案内所' and office['telephone']=='045-211-0111'
assert office['geo']['latitude']==35.4511374 and office['geo']['longitude']==139.6312274
reason='採用候補。JAPAN47GO個別原本の名称・住所・電話045-211-0111が現案内所に一致。市カード本文とCIAL store_id=47・公式フロア図で南改札正面の横濱情報プラザ入居を確認。個別点は同じ駅棟の東側外縁から約5.44mで、PLATEAU・市周辺図・空中写真上も長い駅の端部やANNEXでなく駅棟中間部の近傍を指す。案内所は店舗列西口側端なので入口位置とは一致しないが、訪問先の建物代表点としては合理的。特定屋根面や室内位置の一致を新たな採用条件にはしない。駅全体重心への代用・最近傍へのスナップ・座標平均はしていない。'
evidence={k:j47[k] for k in ['sourceUrl','snapshotPath','snapshotSHA256']}
evidence.update(sourceLocator='JSON-LD @type=LocalBusiness, name=桜木町駅観光案内所, telephone=045-211-0111, address.streetAddress=神奈川県横浜市中区桜木町1-1, geo.latitude/longitude。対応資料はdata/evidence/issue7/sakuragicho-followup/README.md及びreused-sources.json。',checkedAt='2026-11-05',actorType='ai',verificationMethod='AIによる原本照合。JAPAN47GOが施設名付きで公開する座標事実1点をそのまま使用。CIAL・横浜市の公式資料で現入居と南改札正面の配置を確認し、横浜市PLATEAU 2024年度LOD0及び国土地理院空中写真で駅棟近傍を確認。駅外形の外約5.44m、案内所は西口側・この点は東側のため、建物代表用途に限定した候補であり入口・室内窓口や特定RoofSurfaceの点とは主張しない。PLATEAU由来の座標と付け替えていない。原座標の測地系・精度は原本に明記されず、比較では経緯度数値をJGD2011水平成分として扱い測地系変換なし。小数桁は測量精度ではない。利用条件の確認範囲と原本公開との区別は同梱README。')
out={'schema':1,'updates':[{'facilityId':'facility:kanto-south-7d5b518b29440ef8d976','coordinate':{'lat':35.4511374,'lng':139.6312274},'scope':'building','evidence':evidence}],'unresolved':[],'corrections':[],'researchMetadata':{'checkedAt':'2026-11-05','actorType':'ai','status':'candidate-for-parent-review','evidenceDirectory':str(D),'acceptanceReason':reason,'priorAssessment':'先行の距離数値は正しい。長い駅全体の重心へ置換しない判断にも賛成。ただし今回の建物代表点という許容範囲では、施設名・電話一致と公式配置・建物近接を総合すれば候補にできる。特定屋根面未同定を理由に保留を続ける判断は支持しない。','licenseAssessment':'JAPAN47GO aboutの一般条項は文書・写真等の無断転用転載、出版物等への掲載連絡を記載。座標事実1点を名指しする条項は確認できず、一点利用が明示許可済み／禁止と断定しない。今回の提案対象は数値事実1点と出典であり、DB一括取得・原本全文や写真の公開許諾を意味しない。','actualWork':['先行JSON・README精読','公式CIAL図・市PDF23頁・運営者PDF60頁を画像確認','市PDF98頁を追加レンダリングし方位・駅と周辺の配置を画像確認','GML外形と全RoofSurfaceを解析・描画','JAPAN47GO座標・名称・住所・電話を原本照合','国土地理院空中写真上で個別点と建物外形を比較','CIALアクセスページ・配置図2枚と地理院写真9枚・仕様ページを新規取得','元原本と固定baseline hash検証'],'notDone':['現地訪問・室内測量','案内所の厳密屋根面同定','JAPAN47GOへの個別利用照会','空中写真の個別撮影日同定','manifest適用'],'documentCodeDiscrepancies':[]}}
write('data/national/issue7/sakuragicho-followup.json',out)
allowed={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
fields=set(re.findall(r'json:"([^"]+)"',pathlib.Path('cmd/builddata/ledger.go').read_text().split('type Evidence struct {')[1].split('}')[0]));assert fields==allowed
for u in out['updates']:assert set(u['evidence'])==allowed
assert [x['facilityId'] for x in out['updates']+out['unresolved']]==read('data/work/issue7-baseline/assignments.json')['sakuragicho']
write(D/'validation.json',{'passed':True,'verifiedFetchRecords':len(records)+len(read(D/'fetch-records.json')),'baselineHashesUnchanged':True,'priorInputHashesUnchanged':True,'goEvidenceFields':sorted(fields),'candidateCount':len(out['updates']),'assignmentComplete':True,'distanceRecomputedM':p.distance(q),'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()})
write(D/'hashes.json',{str(p):sha(p) for p in sorted(D.iterdir()) if p.is_file() and p.name!='hashes.json'})
print(json.dumps(read(D/'validation.json'),ensure_ascii=False))
