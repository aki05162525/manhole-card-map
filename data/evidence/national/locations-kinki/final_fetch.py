from research import *
rs=json.load(open(ROOT/'research-index.json'))
extra={188:['https://www.city.nara.lg.jp/site/shisetsu/6240.html','https://www.kuruminoki.co.jp/shikanofune/mayu/information/'],189:['https://www.city.yamatokoriyama.lg.jp/shiseijoho/shisetsu/shisetsunodenwabangoichiran/5617.html'],196:['https://www.town.sango.nara.jp/uploaded/life/13215_20624_misc.pdf'],205:['https://www.town.aridagawa.lg.jp/section/reiki/reiki_honbun/r275RG00000653.html'],64:['https://www.sakai-tcb.or.jp/assets/js/app.js?20261022-104320']}
for i,us in extra.items():
 for u in us:
  m=fetch(u);print(i,u,m.get('status'));rs[i].setdefault('followLinks',[]).append({'url':u,'label':'追加施設調査','from':'公式検索'})
save(ROOT/'research-index.json',rs)
for u in ['https://www.real-ninjakan.com/','https://www.sakai-tcb.or.jp/spot/detail/1164','https://www.city.kashiwara.lg.jp/docs/2022030100022/?doc_id=20497','https://ikaruga-kanko.com/info/']:
 m=cache.get(u);s=soup(m) if m else None
 if s:
  raw=str(s)
  for term in ['businessLocation','businessAddress','the_spot','1598','1-8-25']:
   k=raw.find(term)
   if k>=0:print(u,term,raw[max(0,k-50):k+700])
