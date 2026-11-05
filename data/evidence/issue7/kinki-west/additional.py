import pathlib,json,hashlib,datetime,urllib.request,concurrent.futures,re
D=pathlib.Path('data/evidence/issue7/kinki-west');rows=json.load(open(D/'inventory.json'));logs=json.load(open(D/'fetch-log.json'));seen={l['url'] for l in logs}
def fetch(u):
 r={'url':u,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0 (facility research)'}),timeout=20) as q:
   b=q.read();ext='.pdf' if b[:4]==b'%PDF' else '.html';p=D/'snapshots'/(hashlib.sha256(u.encode()).hexdigest()[:24]+ext);p.write_bytes(b);r.update(status=q.status,finalUrl=q.url,path=str(p),sha256=hashlib.sha256(b).hexdigest(),bytes=len(b),contentType=q.headers.get('Content-Type'))
 except Exception as e:r['error']=str(e)
 return r
if __name__=='__main__':
 urls=[]
 for r in rows:
  name=r['name'];grams={name[i:i+3] for i in range(len(name)-2)}
  aa=[a for a in r['priorAttempts'] if 'HTTP 200' in a.get('result','') and not any(x in a['url'] for x in ['google.','goo.gl','youtu']) and a['url'] not in seen]
  def score(a):
   t=a['result'].split('」。')[0];return sum(g in t for g in grams)+sum(x in t for x in ['アクセス','案内','施設'])*0.2
  aa=sorted(aa,key=score,reverse=True)[:2]
  for a in aa:
   if score(a)>0:urls.append(a['url']);r['fetchUrls'].append(a['url'])
 extra=json.load(open(D/'extra-urls.json')) if (D/'extra-urls.json').exists() else []
 for e in extra:
  if e['url'] not in seen:urls.append(e['url'])
  for r in rows:
   if r['facilityId'].removeprefix('facility:kinki-') in e['ids'] and e['url'] not in r['fetchUrls']:r['fetchUrls'].append(e['url'])
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:logs+=list(ex.map(fetch,dict.fromkeys(urls)))
 for p,d in [('fetch-log.json',logs),('inventory.json',rows)]: (D/p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
 print('additional',len(set(urls)),'total',len(logs))
