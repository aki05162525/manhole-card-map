import json,hashlib,pathlib,urllib.request,datetime,concurrent.futures
root=pathlib.Path('data/evidence/issue7/review-kinki-east')
urls=[
'https://www.city.kyotango.lg.jp/top/shisei/gaiyo/4/6116.html',
'https://www.city.kyotango.lg.jp/material/files/group/3/20260401.pdf',
'https://www.city.hikone.lg.jp/kurashi/suidou/5/29782.html',
'https://www.town.ujitawara.kyoto.jp/soshiki/yakuba/yakubashokai/518.html',
'https://www.city.koka.lg.jp/1119.htm',
'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-v3_0.html',
'https://nlftp.mlit.go.jp/ksj/other/agreement.html']
def fetch(url):
 r={'sourceUrl':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fetchedAtDefinition':'request start UTC'}
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=40) as f:
   b=f.read();p=root/(hashlib.sha256(url.encode()).hexdigest()[:20]+('.pdf' if url.endswith('.pdf') else '.html'));p.write_bytes(b)
   r.update(snapshotPath=str(p),snapshotSHA256=hashlib.sha256(b).hexdigest(),status=f.status,finalUrl=f.url)
 except Exception as e:r['error']=str(e)
 return r
with concurrent.futures.ThreadPoolExecutor(max_workers=7) as ex:r=list(ex.map(fetch,urls))
(root/'fetch-log.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(r,ensure_ascii=False,indent=2))
