import urllib.request,sys,json,hashlib,datetime,time
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urljoin
root=Path('data/work/location-batch2/kinki-west'); log=Path('data/evidence/location-batch2/kinki-west/retrievals.json')
records=json.loads(log.read_text()) if log.exists() else []
for url in sys.argv[1:]:
 start=time.monotonic(); row={'url':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=35) as res:
   data=res.read(); ext=Path(url.split('?')[0]).suffix; ext=ext if ext in ['.pdf','.csv','.xlsx','.zip','.png','.jpg','.md'] else '.html'; p=root/(hashlib.sha256(url.encode()).hexdigest()[:16]+ext); p.write_bytes(data); row.update(path=str(p),sha256=hashlib.sha256(data).hexdigest(),status=res.status,finalUrl=res.url,contentType=res.headers.get('Content-Type'),lastModified=res.headers.get('Last-Modified'))
  print(json.dumps(row,ensure_ascii=False))
  if ext=='.html':
   class Links(HTMLParser):
    def handle_starttag(self,tag,attrs):
     a=dict(attrs)
     if tag=='a' and 'href' in a: self.href=urljoin(url,a['href'])
    def handle_data(self,d):
     if getattr(self,'href',None) and any(k in d for k in ['施設','庁舎','CSV','csv','Excel','鹿の舟','図','カタログ','利用規約']): print(d.strip(),self.href)
   Links().feed(data.decode('utf-8',errors='replace'))
 except Exception as e: row['error']=str(e); print(row)
 row['elapsedSeconds']=round(time.monotonic()-start,3); records.append(row); log.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
