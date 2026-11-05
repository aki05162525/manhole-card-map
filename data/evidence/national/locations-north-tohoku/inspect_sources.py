from research import *
m={r['url']:r for r in records()};add=json.load(open(ROOT/'additional.json'))
for pre in sys.argv[1:]:
 p=next(p for p in targets if p['id'].split('-')[-1].startswith(pre));print('\n###',pre,p['name'],p['address'])
 for u in urls(p)+add.get(p['id'],[]):
  if re.search('google.com/maps/embed|goo.gl',u):continue
  r=m.get(u,{});s,pa=parsed(r)
  print('URL',u,r.get('status',r.get('error')))
  for v,t in pa.links:
   if re.search('アクセス|地図|交通|会社|概要|施設|map|access|about|profile|guide',v+' '+t,re.I) and not re.search('accessibility|googleapis|交通安全|県庁|cookie|jquery|shisetsu/index|shisetsuannai/index|/life/|/kurashi/|/category|sitemap',v+' '+t,re.I):print(t.strip()[:60],urllib.parse.urljoin(r.get('finalUrl',u),v)[:450])
  for mt in re.finditer(r'\d{2,3}\.\d{4,}',s):
   x=s[max(0,mt.start()-60):mt.end()+80]
   if not re.search('svg|path|viewBox|font-size|d="|matrix|width',x,re.I):print('NUM',x.replace('\n',' ')[:180])
