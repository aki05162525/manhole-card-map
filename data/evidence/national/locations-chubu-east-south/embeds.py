from research import *
urls=sorted({u for c in audit['cards'] if c['cardId'][:2] in ['19','20'] for u in c['sourceUrls']} | {e['url'] for e in manifest if 'google.' not in e['url'] and 'goo.gl' not in e['url']})
rows=[]
for u in urls:
 if u not in cache or cache[u].get('status')!=200:continue
 s=soup(cache[u]); embeds=s.select('iframe[src]')
 for el in embeds:
  h=el['src']
  if not ('google.' in h and ('/maps/embed?pb=' in h or 'output=embed' in h)):continue
  e=fetch(h);raw=pathlib.Path(e['snapshotPath']).read_text()
  matches=re.findall(r'\["(0x[^"\n]+)","([^"\n]+)",\[([\d.]+),([\d.]+)\],"(\d+)"\]',raw)
  rows.append({'officialUrl':u,'mapUrl':h,'snapshotPath':e['snapshotPath'],'markers':matches,'status':e.get('status')})
  print(u,matches,flush=True)
(ROOT/'embed-markers.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
