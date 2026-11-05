import json,urllib.request,hashlib,datetime,concurrent.futures
from pathlib import Path
R=Path('data/evidence/issue5/review-chubu');d=json.loads(Path('data/national/issue5/chubu.json').read_text())
urls={Path(e['snapshotPath']).name:e['sourceUrl'] for u in d['updates'] for e in u['supportingEvidence']}
urls.update({'oyabe-plan.html':'https://www.city.oyabe.toyama.jp/shiseijyouhou/1003255/1006300/1007837.html','oyabe-index.html':'https://www.city.oyabe.toyama.jp/shiseijyouhou/1003255/1006300/index.html','iwata-building.html':'https://www.city.iwata.shizuoka.jp/shiseijouhou/soshikiannai/choushaannai/1004456.html','chikuma-plan.pdf':'https://www.city.chikuma.lg.jp/material/files/group/7/r7kouteihyoumatome.pdf','tsubame-opening.pdf':'https://www.city.tsubame.niigata.jp/material/files/group/6/100522621.pdf','p05-catalog.html':d['updates'][0]['datasetEvidence']['catalogEvidence']['sourceUrl'],'p05-terms.html':d['updates'][0]['datasetEvidence']['termsEvidence']['sourceUrl']})
def get(kv):
 n,u=kv;r={'sourceUrl':u,'requestedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=40) as f:b=f.read();r.update(status=f.status,finalUrl=f.url)
  (R/n).write_bytes(b);r.update(snapshotPath=str(R/n),snapshotSHA256=hashlib.sha256(b).hexdigest(),bytes=len(b))
 except Exception as e:r['error']=str(e)
 r['fetchedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();return r
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: rows=list(pool.map(get,urls.items()))
(R/'fetch-records.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print([(r['sourceUrl'],r.get('status',r.get('error'))) for r in rows])
