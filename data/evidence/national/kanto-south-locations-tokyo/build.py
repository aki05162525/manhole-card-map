from research import *
from decisions import D
import csv,io,html
updates=[];review=[]
def extract(d):
 u=d['url'];r=M[u];assert r.get('status')==200,(u,r);s=soup(u);raw=str(s);kind=d['kind'];loc='';extra=None
 if kind in ('q','destination','place','searchpoint','query','iframeq'):
  patterns={'query':r'[?&]query=([\d.]+),([\d.]+)','iframeq':r'[?&]q=([\d.]+),([\d.]+)','q':r'[?&]q=(\d+\.\d+),(\d+\.\d+)','destination':r'destination=(\d+\.\d+),(\d+\.\d+)','place':r'!3d([\d.]+)!4d([\d.]+)','searchpoint':r'/maps/search/([\d.]+),([\d.]+)'}
  found=[]
  for a in s.find_all('iframe' if kind=='iframeq' else 'a'):
   v=urllib.parse.unquote(a.get('src' if kind=='iframeq' else 'href',''))
   if d.get('match') and d['match'] not in v:continue
   m=re.search(patterns[kind],v)
   if m:found.append((m.groups(),v))
  found=list(dict.fromkeys(found));assert len({f[0] for f in found})==1,(u,found);(lat,lng),loc=found[0]
 elif kind=='geo':
  blocks=[json.loads(el.string) for el in s.find_all('script',type='application/ld+json') if el.string];items=[v for b in blocks for v in (b if isinstance(b,list) else [b]) if v.get('geo')];assert len(items)==1;it=items[0];lat=it['geo']['latitude'];lng=it['geo']['longitude'];loc=json.dumps(it,ensure_ascii=False)
 elif kind=='marker':
  lat,lng=re.search(r'var point = new GLatLng\(([\d.]+),([\d.]+)\)',raw).groups();assert 'new GMarker(point)' in raw;loc='var point = new GLatLng('+lat+','+lng+'); GMarker(point); としま区民センター／東京都豊島区東池袋1-20-10'
 elif kind=='library':
  lat=s.find(id='library-latitude')['value'];lng=s.find(id='library-longitude')['value'];loc='input#library-latitude / input#library-longitude、図書館名 大泉図書館、所在地 大泉学園町2-21-17'
 elif kind in ('csv','evaccsv'):
  b=pathlib.Path(r['snapshotPath']).read_bytes()
  try:t=b.decode('utf-8-sig')
  except UnicodeDecodeError:t=b.decode('cp932')
  rows=list(csv.reader(io.StringIO(t)));rows=[(n+1,x) for n,x in enumerate(rows) if x and x[0]==d['match']];assert len(rows)==1,rows;n,row=rows[0];lat,lng=(row[7],row[8]) if kind=='csv' else (row[5],row[6]);loc=f'CSVレコード{n}: '+','.join(row)
 elif kind=='routeend':
  vs=[urllib.parse.unquote(x.get('src','')) for x in s.find_all('iframe') if '!4m13!3e0' in x.get('src','')];found=[re.findall(r'!3m2!1d([\d.]+)!2d([\d.]+)',v)[-1] for v in vs];assert len(found)==2 and len(set(found))==1;lat,lng=found[0];loc=vs[0]
 elif kind=='asset':
  rows=[x for x in csv.DictReader(io.StringIO(pathlib.Path(r['snapshotPath']).read_bytes().decode('utf-8-sig'))) if x['アセットDB番号']==d['match']];assert len(rows)==1;row=rows[0];assert row['種別']=='建物';lat,lng=row['緯度（世界測地系）'],row['経度（世界測地系）'];loc=json.dumps(row,ensure_ascii=False)
 elif kind=='standardcsv':
  b=pathlib.Path(r['snapshotPath']).read_bytes()
  try:t=b.decode('utf-8-sig')
  except UnicodeDecodeError:t=b.decode('cp932')
  rows=[x for x in csv.DictReader(io.StringIO(t)) if x['名称']==d['match']];assert len(rows)==1;row=rows[0];lat,lng=row['緯度'],row['経度'];loc=json.dumps(row,ensure_ascii=False)
 elif kind=='xmlmarker':
  import xml.etree.ElementTree as ET
  root=ET.fromstring(pathlib.Path(r['snapshotPath']).read_bytes());els=[x for x in root.iter('Placemark') if x.findtext('name','').strip()==d['match']];assert len(els)==1;el=els[0];lat,lng=el.findtext('.//latitude'),el.findtext('.//longitude');loc=ET.tostring(el,encoding='unicode')
 elif kind=='jsmarker':
  lat,lng=re.search(r'position: new google.maps.LatLng\(\s*([\d.]+),\s*([\d.]+)\s*\)',raw).groups();loc='google.maps.Marker({ position: new google.maps.LatLng('+lat+','+lng+') })'
 elif kind=='redirect':
  short=d['match'];assert short in raw,(short,u);rr=M[short];v=urllib.parse.unquote(rr['finalUrl']);lat,lng=re.search(r'!3d([\d.]+)!4d([\d.]+)',v).groups();loc='公式施設リンク '+short+' のリダイレクト先placeマーカー !3d'+lat+'!4d'+lng+'（@以降の表示中心は不採用）。';extra={**rr,'role':'official-map-link-destination'}
 else:raise ValueError(kind)
 return dict(lat=float(lat),lng=float(lng)),loc,extra
for i,d in sorted(D.items()):
 p=P[i];co,loc,extra=extract(d);r=M[d['url']]
 ev=dict(sourceUrl=d['url'],snapshotPath=r['snapshotPath'],snapshotSHA256=r['sha256'],sourceLocator=p['name']+'／'+p['address']+'。'+loc,checkedAt=r['fetchedAt'][:10],actorType='ai',verificationMethod='AIが公式施設の名称・住所と公開目的地点を照合。建物代表点で、階・室内窓口や現地・人による確認ではない。'+d.get('note',''))
 update=dict(facilityId=p['id'],coordinate=co,evidence=ev,scope='building')
 support=[]
 if extra:support.append(extra)
 pu=p.get('evidence',{}).get('sourceUrl');pr=M.get(pu)
 if pr and pu!=d['url']:support.append({**pr,'role':'distribution-name-and-address'})
 if d['kind']=='xmlmarker':support.append({**M['https://www.city.hamura.tokyo.jp/map/js/jquery.GoogleMaps2.js'],'role':'marker-position-implementation'})
 if support:update['supportingEvidence']=support
 updates.append(update)
 txt=soup(d['url']).get_text(' ',strip=True)
 if d['kind'] in ['csv','evaccsv','standardcsv','asset']:txt=loc
 review.append(dict(index=i,name=p['name'],inputAddress=p['address'],coordinate=co,url=d['url'],locator=loc,sourceText=txt))
write(ROOT/'review.json',review)
# Final unresolved assessments are maintained independently after reading source evidence.
notes=read(ROOT/'unresolved-notes.json') if (ROOT/'unresolved-notes.json').exists() else {}
j=read(ROOT/'jobs.json');e=read(ROOT/'extra.json');maps=read(ROOT/'map-links.json')
unresolved=[]
for p in P:
 i=str(p['index'])
 if p['index'] in D:continue
 us=list(dict.fromkeys(p['urls']+j.get(i,[])+e.get(i,[])+[r['url'] for r in maps.get(i,[])]));attempts=[]
 for u in us:
  r=M.get(u)
  if not r:continue
  result=('HTTP '+str(r['status'])) if r.get('status') else r.get('error','取得結果不明')
  if r.get('status')==200:
   result+='。'+notes.get(i,'目的地座標として採用不可。')
   if 'toitsudb_' in u:result='HTTP 200。公開台帳を施設名・所在地で照合。対象の配布窓口建物と一致する行を確定できず。' 
  attempts.append(dict(url=u,result=result,**{k:r[k] for k in ['snapshotPath','sha256','fetchedAt'] if k in r}))
 unresolved.append(dict(facilityId=p['id'],attempts=attempts,reason=notes.get(i,'施設名・住所に対応する目的地座標を取得資料内で確定できない。表示中心・住所代表点・他施設・蓋座標は不採用。')))
result=dict(schema=1,region='kanto-south',updates=updates,unresolved=unresolved)
path=pathlib.Path('data/national/location-updates/kanto-south-tokyo.json');path.parent.mkdir(exist_ok=True,parents=True);write(path,result)
print('updates',len(updates),'unresolved',len(unresolved))
