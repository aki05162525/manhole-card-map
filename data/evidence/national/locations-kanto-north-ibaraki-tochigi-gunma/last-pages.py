from research import *
e=json.load(open(ROOT/'extra-queue.json'))
q={17:['https://www.city.yuki.lg.jp/machizukurikyoudouka/about/page002404.html'],99:['https://www.town.kusatsu.gunma.jp/www/contents/1513640181830/index.html','https://toukei.pref.gunma.jp/zu240068/'],102:['https://www.town.meiwa.gunma.jp/life/soshiki/sangyoukankyo/meichanchi/348.html']}
for i,us in q.items():
 for u in us:
  e.setdefault(str(i),[]).append(u);m=fetch(u);d=inspect(m);print(i,u,d['status'],d['numeric'][:3]);print([a for a in d['links'] if re.search('map|地図|位置',a['url']+' '+a['label'])][-12:])
dump('extra-queue.json',e)
