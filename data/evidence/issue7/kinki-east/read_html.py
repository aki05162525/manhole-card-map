from html.parser import HTMLParser
from html import unescape
import re
class Parser(HTMLParser):
 def __init__(self,s):
  super().__init__();self.text=[];self.links=[];self.a=None;self.skip=0;self.feed(s)
 def handle_starttag(self,t,a):
  if t in ['script','style']:self.skip+=1
  if t=='a':self.a=[dict(a).get('href',''),'']
 def handle_endtag(self,t):
  if t in ['script','style']:self.skip=max(0,self.skip-1)
  if t=='a' and self.a:self.links.append(self.a);self.a=None
 def handle_data(self,d):
  if not self.skip:
   self.text.append(d.strip())
   if self.a:self.a[1]+=d.strip()
 def txt(self):return ' '.join(x for x in self.text if x)
def parse(b):
 m=re.search(br'charset=["\s]*([\w-]+)',b[:5000]);enc=m[1].decode() if m else 'utf-8'
 try:return Parser(b.decode(enc,errors='replace'))
 except LookupError:return Parser(b.decode('utf-8',errors='replace'))
if __name__=='__main__':
 import json,pathlib
 for x in json.load(open('data/evidence/issue7/kinki-east/fetch-log.json')):
  p=parse(pathlib.Path(x['snapshotPath']).read_bytes());t=p.txt();i=t.find('配布場所');i=max(0,i-80);print('\nURL',x['sourceUrl'],'\n',t[i:i+1600]);print('LINKS',[(label,href) for href,label in p.links if re.search('案内|アクセス|地図|所在地|センター|庁舎|観光|資料館|記念館|博物館',label)][-16:])
