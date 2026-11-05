import json,re,html,hashlib
from pathlib import Path
from html.parser import HTMLParser
ROOT=Path('data/evidence/national/review-chubu-west-locations')
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def plain(s):return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]*>',' ',re.sub(r'<(script|style)\b.*?</\1>','',s,flags=re.S))))
class Links(HTMLParser):
 def __init__(self,s):super().__init__();self.links=[];self.feed(s)
 def handle_starttag(self,t,a):
  if t in ['iframe','a']:self.links += [v for k,v in a if k in ['src','data-src','href']]
def walk(v):
 if isinstance(v,list):
  if len(v)>=3 and isinstance(v[0],str) and v[0].startswith('0x') and isinstance(v[1],str) and isinstance(v[2],list):yield v
  for c in v:yield from walk(c)
u=json.load(open('data/national/location-updates/chubu-west.json'))['updates'];prov={x['facilityId']:x for x in json.load(open('data/evidence/national/locations-chubu-west/provenance.json'))}
rows=[]
for i,x in enumerate(u):
 p=prov[x['facilityId']];s=Path(p['primary']['snapshotPath']).read_text();r={'index':i,'facilityId':x['facilityId'],'name':p['name'],'address':p['address'],'coordinate':x['coordinate'],'primary':p['primary'],'primaryHashValid':sha(p['primary']['snapshotPath'])==p['primary']['snapshotSHA256'],'primaryText':plain(s),'coordinateContexts':[],'supporting':[]}
 for val in x['coordinate'].values():
  needle=str(val);t=html.unescape(s)
  matches=list(re.finditer(re.escape(needle),t))
  r['coordinateContexts'].append({'value':val,'contexts':[t[max(0,m.start()-160):m.end()+180] for m in matches[:4]]})
 for z in p['supportingSources']:
  t=Path(z['snapshotPath']).read_text();m=re.search(r'initEmbed\((\[.*?\])\);',t,re.S)
  rr={'source':z,'hashValid':sha(z['snapshotPath'])==z['snapshotSHA256'],'linkedFromPrimary':z['url'] in Links(s).links,'matchingRecords':[v for v in walk(json.loads(m[1])) if v[2]==list(x['coordinate'].values())] if m else [],'finalUrlPresentInSnapshot':html.unescape(z.get('finalUrl','')) in html.unescape(t)}
  if m:
   data=json.loads(m[1])
   rr['featureMetadataAtInitEmbed21_3']=data[21][3] if len(data)>21 and isinstance(data[21],list) and len(data[21])>3 else None
  r['supporting'].append(rr)
 rows.append(r)
(ROOT/'extracted-evidence.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print('rows',len(rows),'hashes',all(r['primaryHashValid'] and all(z['hashValid'] for z in r['supporting']) for r in rows))
for r in rows:
 print(r['index'],r['name'],'primary numeric', [len(z['contexts']) for z in r['coordinateContexts']], 'links',[z['linkedFromPrimary'] for z in r['supporting']], 'records',[z['matchingRecords'] for z in r['supporting']])
