from research import *
us=['https://tokyotouristinfo.com/search/'+str(n) for n in range(20,501,20)]
for u in us:
 fetch(u);write(ROOT/'manifest.json',new)
rows=list(dict.fromkeys((t,v) for u in us+['https://tokyotouristinfo.com/search'] for t,v in links(u) if t and '/detail/' in v))
(ROOT/'tourism-list.txt').write_text('\n'.join(t+' '+v for t,v in rows))
