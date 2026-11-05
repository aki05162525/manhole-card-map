import json,re,hashlib,pathlib
from html.parser import HTMLParser
P=pathlib.Path('data/evidence/issue7/review-final')
def read(p): return json.loads(pathlib.Path(p).read_text())
m=read('tools/national/manifest.json'); selections={s['path']:{a['facilityId'] for a in s['approved']} for s in m['locations'] if '/issue7/' in s['path']}
keys={'hokkaido':'adoptionFacilityIdsAfterExactCorrections','koshin':'coordinateAcceptedFacilityIds','kyushu-okinawa':'acceptedCoordinateFactIds'}
results=[]
for path,selected in selections.items():
 r=pathlib.Path(path).stem.replace('-reviewed','')
 if r in ['hadano','sakuragicho-followup']:continue
 d=read(f'data/national/issue7/reviews/{r}.json');key=keys.get(r,'acceptedFacilityIds' if 'acceptedFacilityIds' in d else 'acceptedIds');assert selected==set(d[key]),(r,key)
 results.append(dict(region=r,selected=len(selected),reviewKey=key,match=True))
corrections=[]
for region,key in [('hokkaido','corrections'),('koshin','requiredCorrections'),('kyushu-okinawa','exactCorrections')]:
 d=read(f'data/national/issue7/{region}-reviewed.json')
 for c in read(f'data/national/issue7/reviews/{region}.json')[key]:
  ptr=c.get('jsonPointer','')
  if not ptr.startswith('/updates/'):continue
  obj=d
  for part in ptr[1:].split('/'):obj=obj[int(part)] if isinstance(obj,list) else obj[part]
  assert obj==c['new'],(region,ptr)
  corrections.append(dict(region=region,pointer=ptr,exactNewMatches=True))
class Scripts(HTMLParser):
 def __init__(self):super().__init__();self.inside=False;self.buf='';self.values=[]
 def handle_starttag(self,tag,attrs):
  if tag=='script' and dict(attrs).get('type')=='application/ld+json':self.inside=True;self.buf=''
 def handle_data(self,d):
  if self.inside:self.buf+=d
 def handle_endtag(self,tag):
  if tag=='script' and self.inside:self.values.append(json.loads(self.buf));self.inside=False
identity=[]
for name in ['hadano-reviewed','sakuragicho-followup']:
 u=read(f'data/national/issue7/{name}.json')['updates'][0];ev=u['evidence'];p=pathlib.Path(ev['snapshotPath']);raw=p.read_bytes();assert hashlib.sha256(raw).hexdigest()==ev['snapshotSHA256']
 parser=Scripts();parser.feed(raw.decode());records=[]
 def visit(x):
  if isinstance(x,dict):
   if x.get('@type')=='LocalBusiness':records.append(x)
   for v in x.values():visit(v)
  elif isinstance(x,list):
   for v in x:visit(v)
 for v in parser.values:visit(v)
 assert len(records)==1;rec=records[0];assert rec['geo']['latitude']==u['coordinate']['lat'] and rec['geo']['longitude']==u['coordinate']['lng']
 identity.append(dict(facilityId=u['facilityId'],source=ev['snapshotPath'],name=rec['name'],address=rec['address'],telephone=rec['telephone'],geo=rec['geo'],hashAndNumericMatch=True))
(P/'focused-checks.json').write_text(json.dumps(dict(regionalSelection=results,exactCorrections=corrections,additionalIdentity=identity),ensure_ascii=False,indent=2)+'\n')
print('region selections:',len(results),'exact corrections:',len(corrections),'additional identities:',len(identity))
