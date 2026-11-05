import json,pathlib,hashlib,re,datetime
from research import ROOT,P,M,soup
from decisions import D,EMBEDS,REASONS,add

def mfor(u):return next(m for m in M if u in (m['url'],m.get('finalUrl')))
def walk(x):
 if isinstance(x,list):
  if len(x)>2 and isinstance(x[0],str) and x[0].startswith('0x') and isinstance(x[2],list):yield x
  for v in x:yield from walk(v)
for i,(parent,name) in EMBEDS.items():
 m=next(m for m in M if m.get('embeddedBy')==parent)
 raw=pathlib.Path(m['snapshotPath']).read_text();v=re.search(r'initEmbed\((.*?)\);',raw,re.S);assert v
 matches=[a for a in walk(json.loads(v[1])) if name in a[1]];assert len(matches)==1,(i,matches)
 a=matches[0];lat,lng=a[2]
 add(i,m['url'],lat,lng,f'公式施設ページ {parent} の埋込地図応答。initEmbed内のentity {a[0]}、名称住所={a[1]}、entity座標配列={a[2]}。表示範囲/viewportの中心を使用しない。名称・住所を配布窓口と照合。建物代表点で室内位置ではない。')

T=json.load(open(ROOT/'targets.json'))
# Actual supplemental resources examined per facility; shared searches reused.
extras={5:['https://www.city.ichikawa.lg.jp/page/4744.html'],6:['https://www.city.ichikawa.lg.jp/page/4744.html', 'https://www.city.ichikawa.lg.jp/uploaded/attachment/53042.csv'],7:['https://www.city.ichikawa.lg.jp/page/4744.html','https://www.city.ichikawa.lg.jp/uploaded/attachment/53042.csv'],8:['https://www.city.ichikawa.lg.jp/uploaded/attachment/53042.csv'],11:['https://maruchiba.jp/feature/detail_89.html'],13:['https://tateyamacity.com/archives/4093','https://maruchiba.jp/feature/detail_89.html'],26:['https://www.kankou-kashiwa.jp/about/access/','https://maruchiba.jp/feature/detail_89.html'],30:['https://www.city.kamagaya.chiba.jp/web/Gmaps/data/1_office.xml'],31:['https://www.city.kamagaya.chiba.jp/web/Gmaps/data/14_kyodo.xml'],38:['https://www.city.shiroi.chiba.jp/soshiki/seisaku/keiei/keiei03/8319.html'],43:['https://www.vill.chosei.chiba.jp/map/xml/3.xml']}
for i,us in extras.items():T[str(i)]=T.get(str(i),[])+us
for dst,src in [(18,17),(37,36),(39,38),(47,43)]:T[str(dst)]=T.get(str(dst),[])+T.get(str(src),[])

checked=datetime.datetime.now(datetime.timezone.utc).isoformat()
updates=[];unresolved=[]
for i,p in enumerate(P):
 if i in D:
  d=D[i];m=mfor(d['url']);assert m['status']==200
  updates.append({'facilityId':p['id'],'coordinate':{'lat':d['lat'],'lng':d['lng']},'evidence':{'sourceUrl':m['url'],'snapshotPath':m['snapshotPath'],'snapshotSHA256':m['sha256'],'sourceLocator':d['locator'],'checkedAt':checked,'actorType':'ai','verificationMethod':'AIが公式施設案内・公開施設地点データの名称住所を配布窓口と照合し、目的地・明示マーカー・施設Pointの数値を原典から確認。住所ジオコード、蓋座標、地図表示中心を使用していない。現地確認・人による確認ではない。'},'scope':d['scope']})
 else:
  assert i in REASONS,i
  urls=list(dict.fromkeys([p['evidence']['sourceUrl']]+T.get(str(i),[])))
  # Include responses from Google embeds of the official pages actually examined.
  urls += [m['url'] for m in M if m.get('embeddedBy') in urls]
  attempts=[]
  for u in dict.fromkeys(urls):
   m=mfor(u);result=('HTTP 200原本取得。'+REASONS[i]) if m.get('status')==200 else '取得失敗: '+str(m.get('status',m.get('error')))
   attempts.append({'url':u,'result':result})
  unresolved.append({'facilityId':p['id'],'attempts':attempts,'reason':REASONS[i]})
assert len(updates)+len(unresolved)==48
out={'schema':1,'region':'kanto-south','updates':updates,'unresolved':unresolved}
path=pathlib.Path('data/national/location-updates/kanto-south-chiba.json');path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
(ROOT/'targets.json').write_text(json.dumps({k:list(dict.fromkeys(v)) for k,v in T.items()},ensure_ascii=False,indent=2)+'\n')
(ROOT/'facilities-reviewed.json').write_text(json.dumps([{'index':i,'facilityId':p['id'],'name':p['name'],'address':p['address'],'decision':'update' if i in D else 'unresolved'} for i,p in enumerate(P)],ensure_ascii=False,indent=2)+'\n')
print('updates',len(updates),'unresolved',len(unresolved))
