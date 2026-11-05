"""Offline rebuild: uv run --with requests --with beautifulsoup4 python <this file>."""
from research import *
from decisions import D,R
import shutil,html
OUT=pathlib.Path('data/national/location-updates/kanto-north-ibaraki-tochigi-gunma.json')
extra=json.load(open(ROOT/'extra-queue.json'))
manifest=json.load(open(ROOT/'manifest.json'))
byurl={m['url']:m for m in manifest}
def retain(u):
 m=dict(cache[u])
 if m.get('snapshotPath'):
  p=pathlib.Path(m['snapshotPath']);b=p.read_bytes();assert hashlib.sha256(b).hexdigest()==m['snapshotSHA256'],u
  if not p.is_relative_to(ROOT):
   target=ROOT/('reused-'+hashlib.sha256(u.encode()).hexdigest()[:20]+p.suffix)
   target.write_bytes(b);m['cacheReusedFrom']=str(p);m['snapshotPath']=str(target)
 byurl[u]=m
 return m

def extract(d):
 m=cache[d['url']];s=read(m);soup=BeautifulSoup(s,'html.parser');k=d['kind'];key=d['key'];loc=''
 if k in ['q','poi','redirect-q']:
  a,b=key.split(',');coords=(float(a),float(b));candidates=[]
  for tag in soup.select('a[href]'):
   href=urllib.parse.unquote(tag['href']);query=urllib.parse.parse_qs(urllib.parse.urlsplit(href).query).get('q',[''])[0]
   if k=='q' and (query==key or query.endswith('@'+key)):candidates.append(str(tag))
   if k=='poi' and f'!3d{a}!4d{b}' in href:candidates.append(str(tag))
  if k=='redirect-q':
   assert urllib.parse.parse_qs(urllib.parse.urlsplit(m['finalUrl']).query)['q'][0]==key
   assert a in s and b in s
   loc='公式map.phpリンクの遷移先URL（manifest.finalUrl）のq='+key+'。返却HTMLにも同値。'
  else:
   assert candidates,(d,'matching link absent')
   loc=('a[href]のq='+key if k=='q' else '配布場所a[href]の!8m2!3d/!4d目的地POI')
 elif k=='position':
  mat=re.search(r'position:\s*new google.maps.LatLng\(\s*([\d.]+),\s*([\d.]+)\)',s);assert mat,d
  coords=tuple(map(float,mat.groups()));loc='script: google.maps.Marker({position: new google.maps.LatLng(...)}) と InfoWindowの施設名・住所'
 elif k=='spot':
  mat=re.search(r"latlng:\s*\[([\d.]+),\s*([\d.]+)\],\s*name:\s*'"+re.escape(key)+"'",s);assert mat,d
  coords=tuple(map(float,mat.groups()));loc=f'script: spotList[name="{key}"].latlng と view_infoの名称・住所'
 elif k=='data-marker':
  matches=[t for t in soup.select('[data-marker-title]') if re.sub(r'\s','',t['data-marker-title'])==re.sub(r'\s','',key)];assert len(matches)==1,d
  t=matches[0];coords=(float(t['data-marker-lat']),float(t['data-marker-lng']));loc=f'li[data-marker-title="{t["data-marker-title"]}"] data-marker-lat/data-marker-lng'
 elif k=='json-marker':
  info=soup.select_one('#MapInformations');assert info,d
  js=json.loads(info['value']);markers=[v for obj in js.values() for v in obj.get('markers',[]) if key in json.dumps(v,ensure_ascii=False)];assert len(markers)==1,(d,markers)
  t=markers[0];coords=(t['lat'],t['lng']);loc=f'input#MapInformations.value JSON内 markers[]（addr={t.get("addr")}; comment={t.get("comment")}）のlat/lng。外側lat/lngは不使用。'
 elif k=='init':
  coords=tuple(float(re.search(r'var '+v+r"\s*=\s*'([\d.]+)'",s).group(1)) for v in ['initlat','initlong']);loc='initlat/initlong → shisetsu-detail-googlemap.js の myLatlng → Marker.position'
 elif k=='param':
  chunk=s[s.index('var initParam_Map'):];coords=tuple(float(re.search("'"+v+"':'([\\d.]+)'",chunk).group(1)) for v in ['lat','lon']);loc='initParam_Map.lat/lon → core/js/map/map.js Param → Marker.position（displayIcon=true）'
 elif k=='fc':
  chunk=s[s.index('var markerData'):];coords=tuple(float(re.search(v+r':\s*([\d.]+)',chunk).group(1)) for v in ['lat','lng']);loc='markerData.name/address/lat/lng → markerLatLng → Marker.position'
 elif k=='markerInfos':
  mat=re.search(r'"markerInfos":\[(.*?)\]',s);t=json.loads('['+mat.group(1)+']')[0];assert t['title']=='玉村町水道庁舎';coords=(t['lat'],t['lng']);loc='施設地図JSON markerInfos[title="玉村町水道庁舎"].lat/lng'
 elif k=='facility-data':
  mat=re.search(r'\{name:"'+re.escape(key)+r'"[^\n]+',s);assert mat,d
  chunk=mat.group();assert '中谷328-10' in chunk;coords=tuple(float(re.search(v+r':"([\d.]+)"',chunk).group(1)) for v in ['lat','lng']);loc='町公式施設マップが参照するmap_20260306181536.csv: name="駅前プラザ メイちゃん家", address="群馬県邑楽郡明和町中谷328-10" のlat/lng'
 else:raise ValueError(k)
 assert 35<coords[0]<38 and 138<coords[1]<142,d
 return coords,loc

updates=[];proof=[];checked=datetime.datetime.now(datetime.timezone.utc).isoformat()
for d in sorted(D,key=lambda x:x['index']):
 i=d['index'];f=targets[i];coords,loc=extract(d);m=retain(d['url'])
 ev=dict(sourceUrl=d['url'],snapshotPath=m['snapshotPath'],snapshotSHA256=m['snapshotSHA256'],sourceLocator=loc,checkedAt=checked,actorType='ai',verificationMethod='公式原典の目的地点指定をAIが照合。'+d['identity']+' 建物・施設代表点として採用し、室内窓口・階・入口の位置精度を主張しない。現地確認・人による確認ではない。')
 updates.append(dict(facilityId=f['id'],coordinate=dict(lat=coords[0],lng=coords[1]),evidence=ev))
 proof.append(dict(facilityId=f['id'],name=f['name'],address=f['address'],**d,coordinate=dict(lat=coords[0],lng=coords[1])))
used={d['index'] for d in D};assert set(R)==set(range(len(targets)))-used,(set(range(len(targets)))-used-set(R),set(R)&used)
# Include linked map probes and sibling-building investigations in each facility's trail.
for file in ['map-queue.json','direct-map-queue.json']:
 q=json.load(open(ROOT/file))
 if isinstance(q,dict):
  for i,us in q.items():
   if i.isdigit() and isinstance(us,list):extra.setdefault(i,[]).extend(us)
for dst,src in [(5,12),(7,6),(23,22),(36,35),(41,40),(46,45),(50,49),(64,63),(72,71),(79,78),(104,103)]:extra.setdefault(str(dst),[]).extend(extra.get(str(src),[]))
# Relevant direct probes not represented by the queue mapping.
for i,us in {11:['https://www.city.tsuchiura.lg.jp/map.php?code=204'],34:['https://www.city.naka.lg.jp/map.php?code=42'],32:['https://maps.app.goo.gl/fotNWyVe5LJo6TAY6'],44:['https://goo.gl/maps/BDoNMYPaHbpgfJ468'],66:['https://goo.gl/maps/qTZ2l'],42:['https://goo.gl/maps/RAm3ySV7k7k'],43:['https://www.city.hokota.lg.jp/map.php?type=0']}.items():extra.setdefault(str(i),[]).extend(us)
trails={};unresolved=[]
for i,f in enumerate(targets):
 attempts=[]
 for u in dict.fromkeys(urls[f['id']]+extra.get(str(i),[])+[d['url'] for d in D if d['index']==i]):
  if u not in cache:continue
  m=retain(u);d=inspect(m);status=m.get('status',m.get('error'))
  result=f'取得記録: {status}。'+('「'+d['title'].strip()+'」を確認。' if d['title'].strip() else '')
  if i in R:result+='施設ごとの判定: '+R[i]
  attempts.append(dict(url=u,result=result))
 trails[f['id']]=dict(index=i,name=f['name'],address=f['address'],attempts=attempts)
 if i in R:unresolved.append(dict(facilityId=f['id'],attempts=attempts,reason=R[i]))
for u in ['https://www.city.yaita.tochigi.jp/ssi/js/shisetsu-detail-googlemap.js','https://www.city.tatebayashi.gunma.jp/core/js/map/map.js','https://escado.jp/ibarakijiman/']:
 retain(u)
dump('manifest.json',list(byurl.values()));dump('reviewed-decisions.json',proof);dump('facility-research.json',trails)
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(dict(schema=1,region='kanto-north',updates=updates,unresolved=unresolved),ensure_ascii=False,indent=2)+'\n')
print(f'{len(targets)} targets: {len(updates)} updates, {len(unresolved)} unresolved')
