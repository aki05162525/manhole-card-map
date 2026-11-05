import research as r,json,csv,io,re,unicodedata,difflib
P=json.load(open('data/overrides/regions/kyushu-okinawa.json'))['places']
def norm(s):
 s=unicodedata.normalize('NFKC',s).replace('ケ','ヶ').replace('﨑','崎')
 for k,v in {'一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9'}.items():s=re.sub(k+'(?=丁目)',v,s)
 return re.sub(r'[\s()（）・、]|丁目|番地|番|号|大字|字','',s).replace('ー','-').replace('−','-').replace('－','-')
R=[]
for z in json.load(open(r.ROOT/'selected-resources.json')):
 x=r.cache.get(z['resource']['url']);
 if not x or x.get('status')!=200:continue
 s=r.read(x)
 try:
  for num,row in enumerate(csv.DictReader(io.StringIO(s)),2):
   name=row.get('名称') or row.get('施設名') or row.get('名称表記') or ''
   addr=row.get('所在地_連結表記') or row.get('住所') or row.get('所在地') or row.get('住所表記') or ''
   lat=row.get('緯度');lng=row.get('経度')
   if not name or not lat or not lng:continue
   try:lat,lng=float(lat),float(lng)
   except:continue
   R.append({'name':name,'address':addr,'lat':lat,'lng':lng,'url':x['url'],'line':num,'dataset':z['dataset'],'organization':z['organization'],'row':row})
 except Exception as e: print(e)
C={}
for i,p in enumerate(P):
 if p.get('coordinate'):continue
 a=norm(p['address']);n=norm(p['name']);ls=[]
 for t in R:
  nn=norm(t['name']);aa=norm(t['address'])
  ns=difflib.SequenceMatcher(None,n,nn).ratio();ads=difflib.SequenceMatcher(None,a,aa).ratio()
  if len(nn)>3 and nn in n:ns=max(ns,.9)
  if len(aa)>5 and aa in a:ads=max(ads,.98)
  if ns>.55 and (ads>.48 or ns>.9):ls.append((ns*.5+ads*.5,t))
 ls.sort(key=lambda x:x[0],reverse=True)
 # dedup same name coords
 seen=set();res=[]
 for score,t in ls:
  k=(t['name'],t['lat'],t['lng'])
  if k in seen:continue
  seen.add(k);res.append(t)
 C[str(i)]=res[:3]
json.dump(C,open(r.ROOT/'csv-candidates.json','w'),ensure_ascii=False,indent=2)
for i,ts in C.items():
 if ts:print(i,P[int(i)]['name'],P[int(i)]['address'],'=>',[(t['name'],t['address'],t['lat'],t['lng'],t['dataset'],t['line']) for t in ts[:2]])
