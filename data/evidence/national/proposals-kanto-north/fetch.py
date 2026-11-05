import urllib.request,urllib.error,pathlib,json,hashlib,time,datetime,sys
from html.parser import HTMLParser
ROOT=pathlib.Path('data/evidence/national/proposals-kanto-north')
class Text(HTMLParser):
 def __init__(self):super().__init__();self.parts=[];self.skip=0
 def handle_starttag(self,tag,attrs):
  if tag in ("script","style"):self.skip+=1
 def handle_endtag(self,tag):
  if tag in ("script","style"):self.skip=max(0,self.skip-1)
 def handle_data(self,s):
  if not self.skip and s.strip():self.parts.append(s.strip())
def fetch(url):
 p=ROOT/(hashlib.sha256(url.encode()).hexdigest()[:20]+'.html');m=p.with_suffix('.json')
 if m.exists():return json.loads(m.read_text())
 rec={'url':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(url,timeout=35) as r:body=r.read();rec.update(status=r.status,finalUrl=r.url)
 except urllib.error.HTTPError as e:body=e.read();rec.update(status=e.code,error=str(e))
 except Exception as e:body=b'';rec['error']=str(e)
 if body:
  p.write_bytes(body);rec.update(snapshotPath=str(p),snapshotSHA256=hashlib.sha256(body).hexdigest());t=Text();t.feed(body.decode('utf-8',errors='replace'));p.with_suffix('.txt').write_text('\n'.join(t.parts))
 m.write_text(json.dumps(rec,ensure_ascii=False,indent=2)+'\n');time.sleep(1.1);return rec
if __name__=='__main__':
 for url in sys.argv[1:]: print(json.dumps(fetch(url),ensure_ascii=False))
