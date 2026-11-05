import urllib.request,hashlib,json,pathlib,datetime
root=pathlib.Path('data/evidence/issue5/north');out=[]
for url in ['https://www.city.kitami.lg.jp/administration/detail.php?content=8822','https://www.city.fukushima-date.lg.jp/soshiki/30/index-2.html','https://www.city.bibai.hokkaido.jp/uploaded/attachment/6449.pdf','https://www.hakobura.jp/features/56']:
 r={'url':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(url,timeout=25) as f:
   b=f.read();p=root/(hashlib.sha256(url.encode()).hexdigest()[:20]+('.pdf' if url.endswith('.pdf') else '.html'));p.write_bytes(b);r.update(status=f.status,finalUrl=f.url,snapshotPath=str(p),snapshotSHA256=hashlib.sha256(b).hexdigest(),bytes=len(b))
 except Exception as e:r['error']=str(e)
 out.append(r);print(url,r.get('status',r.get('error')),flush=True)
(root/'fetch-support-records.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
