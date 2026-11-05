from research import *
from decisions import D
for p in P:
 i=p['index']
 if i in D:continue
 print('\n',i,p['name'])
 us=list(dict.fromkeys(p['urls']+read(ROOT/'extra.json').get(str(i),[])))
 for u in us:
  for t,v in links(u):
   if any(k in t+v.lower() for k in ['access','google','アクセス','交通','地図','武蔵境','数馬','下笹目','大手町']): print(t[:40],v)
