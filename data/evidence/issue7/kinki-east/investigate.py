import json,hashlib,datetime,urllib.request,urllib.error,concurrent.futures,zipfile,io,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[4]; BASE=ROOT/'data/evidence/issue7/kinki-east'
def read(p):return json.loads((ROOT/p).read_text())
def save(n,x): (BASE/n).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
A=read('data/work/issue7-baseline/assignments.json')['kinki-east']; P={p['id']:p for p in read('data/work/issue7-baseline/ledger.json')['places']}; U={p['facilityId']:p for p in read('data/national/issue5/kinki.json')['unresolved']}
def fetch(url):
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();r={'sourceUrl':url,'fetchedAt':start}
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'manhole-card-map research/1.0'}),timeout=25) as f:
   b=f.read();r.update(status=f.status,finalUrl=f.url,contentType=f.headers.get('Content-Type'))
  name='sources/'+sha(url.encode())[:20]+'.html';(BASE/'sources').mkdir(exist_ok=True);(BASE/name).write_bytes(b);r.update(snapshotPath=str((BASE/name).relative_to(ROOT)),snapshotSHA256=sha(b))
 except Exception as e:r['error']=str(e)
 return r
if __name__=='__main__':
 urls=sorted(set(U[a]['distributionEvidence']['sourceUrl'].replace('http://','https://') for a in A))
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex: logs=list(ex.map(fetch,urls))
 save('fetch-log.json',logs)
 z=zipfile.ZipFile(ROOT/'data/evidence/issue5/chubu/P05-22_GML.zip');records=[]
 for pref in ['24','25','26']:
  inner='P05-22_'+pref+'_GML.zip';s=zipfile.ZipFile(io.BytesIO(z.read(inner)));name='P05-22_'+pref+'.geojson';d=json.loads(s.read(name))
  for i,f in enumerate(d['features']):records.append(dict(pref=pref,index=i,feature=f,member=inner+'!'+name))
 save('p05-records.json',records)
 summary=[]
 for a in A:
  p=P[a];name=p['name'];address=p['address'];c=[]
  for r in records:
   pr=r['feature']['properties'];n=pr['P05_003'];ad=pr['P05_004']; score=sum(t in address for t in re.findall('[一-龥]{2,}',ad))+ (10 if n in name or name in n else 0)
   if score>=10 or (ad and ad.replace('番地','-') in address):c.append(r)
  summary.append({'facilityId':a,'name':name,'address':address,'oldReason':U[a]['reason'],'distributionEvidence':U[a]['distributionEvidence'],'p05Candidates':c})
 save('research.json',summary)
 print('fetch',len(logs),'success',sum('snapshotPath'in x for x in logs))
 for x in summary:
  print(x['facilityId'].replace('facility:kinki-',''),x['name'],[(r['index'],r['feature']['properties']) for r in x['p05Candidates']])
