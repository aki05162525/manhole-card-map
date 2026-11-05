from research import *
import sys
q=json.load(open(ROOT/'extra-queue.json'))
for arg in sys.argv[1:]:
 i=int(arg);f=targets[i]; print('\nFACILITY',i,f['name'],f['address'])
 for u in dict.fromkeys(urls[f['id']]+q.get(str(i),[])):
  if u not in cache:continue
  d=inspect(cache[u]); print('URL',u,'status',d['status'],'TITLE',d['title'])
  # output relevant final content and map/navigation links without broad boilerplate
  print('NUM', ' '.join(dict.fromkeys(re.findall(r'(?:3[4567]|1[34][089])\.\d{3,}',read(cache[u]))))[:500])
  ls=[a for a in d['links'] if re.search('access|map|所在地|施設|交通|庁舎|案内|店舗',a['label']+' '+a['url'],re.I) and not re.search('googleapis|sitemap|rwdImage|translate',a['url'])]
  print('LINKS',json.dumps(ls,ensure_ascii=False)[:1800])
