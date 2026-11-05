from research import *
us={0:['https://www.jswa.go.jp/kensyu/access/','https://www.jswa.go.jp/company/50th-anniversary/pdf/access.pdf'],2:['https://akabanemuseum.ur-net.go.jp/information/'],5:['https://maps.google.com/?cid=13715612929119723605'],12:['https://www.google.com/maps?cid=14117040149767843057'],31:['https://udx.jp/access/'],56:['https://musashisakai-syouren.com/'],58:['https://kanko.mitaka.ne.jp/about/accsess.html']}
e=read(ROOT/'extra.json')
for i,urls in us.items():
 e.setdefault(str(i),[]).extend(u for u in urls if u not in e.get(str(i),[]))
 for u in urls:
  r=fetch(u);write(ROOT/'manifest.json',new);print(i,u,r.get('status'),r.get('finalUrl'));print(candidates(u) if not '.pdf' in u else 'PDF')
write(ROOT/'extra.json',e)
