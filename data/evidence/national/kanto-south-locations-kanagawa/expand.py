from research import *
for r in list(M):
 if r['url'].startswith('https://www.google.'):continue
 s=read(r)
 for u in re.findall(r'<iframe[^>]*src="([^"]+)',s):
  if 'maps/embed' not in u:continue
  u=html.unescape(u)
  if any(x['url']==u for x in M):continue
  rr=fetch(u);rr['linkedFrom']=r['url'];save();ss=read(rr);print('\nPARENT',r['url'],rr.get('status',rr.get('error')))
  for m in re.finditer(r'\[35\.\d{4,},139\.\d+\]',ss):print(ss[max(0,m.start()-180):m.end()+120])
for r in list(M):
 if '0000116229' in r['url']:
  for u,t in links(read(r),r['url']):
   if '.csv' in u:
    rr=fetch(u);print('\nCSV',u,rr)
    for l in read(rr).splitlines():
     if any(k in l for k in ['入江崎','東海道','きたテラス']):print(l)
