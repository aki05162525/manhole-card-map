import json,hashlib,datetime,pathlib,concurrent.futures,requests
from bs4 import BeautifulSoup
BASE=pathlib.Path('data/evidence/national/kanto-south-integration')
r=json.load(open('data/overrides/regions/kanto-south.json'));a=json.load(open('data/national/regions/kanto-south.json'))
changed=['12-100-B001','13-100-P101','13-206-A001','13-207-A001','13-214-E001']
urls={x['evidence']['sourceUrl'] for x in a['proposals']}
urls.update(x['evidence']['sourceUrl'] for x in r['relations'] if x['cardId'] in changed or x['cardId'].startswith(('14-206','14-208','13-224','13-214')) or not x['hours'])
urls.update(['https://www.city.yachiyo.lg.jp/uploaded/attachment/19983.pdf','https://www.city.urayasu.lg.jp/shisei/soshiki/1022197/1022263/1022270.html','https://www.city.ayase.kanagawa.jp/location/library/genre/publicfacility/17263.html'])
def fetch(u):
 out={'url':u,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  res=requests.get(u,timeout=45);out.update(status=res.status_code,finalUrl=res.url)
  if res.status_code==200:
   path=BASE/(hashlib.sha256(u.encode()).hexdigest()[:20]+('.pdf' if '.pdf' in u else '.html'));path.write_bytes(res.content)
   out.update(snapshotPath=str(path),sha256=hashlib.sha256(res.content).hexdigest())
   if path.suffix=='.html':
    res.encoding=res.apparent_encoding;soup=BeautifulSoup(res.text,'html.parser')
    for tag in soup(['script','style','nav','header','footer']):tag.decompose()
    path.with_suffix('.txt').write_text(soup.get_text('\n',strip=True))
 except Exception as e:out['error']=str(e)
 return out
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex: results=list(ex.map(fetch,sorted(urls)))
(BASE/'manifest.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print([(x['url'],x.get('status',x.get('error'))) for x in results])
