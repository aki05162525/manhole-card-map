import json,pathlib,urllib.request,urllib.parse,hashlib,datetime,time,re,html,sys
ROOT=pathlib.Path('data/evidence/national/kanto-south-locations-kanagawa')
MP=ROOT/'manifest.json'
M=json.loads(MP.read_text()) if MP.exists() else []
OLD=json.load(open('data/evidence/national/kanto-south/manifest.json'))
def save():MP.write_text(json.dumps(M,ensure_ascii=False,indent=2)+'\n')
def fetch(u):
 for r in M:
  if r['url']==u:return r
 for r in OLD:
  if r['url']==u:
   r=dict(r);r['reusedFrom']='data/evidence/national/kanto-south/manifest.json';M.append(r);save();return r
 time.sleep(1.05);r={'url':u,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=25) as f:
   b=f.read();r.update(status=f.status,finalUrl=f.url,contentType=f.headers.get('Content-Type',''))
  p=ROOT/(hashlib.sha256(u.encode()).hexdigest()[:20]+('.pdf' if 'pdf' in r['contentType'] else '.html'));p.write_bytes(b);r.update(snapshotPath=str(p),sha256=hashlib.sha256(b).hexdigest())
 except Exception as e:r['error']=str(e)
 M.append(r);save();return r
def read(r):
 if not r.get('snapshotPath'):return ''
 b=pathlib.Path(r['snapshotPath']).read_bytes()
 for enc in ['utf-8','cp932']:
  try:return b.decode(enc)
  except:pass
 return b.decode('utf-8','replace')
def links(s,u):
 return [(urllib.parse.urljoin(u,html.unescape(h)),html.unescape(re.sub('<[^>]*>','',t)).strip()) for h,t in re.findall(r'<a[^>]+href=[\"\']([^\"\']+)[\"\'][^>]*>(.*?)</a>',s,re.S)]
def inspect(u):
 r=fetch(u);s=read(r);print('\nURL',u,r.get('status',r.get('error')))
 for m in re.finditer(r'(?:35\.\d{3,}|139\.\d{3,}|iframe|latitude|longitude|maps/embed)',s):print(re.sub(r'\s+',' ',html.unescape(s[max(0,m.start()-90):m.end()+150])))
 for h,t in links(s,u):
  if re.search('アクセス|地図|交通案内|施設案内|利用案内',t):print('LINK',t,h)
if __name__=='__main__':
 for u in sys.argv[1:]:inspect(u)
