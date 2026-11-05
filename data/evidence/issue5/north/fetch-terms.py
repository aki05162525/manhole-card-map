import urllib.request,hashlib,json,pathlib,datetime
p=pathlib.Path('data/evidence/issue5/north');u='https://www.google.com/intl/en/help/terms_maps/'
r={'url':u,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
try:
 with urllib.request.urlopen(u,timeout=25) as f:
  b=f.read();dest=p/'google-maps-terms.html';dest.write_bytes(b);r.update(status=f.status,finalUrl=f.url,snapshotPath=str(dest),snapshotSHA256=hashlib.sha256(b).hexdigest(),bytes=len(b))
except Exception as e:r['error']=str(e)
(p/'terms-fetch-record.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(r)
