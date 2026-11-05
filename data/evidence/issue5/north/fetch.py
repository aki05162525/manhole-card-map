import urllib.request,urllib.error,json,hashlib,datetime,pathlib
root=pathlib.Path('data/evidence/issue5/north')
urls=[
'https://www.city.bibai.hokkaido.jp/site/suidou/29785.html',
'https://www.city.bibai.hokkaido.jp/soshiki/18/',
'https://www.city.koriyama.lg.jp/site/jougesuidou/5690.html',
'https://www.city.koriyama.lg.jp/soshiki/185/index-2.html',
'https://www.city.furano.hokkaido.jp/life/docs/2020061000014.html',
'https://www.city.kitami.lg.jp/administration/life/detail.php?content=9605',
'https://hakomachi.com/',
'https://www.city.fukushima-date.lg.jp/soshiki/25/68027.html',
'https://www.city.kushiro.lg.jp/kurashi/suidou/1004657/1014085.html',
'https://www.city.chitose.lg.jp/c70/1002771/1002772/1005528.html']
records=[]
for url in urls:
 row={'url':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=25) as r:
   b=r.read();p=root/(hashlib.sha256(url.encode()).hexdigest()[:20]+'.html');p.write_bytes(b)
   row.update(status=r.status,finalUrl=r.url,snapshotPath=str(p),snapshotSHA256=hashlib.sha256(b).hexdigest(),bytes=len(b),contentType=r.headers.get('Content-Type'))
 except Exception as e:row['error']=str(e)
 records.append(row);print(row['url'],row.get('status',row.get('error')),flush=True)
(root/'fetch-records.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
