import urllib.request,urllib.error,json,hashlib,datetime,pathlib,concurrent.futures
ROOT=pathlib.Path('data/evidence/issue5/chubu')
URLS={
 'tsubame-card':'https://www.city.tsubame.niigata.jp/soshiki/toshi_seibi/2/1/967.html',
 'chikuma-card':'https://www.city.chikuma.lg.jp/kanko_bunka_sports/event/all/4193.html',
 'chikuma-facilities':'https://www.city.chikuma.lg.jp/kosodate_kyoiku/gakko_kyoikushisetsu/3209.html',
 'murakami-card':'https://www.city.murakami.lg.jp/soshiki/139/gesuido-mhcard.html',
 'numazu-card':'https://www.city.numazu.shizuoka.jp/kurashi/sumai/suido/shokai/sewage_line/mhcard.htm',
 'sado-offices':'https://www.city.sado.niigata.jp/soshiki/2028/55002.html',
 'p05-catalog':'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-v3_0.html',
 'p05-terms':'https://nlftp.mlit.go.jp/ksj/other/agreement.html',
 'mizuho-card':'https://www.city.mizuho.lg.jp/12757.htm',
 'oyabe-card':'https://www.city.oyabe.toyama.jp/kurashi/1002194/1002217/1002218.html',
 'sado-new-office':'https://www.city.sado.niigata.jp/uploaded/attachment/41399.pdf'
}
def fetch(kv):
 key,url=kv;p=ROOT/(key+('.pdf' if url.endswith('.pdf') else '.html'))
 if p.exists(): raise RuntimeError('refuse overwrite '+str(p))
 m={'sourceUrl':url,'requestedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actorType':'ai'}
 try:
  with urllib.request.urlopen(url,timeout=35) as r:
   b=r.read();m.update(status=r.status,finalUrl=r.url,contentType=r.headers.get('Content-Type'))
  p.write_bytes(b);m.update(fetchedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),snapshotPath=str(p),snapshotSHA256=hashlib.sha256(b).hexdigest(),bytes=len(b))
 except Exception as e:m['error']=str(e)
 (ROOT/(key+'.source.json')).write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');return key,m.get('status'),m.get('error')
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
  for r in ex.map(fetch,URLS.items()):print(r)
