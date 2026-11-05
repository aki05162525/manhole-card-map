import json,re,pathlib,html,sys,unicodedata
from html.parser import HTMLParser
from collect import ROOT,CARDS,D
class Text(HTMLParser):
 def __init__(self):super().__init__();self.parts=[];self.skip=0
 def handle_starttag(self,t,a):
  if t in ['script','style','noscript']:self.skip+=1
  if t in ['p','div','br','tr','li','h1','h2','h3','h4','td','section','dt','dd']:self.parts.append('\n')
 def handle_endtag(self,t):
  if t in ['script','style','noscript']:self.skip=max(0,self.skip-1)
  if t in ['p','div','tr','li','h1','h2','h3','h4','td']:self.parts.append('\n')
 def handle_data(self,s):
  if not self.skip:self.parts.append(s)
def decode(b):
 enc=re.search(br'charset\s*=\s*["\']?([\w-]+)',b[:10000],re.I)
 for e in ([enc.group(1).decode()] if enc else [])+['utf-8','cp932','euc-jp']:
  try:return b.decode(e)
  except (UnicodeError,LookupError):pass
 return b.decode('utf-8',errors='replace')
def text(r):
 if not r.get('snapshotPath') or r.get('status')!=200:return ''
 p=Text();p.feed(decode(pathlib.Path(r['snapshotPath']).read_bytes()));return '\n'.join(s.strip() for s in ''.join(p.parts).splitlines() if s.strip())
def excerpt(s):
 lines=s.splitlines(); hits=set()
 for i,l in enumerate(lines):
  if 'マンホールカード' in l or '配布' in l:
   hits.update(range(max(0,i-2),min(len(lines),i+16)))
 return '\n'.join(lines[i] for i in sorted(hits))
if __name__=='__main__':
 m={r['url']:r for r in json.load(open(ROOT/'manifest.json'))};pref=sys.argv[1] if len(sys.argv)>1 else ''
 for c in CARDS:
  if not c['id'].startswith(pref):continue
  print('\n###',c['id'],c['city'],'\nBASE',c['placeText'],c['hours'])
  for u in c['links'] or []:
   r=m.get(u,{});s=text(r);print('URL',u,'RESULT',r.get('status',r.get('error','not fetched')));print(excerpt(s)[:9000])
