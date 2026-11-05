from research import *
from decisions import *
ps=json.load(open(ROOT/'targets.json'));follow=json.load(open(ROOT/'follow-links.json'))
embedded=json.load(open(ROOT/'embedded-links.json'));maplinks=json.load(open(ROOT/'map-links.json'))
manual=json.load(open(ROOT/'search-links.json'))+json.load(open(ROOT/'more-links.json'))
updates=[];candidates=[];unresolved=[];provenance=[]
def preserve(m):
 p=pathlib.Path(m['snapshotPath']); dest=ROOT/p.name
 if p!=dest:
  if dest.exists():assert dest.read_bytes()==p.read_bytes()
  else:shutil.copyfile(p,dest)
 n=dict(m);n['snapshotPath']=str(dest)
 if p!=dest:n['reusedFrom']=str(p)
 return n
def ev(m,loc,method):
 return dict(sourceUrl=m['url'],snapshotPath=m['snapshotPath'],snapshotSHA256=m['snapshotSHA256'],sourceLocator=loc,checkedAt='2026-11-05',actorType='ai',verificationMethod=method+' 建物代表点であり、室内の正確な受付・階の位置や現地確認を意味しない。')
def walk(x):
 if isinstance(x,list):
  if len(x)>=3 and isinstance(x[0],str) and x[0].startswith('0x') and isinstance(x[1],str) and isinstance(x[2],list) and len(x[2])==2:yield x[:3]
  for y in x:yield from walk(y)
def embed_records(m):
 t=pathlib.Path(m['snapshotPath']).read_text();z=re.search(r'initEmbed\((\[.*?\])\);',t,re.S)
 return list(walk(json.loads(z[1]))) if z else []
def record(i,coord,evidence,support=[]):
 p=ps[i];rec={'facilityId':p['id'],'coordinate':coord,'evidence':evidence}
 provenance.append({'index':i,'facilityId':p['id'],'name':p['name'],'address':p['address'],'primary':evidence,'supportingSources':support})
 if p['registered']:updates.append(rec)
 else:candidates.append(dict(legacyPlaceId=p['legacyPlaceId'],name=p['name'],address=p['address'],cardIds=p['cards'],coordinate=coord,evidence=evidence,distributionState='unconfirmed',reason='位置のみ確認。配布関係は元監査の保留を維持し、施設台帳への採用・通常ピン化をしない。'))
for i,(u,lat,lng,loc) in DIRECT.items():
 m=preserve(cache[u]);assert m['status']==200
 record(i,dict(lat=lat,lng=lng),ev(m,loc,'AIが公式の施設名・現在住所と明示目的地点を照合。表示中心・住所代表点・蓋座標は不使用。'))
for i,(u,needle) in EMBED.items():
 found=[]
 for l in embedded:
  if l['source']!=u:continue
  m=cache.get(l['url'])
  if not m or m.get('status')!=200:continue
  for row in embed_records(m):
   if needle in row[1]:found.append((row,m))
 assert found,(i,u,needle)
 row,m=found[0];primary=preserve(cache[u]);support=preserve(m)
 loc='公式施設案内のiframe（data-srcを含む）が指定する施設マーカー。対応原本 '+support['snapshotPath']+' SHA256 '+support['snapshotSHA256']+' の initEmbed 内 named place record '+json.dumps(row,ensure_ascii=False)+'。iframe URLの !1m3 内 !2d/!3d（viewport）は不使用。'
 record(i,dict(lat=row[2][0],lng=row[2][1]),ev(primary,loc,'AIが公式掲載の施設名・住所と、当該ページに埋め込まれた地図の名前・住所付き施設レコードを照合。外部地図を独自に施設検索・住所ジオコードした値ではない。'),[support])
for i,(short,needle) in SHORT.items():
 support=preserve(cache[short]);assert support['status']==200 and '/sorry/' not in support['finalUrl'];z=re.search(r'!3d(\d+\.\d+)!4d(\d+\.\d+)',support['finalUrl']);assert z and needle in urllib.parse.unquote(support['finalUrl'])
 ls=[l for l in maplinks if l['url']==short];assert ls
 primary=preserve(cache[ls[0]['source']]);lat,lng=map(float,z.groups())
 loc='公式ページの施設地図リンク '+short+' -> '+support['finalUrl']+' の !8m2!3d/!4d 施設目的地点。遷移応答原本 '+support['snapshotPath']+' SHA256 '+support['snapshotSHA256']+'。@lat,lngのviewportは使用しない。'
 record(i,dict(lat=lat,lng=lng),ev(primary,loc,'AIが公式掲載の短縮地図リンクを通常取得し、転送先の施設名・住所と明示目的地座標を照合。'),[support])
resolved={i for i in DIRECT}|set(EMBED)|set(SHORT)
for i,p in enumerate(ps):
 if i in resolved and p['registered']:continue
 urls=[u for ids,u in manual if i in ids]
 urls+= [h['url'] for h in follow[i]['links']]
 # retain original audit attempts as supplementary context, but do not claim unrelated cross-card links establish this facility.
 urls+=p['urls']
 urls += [l['url'] for l in maplinks+embedded if l['source'] in urls]
 ats=[]
 for u in dict.fromkeys(urls):
  m=cache.get(u)
  if not m:continue
  result='HTTP '+str(m.get('status')) if m.get('status') else m.get('error','取得結果なし')
  if m.get('status')==200:
   s=soup(m);title=s.title.get_text(' ',strip=True) if s and s.title else ''
   result+=' / '+title+' / 原本保存済み。対象施設の建物目的地としての採否は個別reason参照。'
  if m.get('snapshotPath'):result+=' / '+m['snapshotPath']+' / SHA256 '+m['snapshotSHA256']
  ats.append({'url':u,'result':result})
 if i in resolved:
  reason=p['name']+'の位置候補をlocation-candidates.jsonへ記録した。配布関係未確認のためこの追補のupdatesには入れず、元legacyPlaceIdの候補として親に引き継ぐ。'
 elif i in NOTES:reason=NOTES[i]
 else:
  dedicated=[cache[u] for ids,u in manual if i in ids and u in cache]
  if dedicated and all(m.get('status')!=200 for m in dedicated):
   reason=p['name']+'（'+p['address']+'）の公式施設詳細・アクセス案内を追加調査したが、'+', '.join(str(m.get('status',m.get('error','error'))) for m in dedicated)+'。アクセス制限・TLS検証を回避せず、名称・現住所と建物目的地点を原本照合できないため保留。'
  else:reason=p['name']+'（'+p['address']+'）について保存済み公式案内と追加施設・アクセス資料を調査したが、対象建物に対応する明示目的地座標を確定できなかった。異なる施設の地図・施設群全体・住所検索・表示中心を代用しない。'
 if not p['registered'] and i not in resolved:reason+=' 配布関係も元地域監査の未確認を維持。'
 assert ats,(i,p['name'])
 unresolved.append({'facilityId':p['id'],'attempts':ats,'reason':reason})
out={'schema':1,'region':'chubu-west','updates':sorted(updates,key=lambda x:x['facilityId']),'unresolved':sorted(unresolved,key=lambda x:x['facilityId'])}
pathlib.Path('data/national/location-updates/chubu-west.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
(ROOT/'location-candidates.json').write_text(json.dumps({'schema':1,'region':'chubu-west','candidates':candidates},ensure_ascii=False,indent=2)+'\n')
(ROOT/'provenance.json').write_text(json.dumps(provenance,ensure_ascii=False,indent=2)+'\n')
# copies retain actual original acquisition timestamp and URL, not present-day fictional retrieval times
copies=[]
for x in provenance:
 for m in [cache[x['primary']['sourceUrl']]]+x['supportingSources']:
  n=preserve(m)
  if n not in copies:copies.append(n)
(ROOT/'adopted-manifest.json').write_text(json.dumps(copies,ensure_ascii=False,indent=2)+'\n')
print('targets',len(ps),'updates',len(updates),'candidates',len(candidates),'unresolved',len(unresolved))
print('still unlocated',[(i,p['name']) for i,p in enumerate(ps) if i not in resolved])
