import research as r,decisions as d,json,csv,io,hashlib,datetime,zipfile,xml.etree.ElementTree as ET
P=json.load(open('data/overrides/regions/kyushu-okinawa.json'))['places']
C=json.load(open(r.ROOT/'csv-candidates.json'));R=json.load(open(r.ROOT/'selected-resources.json'));updates={}; proofs=[]
def add(i,x,lat,lng,loc,method,proof):
 assert not P[i].get('coordinate') and i not in updates
 b=__import__('pathlib').Path(x['snapshotPath']).read_bytes();assert hashlib.sha256(b).hexdigest()==x['snapshotSHA256']
 updates[i]={'facilityId':P[i]['id'],'coordinate':{'lat':lat,'lng':lng},'evidence':{'sourceUrl':x['url'],'snapshotPath':x['snapshotPath'],'snapshotSHA256':x['snapshotSHA256'],'sourceLocator':loc,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actorType':'ai','verificationMethod':method+' 配布施設の名称・現在住所を原地域台帳と照合。建物・施設の代表目的地点であり、階・室内窓口の正確な位置ではない。AIによる原典照合で、現地確認ではない。'}}
 proofs.append({'index':i,'facilityId':P[i]['id'],'name':P[i]['name'],'address':P[i]['address'],'proof':proof})
for i,ds,num in d.CSV:
 ts=[t for t in C.get(str(i),[]) if t['dataset']==ds and t['line']==num]
 if ts:
  t=ts[0];x=r.cache[t['url']];row=list(csv.DictReader(io.StringIO(r.read(x))))[num-2];lat,lng=t['lat'],t['lng'];name=t['name'];addr=t['address']
 else:
  z=next(z for z in R if z['dataset']==ds);x=r.cache[z['resource']['url']];row=list(csv.DictReader(io.StringIO(r.read(x))))[num-2]
  name=row.get('名称') or row.get('施設名');addr=row.get('所在地_連結表記') or row.get('住所') or row.get('所在地') or row.get('住所表記')
  lat=float(row.get('緯度') or row.get('\ufeff原点(緯度)') or row.get('原点(緯度)'));lng=float(row.get('経度') or row.get('原点(経度)'))
 assert 24<lat<35 and 127<lng<132,(i,row)
 add(i,x,lat,lng,f'自治体公開CSV dataset={ds} / 論理レコード{num}（ヘッダー=1） / {name} / {addr} / 緯度・経度列','自治体がBODIKで公開した施設単位の座標列を採用。',row)
for i,u,lat,lng,loc in d.HTML:
 x=r.cache[u];s=r.read(x);assert str(lat) in s and str(lng) in s,(i,u)
 add(i,x,lat,lng,loc,'公式施設案内の明示マーカーまたは数値目的地を採用。viewport中心は使用していない。',{'latLiteral':str(lat),'lngLiteral':str(lng)})
for i,u,parent,lat,lng in d.SHORT:
 x=r.cache[u];s=r.read(x);px=r.cache[parent]
 assert u in r.read(px),(i,parent)
 assert str(lat) in s and str(lng) in s,(i,'coordinate missing from snapshot')
 add(i,x,lat,lng,f'公式配布/施設ページ {parent} の地図リンク {u} → 最終URL data !3d{lat}!4d{lng}（目的地）','公式ページが指定した地図リンクの目的地座標を採用。起点ページsnapshot='+px['snapshotPath']+' SHA256='+px['snapshotSHA256']+'。',{'officialParent':px,'redirectFinalUrl':x.get('finalUrl')})
for i,code,name in [(119,'1013','宜野湾市立博物館'),(130,'1013','宮古島市立図書館'),(125,'1055','名護市役所'),(126,'1055','名護市役所')]:
 u=f'https://gis.pref.okinawa.jp/OpenData/data/opendata_{code}.zip';x=r.cache[u];z=zipfile.ZipFile(x['snapshotPath']);member=f'opendata_{code}.kml';root=ET.fromstring(z.read(member));p=next(p for p in root.findall('.//{*}Placemark') if p.findtext('{*}name')==name);coord=p.findtext('.//{*}coordinates');lng,lat=map(float,coord.split(',')[:2]);desc=p.findtext('{*}description')
 add(i,x,lat,lng,f'{member} / Placemark[name={name}] / Point/coordinates（経度,緯度） / description住所を照合','沖縄県公式GISオープンデータの施設Pointを採用。',{'member':member,'memberSHA256':hashlib.sha256(z.read(member)).hexdigest(),'name':name,'description':desc,'coordinates':coord})
for i,needle in [(121,'宜野湾市立体育館'),(124,'名護市産業支援センター')]:
 found=[]
 for x in r.records:
  if 'gis.pref.okinawa.jp/OpenData/data/hinan/' not in x['url']:continue
  for num,row in enumerate(csv.DictReader(io.StringIO(r.read(x))),2):
   if needle in row.values():found.append((x,num,row))
 x,num,row=found[0]
 add(i,x,float(row['Y']),float(row['X']),f'沖縄県公開避難施設CSV / 論理レコード{num} / {needle} / 所在地・住所 / X=経度,Y=緯度','県が公開した建物単位の避難施設位置を採用。配布案内の施設が入る同住所の建物と照合。',row)
# Stadium: explicit DMS destination label inside official embed, not viewport.
import re,base64
x=r.cache['https://www.kitakyushu-stadium.jp/page.php?fc=kiji&id=1']
label=re.search(r'!2z([^!]+)!5e0',r.read(x)).group(1)
dms=base64.urlsafe_b64decode(label+'='*((4-len(label)%4)%4)).decode()
assert dms=="33°53'27.9\"N 130°53'19.6\"E",dms
add(4,x,33+53/60+27.9/3600,130+53/60+19.6/3600,'公式アクセスiframe pbの!2z目的地ラベルをbase64url復号: '+dms+'。!2d/!3dのviewport中心は不採用。','公式が明示した度分秒の目的地ピンを十進度へ算術変換。',{'encodedLabel':label,'decodedLabel':dms})
json.dump(updates,open(r.ROOT/'verified-updates-by-index.json','w'),ensure_ascii=False,indent=2)
json.dump(proofs,open(r.ROOT/'coordinate-proof.json','w'),ensure_ascii=False,indent=2)
print('verified updates',len(updates))
