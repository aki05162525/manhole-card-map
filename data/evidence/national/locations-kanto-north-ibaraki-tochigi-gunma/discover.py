from research import *
ins=json.load(open(ROOT/'cached-inspections.json'));queue={}
for i,f in enumerate(targets):
 cand={}
 for d in ins[f['id']]:
  for a in d['links']:
   u=urllib.parse.urldefrag(a['url'])[0]; label=a['label'];host=urllib.parse.urlsplit(u).netloc
   if not u.startswith('http') or host.endswith(('google.com','google.co.jp')):continue
   if re.search('access|アクセス|庁舎案内|施設案内|所在地',label+' '+u,re.I) or any(w in label for w in [f['name'], re.sub('市立|市役所.*|町役場.*','',f['name'])]):
    if re.search('アクセシビリティ|accessibility|交通規制|県庁|Relocation|javascript',label+' '+u,re.I):continue
    if u not in cache:cand[u]=label
 queue[str(i)]=cand
print(json.dumps(queue,ensure_ascii=False,indent=2));dump('discovery-queue.json',queue)
allurls=list(dict.fromkeys(u for v in queue.values() for u in v))
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
 for m in ex.map(fetch,allurls):print(m['url'],m.get('status',m.get('error')),flush=True)
dump('new-inspections.json',[inspect(cache[u]) for u in allurls])
