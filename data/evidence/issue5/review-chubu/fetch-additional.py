import json,urllib.request,urllib.parse,hashlib,datetime,re,concurrent.futures
from pathlib import Path
R=Path('data/evidence/issue5/review-chubu')
urls={'oyabe-layout.html':'https://www.city.oyabe.toyama.jp/shiseijyouhou/1003255/1003256.html','oyabe-revised.html':'https://www.city.oyabe.toyama.jp/shiseijyouhou/1003255/1006300/1007958.html','p05-spec.pdf':'https://nlftp.mlit.go.jp/ksj/gml/product_spec/KS-PS-P05-v3_0.pdf','yoshida-layout.html':'https://www.town.yoshida.shizuoka.jp/2319.htm','numazu-layout.html':'https://www.city.numazu.shizuoka.jp/kurashi/shisetsu/office_map/index.htm','chikuma-building.html':'https://www.chikuma-bunka.jp/shisetsu_goannai/kamiyamadabunkakaikan/2322.html'}
def get(kv):
 n,u=kv;r={'sourceUrl':u}
 try:
  with urllib.request.urlopen(u,timeout=35) as f:b=f.read();r.update(status=f.status,finalUrl=f.url)
  (R/n).write_bytes(b);r.update(snapshotPath=str(R/n),snapshotSHA256=hashlib.sha256(b).hexdigest())
 except Exception as e:r['error']=str(e)
 r['fetchedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();return r
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:rows=list(ex.map(get,urls.items()))
for r in rows:
 if r.get('snapshotPath','').endswith('.html'):
  t=Path(r['snapshotPath']).read_text();print(Path(r['snapshotPath']).name)
  for u,label in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',t,re.S):
   if any(w in label for w in ['配置','概要版','2階','２階','庁舎案内','平面']):print(urllib.parse.urljoin(r['sourceUrl'],u),re.sub('<[^>]+>','',label).strip())
(R/'fetch-additional-records.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n');print([(Path(r.get('snapshotPath','')).name,r.get('error',r.get('status'))) for r in rows])
