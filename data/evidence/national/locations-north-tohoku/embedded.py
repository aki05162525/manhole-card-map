from research import *
m={r['url']:r for r in records()};add=json.load(open(ROOT/'additional.json'));links=[]
for p in targets:
 for u in urls(p)+add.get(p['id'],[]):
  r=m.get(u,{});s,pa=parsed(r)
  for v,t in pa.links:
   if re.match(r'https://www.google.com/maps/embed\?pb=',v):
    links.append({'facilityId':p['id'],'officialUrl':u,'mapUrl':v})
(ROOT/'embed-links.json').write_text(json.dumps(links,ensure_ascii=False,indent=2))
collect([x['mapUrl'] for x in links])
m={r['url']:r for r in records()};out=[]
for p in targets:
 seen=set();out.append('\n### '+p['id']+' '+p['name']+' '+p['address'])
 for x in links:
  if x['facilityId']!=p['id'] or x['mapUrl'] in seen:continue
  seen.add(x['mapUrl']);r=m[x['mapUrl']];s,_=parsed(r)
  matches=list(re.finditer(r'\[\["0x[^"]+","[^"]*",\[[0-9.,]+\]',s))
  out.append(x['officialUrl']+'\n'+r.get('snapshotPath','')+'\n'+'\n'.join(mt.group(0) for mt in matches))
(ROOT/'embed-review.txt').write_text('\n'.join(out))
