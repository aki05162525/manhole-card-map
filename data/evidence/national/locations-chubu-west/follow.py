from research import *
targets=json.load(open(ROOT/'targets.json'));found=[]
for i,p in enumerate(targets):
 hits=[]
 for u in p['urls']:
  m=cache.get(u);s=soup(m) if m else None
  if not s:continue
  for a in s.select('a[href]'):
   label=a.get_text(' ',strip=True);v=urllib.parse.urljoin(m.get('finalUrl',u),a['href']).split('#')[0]
   if urllib.parse.urlparse(v).netloc!=urllib.parse.urlparse(m.get('finalUrl',u)).netloc:continue
   if re.search(r'アクセス|交通案内|交通のご案内|所在地|庁舎案内|施設概要|施設案内|観光案内所|交通・',label) and not re.search(r'\.pdf|javascript:|mailto:',v):
    hits.append({'url':v,'label':label,'from':u})
 hits=list({h['url']:h for h in hits}.values())[:12]
 found.append({'index':i,'name':p['name'],'links':hits})
(ROOT/'follow-links.json').write_text(json.dumps(found,ensure_ascii=False,indent=2))
print('links',sum(len(x['links']) for x in found),flush=True)
batch([h['url'] for x in found for h in x['links']]);print('done',len(manifest))
