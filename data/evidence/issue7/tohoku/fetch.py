import json,pathlib,hashlib,datetime,concurrent.futures,urllib.request,urllib.error
D=pathlib.Path(__file__).parent;ROOT=D.parents[3]
def fetch(url):
 r={'sourceUrl':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (research; public facility location verification)'}),timeout=25) as f:
   b=f.read();r.update(status=f.status,finalUrl=f.url,contentType=f.headers.get('Content-Type',''))
  h=hashlib.sha256(b).hexdigest();p=D/'originals'/(h+('.pdf' if b[:4]==b'%PDF' else '.png' if b[:4]==b'\x89PNG' else '.html'));p.parent.mkdir(exist_ok=True);p.write_bytes(b);r.update(snapshotPath=str(p.relative_to(pathlib.Path.cwd())),snapshotSHA256=h,bytes=len(b))
 except Exception as e:r['error']=str(e)
 return r
if __name__=='__main__':
 l=json.load(open('data/work/issue7-baseline/ledger.json'));ids=json.load(open('data/work/issue7-baseline/assignments.json'))['tohoku'];p={x['id']:x for x in l['places']};cards={x['id']:x for x in json.load(open('data/work/issue7-baseline/full.json'))['cards']};targets={}
 for i in ids:
  urls=[p[i]['evidence']['sourceUrl']]
  for r in l['relations']:
   if r['placeId']==i:urls += [r['evidence']['sourceUrl']]+cards[r['cardId']]['links']
  targets[i]=list(dict.fromkeys(u for u in urls if not any(s in u for s in ['google.com','goo.gl','maps.app'])))
 (D/'fetch-targets.json').write_text(json.dumps(targets,ensure_ascii=False,indent=2))
 urls=list(dict.fromkeys(u for us in targets.values() for u in us))
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex: records=list(ex.map(fetch,urls))
 (D/'fetch-records.json').write_text(json.dumps(records,ensure_ascii=False,indent=2));print('Fetched',len(records),'successful',sum('snapshotPath'in r for r in records))
