import json, pathlib,urllib.parse,re
from html.parser import HTMLParser
from collect import ROOT
from read_sources import decode
class Links(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.u=None;self.t=''
 def handle_starttag(self,t,a):
  if t=='a': self.u=dict(a).get('href');self.t=''
 def handle_data(self,s):
  if self.u:self.t+=s
 def handle_endtag(self,t):
  if t=='a' and self.u:self.links.append((self.u,self.t));self.u=None
m=json.load(open(ROOT/'manifest.json'));seen={r['url'] for r in m};out=[]
for r in m:
 if r.get('status')!=200:continue
 p=Links();p.feed(decode(pathlib.Path(r['snapshotPath']).read_bytes()))
 for u,t in p.links:
  url=urllib.parse.urljoin(r.get('finalUrl',r['url']),u).split('#')[0]
  if url in seen or not url.startswith(('http:','https:')):continue
  if re.search('マンホールカード|配布再開|配布場所',t) and not re.search('gk-p.jp|twitter|facebook|\.pdf|\.jpg',url):
   seen.add(url);out.append(url)
json.dump(out,open(ROOT/'supplement-urls.json','w'),ensure_ascii=False,indent=2);print(len(out))
