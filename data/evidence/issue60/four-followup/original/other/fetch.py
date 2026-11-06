import urllib.request,pathlib,json,hashlib,datetime,concurrent.futures
O=pathlib.Path('/tmp/issue60-recheck-third-other'); urls={'11-map.pdf':'https://kinuten.com/hp7/wp-content/uploads/9_map2026_m.pdf','36-blog.html':'https://blog.livedoor.jp/localforfuchu/archives/52890337.html','36-town.pdf':'https://www.town.yoshimi.saitama.jp/material/files/group/2/kouhou1707.pdf','30-travel.html':'https://machi-ga.com/mcard/number00121.html','30-official.html':'https://www.saitama-swg.or.jp/manholecard.html'}
def get(kv):
 name,url=kv;r={'url':url,'path':str(O/'raw'/name),'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(url,timeout=35) as f: b=f.read();r.update(status=f.status,finalURL=f.url)
  (O/'raw'/name).write_bytes(b);r.update(sha256=hashlib.sha256(b).hexdigest(),bytes=len(b))
 except Exception as e:r['error']=str(e)
 return r
r=list(concurrent.futures.ThreadPoolExecutor(5).map(get,urls.items()));(O/'retrievals.json').write_text(json.dumps(r,indent=2));print(r)
