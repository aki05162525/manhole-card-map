from research import *
j=read(ROOT/'extra.json')
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
 for r in ex.map(fetch,list(dict.fromkeys(u for us in j.values() for u in us))):write(ROOT/'manifest.json',new)
for i,us in j.items():
 print('\n',i,P[int(i)]['name'])
 for u in us:
  print(u)
  for c in candidates(u):
   if len(c)<2200:print(c)
