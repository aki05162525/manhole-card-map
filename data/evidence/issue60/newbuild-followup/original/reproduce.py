"""Offline reproduction of five unapproved research coordinates. Inputs are hand-read, not survey points."""
from pathlib import Path
import json,math,hashlib
import numpy as np
from PIL import Image,ImageDraw
from pyproj import Transformer,Geod
from shapely.geometry import shape,Point
O=Path(__file__).resolve().parent
inputs=json.loads((O/'georef-inputs.json').read_text());windows=json.loads((O/'windows.json').read_text());ids=json.loads((O/'ids.json').read_text());geod=Geod(ellps='GRS80')
def xyz(n,p):
 w=windows[n];sz=256*2**w['z'];x=w['x0']*256+p[0];y=w['y0']*256+p[1]
 return [math.degrees(math.atan(math.sinh(math.pi*(1-2*y/sz)))),x/sz*360-180]
def pix(n,ll):
 lat,lon=ll;w=windows[n];sz=256*2**w['z']
 return [(lon+180)/360*sz-w['x0']*256,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*sz-w['y0']*256]
def dist(a,b):return abs(geod.inv(a[1],a[0],b[1],b[0])[2])
def affine(v):
 return np.linalg.lstsq([[*p,1] for p,q,l in v['control']],[q for p,q,l in v['control']],rcond=None)[0]
def similarity(v):
 a=[];b=[]
 for (x,y),(u,w),l in v['control']:a.extend([[x,-y,1,0],[y,x,0,1]]);b.extend([u,w])
 s,r,tx,ty=np.linalg.lstsq(a,b,rcond=None)[0];return np.array([[s,r],[-r,s],[tx,ty]])
notes={
'27':dict(name='深谷テラスパーク管理棟',uncertaintyPlanningRadiusM=8,uncertaintyBasis='0.5m画像の手読取約1〜2m、屋上/地上差・原写真絶対誤差未公表、IX系推定・年代差を加え8mを感度確認用とする。統計的上限ではない。',impact='円形広場南西の管理棟/直近デッキを案内。北の農園棟や南の遊具とは分離。半径8mは建物内包を保証しないが他棟へは達しない。',source='深谷市 令和6年(2024)航空写真（ライト版）2203.tif + 2203.tfw; CC-BY',photoDate='2024年（公開資料タイトル、月日未確定）',limitation='tfw自体にCRS記載なし。JGD2011平面直角IX(EPSG6677)適用は周辺道路で照合した解釈。JGD2000 IXとの結果差も計算。'),
'35':dict(name='寄居駅南口駅前拠点施設 Yotteco',uncertaintyPlanningRadiusM=15,uncertaintyBasis='未使用2点のずれ、手読取、2021設計前略図の形状と完成建物の差、2020簡易空中写真の絶対誤差未公表を含む15m感度範囲。',impact='駅南階段正面、中央通りの東側、YORIBA北側の現施設区画。15mで広場/歩道へ出る可能性があり建物内包保証はしない。Google数値も旧小棟も数値導出に使わない。',source='寄居町参考平面図16375.pdf + GSI全国最新写真（2020）; 完成配置は町2024資料23051.pdfの空撮と設計者完成写真で照合',photoDate='2020年10月〜11月 GSI簡易空中写真。完成状況補完は2024発行町資料（写真撮影日未記載）',limitation='16375.pdfはプロポーザル段階で建物基本設計前。図の駅前拠点施設の中心を現建物代表域として推定した。完成後屋根の直接数値読取ではない。最優先レビュー事項。'),
'42':dict(name='Tearoom at the SICG',uncertaintyPlanningRadiusM=6,uncertaintyBasis='z18約0.48m/px、小屋根手読取1〜2m、屋根/地上差、2023写真と2025広報の時期差、絶対精度未公表を含む6m感度範囲。',impact='旧校舎南面東寄りの小屋根・デッキ近傍。6mは小棟内包を保証せず校舎側・デッキ側へ出うるが別敷地や東のBldA9へ誘導しない。',source='国土地理院 全国最新写真（2023年1月オルソ画像）; 佐野市広報2025年4月PDF6印刷7',photoDate='2023年1月。棟同定写真は2025年4月広報、撮影日は未記載',limitation='2023小屋根と2025TeaRoomの外観に年代差。室内窓口点ではなく小棟代表点。'),
'43':dict(name='上三川町 ORIGAMIプラザ',uncertaintyPlanningRadiusM=15,uncertaintyBasis='基本設計図と標準地図の形状差、未使用点残差最大約10m、手読取を含む15m感度範囲。絶対精度の保証ではない。',impact='いきいき南の街区内、東側駐車帯の西にある建物の中央寄り。15mで建物端/広場へ出る可能性。いきいき本館・東歩道の蓋とは十分分離。',source='上三川町2022年3月基本設計概要PDF5印刷4 + 国土地理院標準地図。現行カード案内図/2025広報平面図で棟と配置を照合',photoDate='参考GSI航空は2010年4月〜5月。数値基準は2026-11-06取得標準地図で個別更新日不明',limitation='基本設計図からの座標化であり竣工測量ではない。現行案内図の棟配置との同一性は読解。'),
'45':dict(name='桐生市役所新本庁舎',uncertaintyPlanningRadiusM=12,uncertaintyBasis='北・東交差点手読取、未使用道路確認、図線幅、地図一般化と新旧道路接続差を含む12m感度範囲。',impact='北東側多角形新庁舎の内部寄り。旧庁舎跡駐車場・学校・文化会館とは分離。南西旧道路の対応誤りは除外済み。',source='桐生市2026駐車場配置図 + 国土地理院標準地図',photoDate='参考航空は2020年5月〜8月民有林空中写真。数値基準はGSI標準地図、写真は数値導出に不使用',limitation='1階室内窓口は定位していない。同一新庁舎の代表点。')}
rows=[]
for n in ['27','35','42','43','45']:
 v=inputs[n];m=None
 if v['method'] in ('affine','similarity'):
  m=(affine if v['method']=='affine' else similarity)(v);mappt=lambda p: (np.array([*p,1])@m).tolist();ll=lambda p:xyz(n,mappt(p))
 elif v['method']=='worldfile':
  t=Transformer.from_crs(v['assumedEPSG'],4326,always_xy=True);a,d,b,e,c,f=v['worldfile'];ll=lambda p:list(t.transform(c+a*p[0]+b*p[1],f+d*p[0]+e*p[1]))[::-1];mappt=lambda p:pix(n,ll(p))
 else:mappt=lambda p:list(p);ll=lambda p:xyz(n,p)
 point=ll(v['target']);checks=[]
 for p,q,label in v['check']:
  pred=mappt(p);checks.append(dict(label=label,sourcePixel=p,referencePixel=q,predictedReferencePixel=pred,discrepancyM=round(dist(xyz(n,pred),xyz(n,q)),3),usedForFit=False))
 residuals=[]
 for p,q,label in v.get('control',[]):residuals.append(dict(label=label,residualM=round(dist(ll(p),xyz(n,q)),6)))
 row=dict(number=int(n),facilityId=ids[n],status='research_candidate_not_approved',coordinate=dict(lat=round(point[0],7),lng=round(point[1],7)),method=v['method'],targetSourcePixel=v['target'],targetReferencePixel=mappt(v['target']),matrix=None if m is None else m.tolist(),fitResiduals=residuals,heldOutChecks=checks,fitResidualIsAbsoluteAccuracy=False,notes=notes[n],googleCoordinateUsedInDerivation=False)
 if n=='27':
  a,d,b,e,c,f=v['worldfile'];x,y=v['target'];t2=Transformer.from_crs(2451,4326,always_xy=True);old=list(t2.transform(c+a*x,f+e*y))[::-1];row['JGD2000IXvsJGD2011IXM']=dist(point,old)
 spec=json.loads((O/'raw'/f'{n}-spec.geojson').read_text());row['gsiPhotoMetadataAtCandidate']=[z['properties'] for z in spec['features'] if shape(z['geometry']).covers(Point(point[1],point[0]))]
 # Analysis artifacts, not redistributable app assets.
 for context,filename,transform in [('source',v['image'],lambda p:p),('reference',v['reference'],mappt)]:
  im=Image.open(O/filename).convert('RGB');draw=ImageDraw.Draw(im);q=transform(v['target']);draw.polygon([tuple(transform(p)) for p in v['outline']],outline='red',width=2);draw.ellipse((q[0]-4,q[1]-4,q[0]+4,q[1]+4),fill='red')
  for i,(p,r,l) in enumerate(v.get('control',[]),1):
   q2=p if context=='source' else r;draw.ellipse((q2[0]-4,q2[1]-4,q2[0]+4,q2[1]+4),outline='blue',width=2);draw.text((q2[0]+5,q2[1]),f'C{i}',fill='blue')
  for i,(p,r,l) in enumerate(v['check'],1):
   q2=p if context=='source' else r;draw.ellipse((q2[0]-4,q2[1]-4,q2[0]+4,q2[1]+4),outline='green',width=2);draw.text((q2[0]+5,q2[1]),f'H{i}',fill='green')
  draw.rectangle((0,0,min(im.width,1000),32),fill='white');draw.text((5,5),f'No.{n} / source: municipality + GSI / processed by manhole-card-map / unapproved research',fill='black');im.save(O/f'{n}-evidence-{context}.png')
 rows.append(row)
(O/'candidates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print(json.dumps([{k:r[k] for k in ['number','coordinate','heldOutChecks']} for r in rows],ensure_ascii=False,indent=2))
