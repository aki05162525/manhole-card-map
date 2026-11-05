import json,pathlib,re,hashlib,datetime,time,threading,concurrent.futures,urllib.parse,requests
from bs4 import BeautifulSoup
ROOT=pathlib.Path('data/evidence/national/locations-kinki');OLD=pathlib.Path('data/evidence/national/kinki')
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
original=json.load(open(OLD/'manifest.json')); fresh=json.load(open(ROOT/'manifest.json')) if (ROOT/'manifest.json').exists() else []
cache={m['url']:m for m in original+fresh};locks={};last={}
places=[p for p in json.load(open('data/overrides/regions/kinki.json'))['places'] if not p.get('coordinate')]
def soup(m):
 if m.get('status')!=200 or 'html' not in m.get('contentType',''):return None
 b=pathlib.Path(m['snapshotPath']).read_bytes();s=BeautifulSoup(b,'html.parser');return s

def fetch(u):
 if u in cache:return cache[u]
 host=urllib.parse.urlparse(u).netloc
 with locks.setdefault(host,threading.Lock()):
  time.sleep(max(0,1.1-(time.monotonic()-last.get(host,0))));last[host]=time.monotonic()
  m={'url':u,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  try:
   r=requests.get(u,timeout=25,headers={'User-Agent':'ManholeCardMap evidence research/1.0'});m.update(status=r.status_code,finalUrl=r.url,contentType=r.headers.get('Content-Type',''))
   b=r.content;p=ROOT/'snapshots'/(hashlib.sha256(u.encode()).hexdigest()[:20]+'.html');p.write_bytes(b);m.update(snapshotPath=str(p),snapshotSHA256=hashlib.sha256(b).hexdigest())
  except Exception as e:m['error']=str(e)
  cache[u]=m;fresh.append(m)
  save(ROOT/'manifest.json',fresh)
  return m

def links(m):
 s=soup(m)
 if s is None:return []
 out=[]
 for a in s.select('a[href]'):
  try:out.append((a.get_text(' ',strip=True),urllib.parse.urljoin(m.get('finalUrl',m['url']),a.get('href','')).split('#')[0]))
  except ValueError:pass
 return out

def tokens(p):
 name=p['name'];return [name]+[x for x in re.split(r'[ （(「」)）・、/]|[１２３123]階',name) if len(x)>=4]
def relevant(p,label):
 return any(t in label for t in tokens(p))

def prepare():
 records=[]
 audit=json.load(open('data/national/regions/kinki.json'))
 for p in places:
  urls={p['evidence']['sourceUrl']}
  for c in audit['cards']:
   for r in c['relations']:
    if r.get('facilityId')==p['id']:urls.update(r.get('sourceUrls',[]))
  candidates=[]
  for u in sorted(urls):
   if u not in cache:continue
   for label,v in links(cache[u]):
    if not v.startswith(('https://','http://')) or re.search(r'google|facebook|twitter|instagram|youtube|\.pdf',v):continue
    if relevant(p,label) or (re.search('アクセス|交通案内|所在地|庁舎案内|施設案内',label) and len(label)<60):candidates.append({'label':label,'url':v,'from':u})
  records.append({'facilityId':p['id'],'name':p['name'],'address':p['address'],'sourceUrls':sorted(urls),'links':list({x['url']:x for x in candidates}.values())})
 save(ROOT/'research-index.json',records)
 return records
if __name__=='__main__':
 import sys
 if sys.argv[-1]=='prepare':
  rec=prepare();urls=sorted({x['url'] for r in rec for x in r['links']});print(len(rec),len(urls))
  with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:list(ex.map(fetch,urls))
  save(ROOT/'manifest.json',fresh)
