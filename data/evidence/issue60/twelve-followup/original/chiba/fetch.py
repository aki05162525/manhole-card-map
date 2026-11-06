import requests,json,hashlib,datetime,concurrent.futures
from pathlib import Path
from bs4 import BeautifulSoup
out=Path('/tmp/issue60-recheck-chiba-nov6')
urls={'tateyama':'https://www.city.tateyama.chiba.jp/minato/page100034.html','nagisa.pdf':'https://www.pa.ktr.mlit.go.jp/kyoku/oasis/file/nagisa-station.pdf','museum':'https://www.city.tateyama.chiba.jp/hakubutukan/page020599.html','south':'https://www.city.sodegaura.lg.jp/soshiki/public-facility-management/tyousyaseibikouzi-minamityousya.html','hall':'https://www.city.sodegaura.lg.jp/soshiki/kanzai/chousyaannai.html','card':'https://www.city.sodegaura.lg.jp/soshiki/gesui/sodegaura-mannho-ru.html','togane':'https://minorinosato-togane.com/sisetsu','ryokuka':'https://minorinosato-togane.com/sisetsu/ryokuka','station':'https://www.kanto-michinoeki.jp/archives/17396.html','yachiyo':'https://yachiyo.kokosil.net/ja/place/00001c00000000000002000000510211'}
def get(kv):
 k,u=kv
 try:
  r=requests.get(u,timeout=40); b=r.content; p=out/(k if k.endswith('.pdf') else k+'.html');p.write_bytes(b)
  if not k.endswith('.pdf'):
   s=BeautifulSoup(b,'html.parser'); (out/(k+'.txt')).write_text(s.get_text('\n',strip=True)); (out/(k+'-links.json')).write_text(json.dumps([dict(tag=t.name,**t.attrs) for t in s.select('img, a[href]')],ensure_ascii=False,indent=2))
  return dict(key=k,url=u,finalURL=r.url,status=r.status_code,path=str(p),sha256=hashlib.sha256(b).hexdigest(),fetchedAt=datetime.datetime.now(datetime.timezone.utc).isoformat())
 except Exception as e:return dict(key=k,url=u,error=str(e))
r=list(concurrent.futures.ThreadPoolExecutor(8).map(get,urls.items()));(out/'retrievals.json').write_text(json.dumps(r,indent=2));print(r)
