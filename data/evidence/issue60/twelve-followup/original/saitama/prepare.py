import json,pathlib,hashlib,datetime,concurrent.futures,urllib.request
import re,html
O=pathlib.Path('/tmp/issue60-recheck-saitama-nov6')
rows=[(22,36.08702,139.45105,'アリーナ東36.08657,139.45220、共用駐車場挟み西にケージ、その北東木造平屋受付観察棟。',['https://www.city.kounosu.saitama.jp/site/konotori/1294.html']), (23,35.81306,139.64175,'敷地北東正門駐車場直結3F管理本館、処理区西南、旧点117m外との報告。',['https://www.saitama-swg.or.jp/nanbu_hp_20120423/index.html','https://www.saitama-swg.or.jp/nanbu_hp_20120423/access.html']), (24,35.99587,139.61802,'南2F庁舎、正面駐車場、北は配水設備、以前北指定との矛盾訂正。',['https://www.town.saitama-ina.lg.jp/0000000624.html','https://www.town.saitama-ina.lg.jp/cmsfiles/contents/0000000/624/gaikan1.jpg']), (25,35.79145,139.46512,'元町21-18 店舗036、旧元町28-21から2008移転という報告、旧点121m誤りの理由は推論。',['https://machizou.jp/access.html','https://tokogin.com/トコロサワマチヅクリショウテン/']), (27,36.13244,139.24571,'花園駅北、円形芝生広場西管理棟180㎡パノラマデッキ、以前駅南撤回、アウトレット南との報告。',['https://fukaya-terracepark.jp/about/terracepark/','https://www.city.fukaya.saitama.jp/soshiki/sangyoshinko/sangyobrand/tanto/fukayaterracepark/index.html']), (29,35.80655,139.61685,'西側カーブアクセス路→レンガ正門→駐車場脇管理本館1F、旧259m外。',['https://www.saitama-swg.or.jp/ugan%20hp/access.html','https://www.pref.saitama.lg.jp/soshiki/d1502/index.html']), (30,35.81340,139.64230,'付近。北東正門脇独立小棟、奥南西70m管理本館、ゲート代表点でも窓口対面可能との報告。',['https://machi-ga.com/mcard/number00121.html','https://www.saitama-swg.or.jp/nanbu_hp_20120423/access.html']), (32,35.98083,139.41118,'東正門からすぐ右北2F管理棟(1F守衛/2F事務)、正面駐車場、処理施設西、旧58m外。',['https://www.stgesui.or.jp/access/','https://www.stgesui.or.jp/facility/']), (35,36.11722,139.19458,'寄居1231-11。駅南階段正面ロータリー南東、2023開業、らせん木スロープ円形基調屋上広場という報告。形状叙述が別施設との誤認なら明示。',['https://yotteco-yorii.jp/','https://www.town.yorii.saitama.jp/soshiki/13/yotteco-gooddesignaward2023.html']), (36,36.03975,139.42180,'南東入場ゲート脇券売管理棟、文化財センター北吉見321/売店とは別との報告。',['https://www.town.yoshimi.saitama.jp/soshiki/shogaigakushuk/7/909.html','https://chocotabi-saitama.jp/spot/34445/'])]
r=json.load(open('data/evidence/issue60/human-answers-20261106/receipt.json'))['answers']
a=[]
for n,lat,lon,claim,urls in rows:
 original=next(x for x in r if x['number']==n)
 a.append(dict(number=n,facilityId=original['facilityId'],name=original['heading'],reportedCoordinate={'lat':lat,'lng':lon},reportedConfirmationDate='2026-11-06',reportedAcquisitionMethod='利用者によるGoogle地図の建物クリック取得',statement=claim,urls=urls,evidenceClass='user_report_not_independently_verified'))
(O/'user-report.json').write_text(json.dumps(a,ensure_ascii=False,indent=2)+'\n')
def fetch(item):
 name,url=item
 from urllib.parse import urlsplit,urlunsplit,quote
 s=urlsplit(url);url=urlunsplit((s.scheme,s.netloc,quote(s.path,safe='/%'),s.query,s.fragment))
 rec=dict(name=name,url=url,attemptedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=30) as f:b=f.read();rec.update(status=f.status,finalURL=f.url,contentType=f.headers.get('Content-Type'))
  p=O/'raw'/name;p.write_bytes(b);rec.update(path=str(p),sha256=hashlib.sha256(b).hexdigest(),bytes=len(b))
  if 'html' in rec['contentType']:
   s=b.decode('utf-8',errors='replace');(O/'raw'/(name+'.txt')).write_text(html.unescape(re.sub('<[^>]+>', '\n', s)));rec['images']=re.findall(r'<img[^>]+>',s)
 except Exception as e:rec['error']=str(e)
 return rec
if __name__=='__main__':
 items=[(f'{x["number"]}-{i}'+('.jpg' if u.endswith('.jpg') else '.html'),u) for x in a for i,u in enumerate(x['urls'])]
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:recs=list(ex.map(fetch,items))
 (O/'retrievals.json').write_text(json.dumps(recs,ensure_ascii=False,indent=2)+'\n')
 print([(x['name'],x.get('status'),x.get('error')) for x in recs])
