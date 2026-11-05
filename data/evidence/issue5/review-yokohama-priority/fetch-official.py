import urllib.request,json,pathlib,hashlib,datetime,gzip,concurrent.futures,subprocess
O=pathlib.Path('data/evidence/issue5/review-yokohama-priority');D=O.parent/'yokohama-priority'
rows=json.loads((D/'fetch-records.json').read_text()); g=next(r for r in rows if r['snapshotPath'].endswith('53391459.gml.gz'))
jobs=[('plateau-faq.html','https://www.mlit.go.jp/plateau/faq/'),('plateau-policy.html','https://www.mlit.go.jp/plateau/site-policy/'),('gsi-public-survey.html','https://service.gsi.go.jp/onestop/navi/nav6-1/'),('gsi-qa.html','https://www.gsi.go.jp/LAW/2930-qa.html'),('gml-live-hash-only',g['sourceUrl'])]
def fetch(job):
 name,url=job;t=datetime.datetime.now(datetime.timezone.utc).isoformat()
 try:
  with urllib.request.urlopen(url,timeout=90) as r:
   raw=r.read();status=r.status;final=r.url;err=None
 except Exception as e:
  err=str(e); proc=subprocess.run(['curl','--fail','--location','--max-time','90',url],capture_output=True)
  if proc.returncode: return {'sourceUrl':url,'fetchedAt':t,'error':err,'curlError':proc.stderr.decode(),'saved':False}
  raw=proc.stdout;status=200;final=url
 out={'sourceUrl':url,'fetchedAt':t,'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':status,'finalUrl':final,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'urllibErrorBeforeCurlFallback':err}
 if name=='gml-live-hash-only':
  out['matchesArchivedUncompressedOriginal']=raw==gzip.decompress(pathlib.Path(g['snapshotPath']).read_bytes());assert out['matchesArchivedUncompressedOriginal']
 else:
  (O/name).write_bytes(raw);out['snapshotPath']=str(O/name)
 return out
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex: results=list(ex.map(fetch,jobs))
(O/'official-fetch-records.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n');print(json.dumps(results,ensure_ascii=False,indent=2))
