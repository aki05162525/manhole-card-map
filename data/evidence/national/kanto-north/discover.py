import research as R,json,re,urllib.parse
from html.parser import HTMLParser
class A(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.href=None;self.txt=''
 def handle_starttag(self,t,a):
  if t=='a':self.href=dict(a).get('href');self.txt=''
 def handle_data(self,s):
  if self.href:self.txt+=s
 def handle_endtag(self,t):
  if t=='a' and self.href:self.links.append((self.href,self.txt));self.href=None
m=json.load(open(R.MAN));urls=[]; discover=[]
for r in m:
 if not r.get('snapshotPath') or not 200<=r.get('status',0)<300:continue
 b=R.pathlib.Path(r['snapshotPath']).read_bytes();html=R.decode(b);p=A();p.feed(html);base=r.get('finalUrl',r['url']);cnt=0
 for target in re.findall(r'CONTENT=[\'"]0;URL=([^\'\"]+)',html,re.I):urls.append(urllib.parse.urljoin(base,target))
 for href,label in p.links:
  u=urllib.parse.urljoin(base,href)
  if not u.startswith(('http:','https:')) or 'gk-p.jp' in u:continue
  if re.search('マンホールカード|配布場所一覧|アクセス|交通案内|所在地',label):
   if re.search('アクセス|交通案内|所在地',label):
    if cnt>=2:continue
    cnt+=1
   if '.pdf' in u and '配布場所一覧' not in label:continue
   urls.append(u);discover.append({'from':r['url'],'url':u,'label':label.strip()})
urls+=['https://www.city.utsunomiya.lg.jp/josuido/user/1018745/1012918.html']
(R.ROOT/'discovered-links.json').write_text(json.dumps(discover,ensure_ascii=False,indent=2))
(R.ROOT/'additional-urls.json').write_text(json.dumps(list(dict.fromkeys(urls)),ensure_ascii=False,indent=2))
R.run(urls)
