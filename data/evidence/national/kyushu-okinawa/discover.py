from research import *
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.u=None;self.t=[]
 def handle_starttag(self,t,a):
  if t=='a':self.u=dict(a).get('href');self.t=[]
 def handle_data(self,d):
  if self.u:self.t.append(d)
 def handle_endtag(self,t):
  if t=='a' and self.u:self.links.append((self.u,''.join(self.t).strip()));self.u=None
m=json.load(open(MAN));out=[]
for i,e in enumerate(m):
 if e.get('status')!=200:continue
 p=Links();p.feed(Path(e['snapshotPath']).read_bytes().decode('utf-8','replace'))
 for u,t in p.links:
  if 'マンホールカード' in t and not any(w in u for w in ['gk-p.jp','twitter','facebook']):
   u=urllib.parse.urljoin(e.get('finalUrl',e['url']),u)
   if u not in [x['url'] for x in m] and u not in out and u.startswith('http'):
    print(i,t,u);out.append(u)
extra=['https://ashikan.jp/','https://www.city.minamisatsuma.lg.jp/living/tetsuzuki/suido/e027669.html','https://www.city.kurume.fukuoka.jp/1050kurashi/2090suidougasu/3170gesui/2017-1122-1321-150.html']
(ROOT/'extra-urls.json').write_text(json.dumps(out+extra,ensure_ascii=False,indent=2))
