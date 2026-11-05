from research import *
urls=['https://www.jswa.go.jp/kensyu/access/','https://tokyotouristinfo.com/detail/J0007','https://tokyotouristinfo.com/detail/J0004','https://tokyotouristinfo.com/detail/M0051','https://tokyotouristinfo.com/detail/M0119']+['https://tokyotouristinfo.com/search'+('/'+str(n) if n else '') for n in range(0,501,50)]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
 for r in ex.map(fetch,urls):write(ROOT/'manifest.json',new);print(r['url'],r.get('status'),flush=True)
for u in urls:
 if '/search' in u:
  for t,v in links(u):
   if '/detail/' in v:print(t[:150],v)
 else:print(u,candidates(u))
