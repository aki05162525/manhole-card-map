from research import *
res=[]
for m in list({m['url']:m for m in cache.values()}.values()):
 if 'google.' in m['url'] or 'goo.gl' in m['url']:continue
 s=soup(m)
 if not s:continue
 for f in s.select('iframe[src],iframe[data-src]'):
  u=f.get('data-src',f.get('src',''))
  if 'google.com/maps/embed' in u or 'google.co.jp/maps/embed' in u:
   res.append({'source':m['url'],'url':u,'sourceSnapshot':m['snapshotPath']})
(ROOT/'embedded-links.json').write_text(json.dumps(res,ensure_ascii=False,indent=2))
print('fetch',len(res),flush=True);batch([x['url'] for x in res]);print('done')
