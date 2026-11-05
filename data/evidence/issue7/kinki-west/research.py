import json, pathlib, hashlib, zipfile, io, unicodedata,re, concurrent.futures,datetime,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[4]; D=ROOT/'data/evidence/issue7/kinki-west'
def read(p): return json.loads((ROOT/p).read_text())
def save(p,d): (D/p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
if (D/'fetch-log.json').exists(): raise SystemExit('Acquisition already exists; use build.py for offline reproduction, do not overwrite snapshots/logs.')
ids=read('data/work/issue7-baseline/assignments.json')['kinki-west']; places={p['id']:p for p in read('data/work/issue7-baseline/ledger.json')['places']}; old={p['facilityId']:p for p in read('data/national/issue5/kinki.json')['unresolved']}
def norm(s):
 s=unicodedata.normalize('NFKC',s);s=re.sub(r'大阪府|兵庫県|奈良県|和歌山県','',s);s=re.sub(r'\(.*?\)|（.*?）','',s);s=s.replace('一丁目','1丁目').replace('二丁目','2丁目').replace('三丁目','3丁目');s=re.sub(r'(\d)(?:丁目|番地の|番地|番|号)',r'\1-',s);return re.sub(r'\s+','',s).rstrip('-')
z=zipfile.ZipFile(ROOT/'data/evidence/issue5/chubu/P05-22_GML.zip'); records=[]
for pref in ['27','28','29','30']:
 inner=f'P05-22_{pref}_GML.zip';q=zipfile.ZipFile(io.BytesIO(z.read(inner)));member=f'P05-22_{pref}.geojson'; b=q.read(member)
 for i,f in enumerate(json.loads(b)['features']): records.append(dict(pref=pref,index=i,member=inner+'/'+member,memberSHA256=hashlib.sha256(b).hexdigest(),feature=f))
rows=[]
for fid in ids:
 p=places[fid];o=old.get(fid,{}); candidates=[]
 for r in records:
  pr=r['feature']['properties']; n,a=pr['P05_003'],pr['P05_004']; na=norm(a);pa=norm(p['address'])
  if (na==pa or (na in pa and len(na)>8)) or (n in p['name'] and len(n)>4): candidates.append(r)
 rows.append(dict(facilityId=fid,name=p['name'],address=p['address'],oldReason=o.get('reason'),distributionEvidence=o.get('distributionEvidence',p.get('evidence')),priorAttempts=o.get('priorAttempts',[]),p05Candidates=candidates))
save('inventory.json',rows)
if __name__=='__main__':
 urls={}
 for r in rows:
  candidates=[r['distributionEvidence']['sourceUrl']]+[a['url'] for a in r['priorAttempts'] if 'url' in a]
  candidates=[u for u in dict.fromkeys(candidates) if not any(x in u for x in ['google.com','google.co.jp','maps.app.goo'])]
  # Re-fetch distribution and up to two independently relevant facility/access pages.
  chosen=candidates[:1]+candidates[-2:]
  r['fetchUrls']=list(dict.fromkeys(chosen))
  for u in r['fetchUrls']: urls[u]=None
 save('inventory.json',rows)
 def fetch(url):
  at=datetime.datetime.now(datetime.timezone.utc).isoformat(); result=dict(url=url,fetchedAt=at)
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (facility research)'})
   with urllib.request.urlopen(req,timeout=25) as resp:
    b=resp.read(); ext='.pdf' if b[:4]==b'%PDF' else '.html';p=D/'snapshots'/(hashlib.sha256(url.encode()).hexdigest()[:24]+ext);p.parent.mkdir(exist_ok=True);p.write_bytes(b)
    result.update(status=resp.status,finalUrl=resp.url,path=str(p.relative_to(ROOT)),sha256=hashlib.sha256(b).hexdigest(),bytes=len(b),contentType=resp.headers.get('Content-Type'))
  except Exception as e: result['error']=str(e)
  return result
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
  results=list(ex.map(fetch,urls))
 save('fetch-log.json',results);print('fetched',len(results),'success',sum('path' in r for r in results))
