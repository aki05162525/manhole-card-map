"""Rebuild the proposed update and audit using saved bytes only; never fetch."""
from research import *
import shutil
OUTPUT=pathlib.Path('data/national/location-updates/north-tohoku.json')
D=json.load(open(ROOT/'decisions.json'));notes=json.load(open(ROOT/'unresolved-notes.json'))
add=json.load(open(ROOT/'additional.json'));emb=json.load(open(ROOT/'embed-links.json'))
m={r['url']:r for r in records()}
shortmaps=json.load(open(ROOT/'map-links.json'))
byid={d['facilityId']:d for d in D}
assert len(byid)==len(D)
needed=set(); audit_rows=[]
for p in targets:
 us=list(dict.fromkeys(urls(p)+add.get(p['id'],[])+[u for u in shortmaps.get(p['id'],[]) if u in m]+[x['mapUrl'] for x in emb if x['facilityId']==p['id']]))
 d=byid.get(p['id'])
 if d:us=list(dict.fromkeys(us+[d['sourceUrl']]+d['supportUrls']))
 needed.update(us)
 audit_rows.append({'facilityId':p['id'],'name':p['name'],'address':p['address'],'cardIds':sorted({r['cardId'] for r in ledger['relations'] if r['placeId']==p['id']}),'investigatedUrls':us,'decision':d or {'reason':notes[p['id'].split('-')[-1][:4]]}})
# Preserve original acquisition time and bytes on cache reuse; do not issue another GET.
cache=[]
for u in sorted(needed):
 r=dict(m.get(u,{'url':u,'error':'No saved fetch record'}))
 if r.get('snapshotPath') and not r['snapshotPath'].startswith(str(ROOT)+'/'):
  oldpath=r['snapshotPath'];dest=ROOT/('cached-'+pathlib.Path(oldpath).name)
  shutil.copyfile(oldpath,dest)
  assert hashlib.sha256(dest.read_bytes()).hexdigest()==r['snapshotSHA256']
  r.update(snapshotPath=str(dest),reusedFrom=oldpath)
  cache.append(r);m[u]=r
 elif not r.get('snapshotPath') and u not in {x['url'] for x in json.load(open(ROOT/'manifest.json'))}:
  r['reusedFromManifest']='data/evidence/national/north/manifest.json'
  cache.append(r);m[u]=r
(ROOT/'cache-manifest.json').write_text(json.dumps(cache,ensure_ascii=False,indent=2)+'\n')
updates=[];unresolved=[]
for row in audit_rows:
 fid=row['facilityId'];d=byid.get(fid)
 if d:
  r=m[d['sourceUrl']];assert r.get('status')==200
  support=[{'url':u,**{k:m[u][k] for k in ['snapshotPath','snapshotSHA256','fetchedAt'] if k in m[u]}} for u in d['supportUrls']]
  row['supportingSnapshots']=support
  method='AIによる保存原典の位置パラメータと公式施設名・現住所の照合。'+d['finding']+' 現地確認・人による確認ではない。施設・建物代表点であり室内配布窓口の精密位置は未確認。公式リンク経路・照合資料は data/evidence/national/locations-north-tohoku/audit.json の同facilityId参照。'
  if support:method+=' 直接補助原典: '+'; '.join(x.get('snapshotPath',x['url'])+' SHA256='+x.get('snapshotSHA256','取得失敗') for x in support)
  updates.append({'facilityId':fid,'coordinate':{'lat':d['lat'],'lng':d['lng']},'evidence':{'sourceUrl':d['sourceUrl'],'snapshotPath':r['snapshotPath'],'snapshotSHA256':r['snapshotSHA256'],'sourceLocator':d['sourceLocator'],'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':method}})
 else:
  attempts=[]
  for u in row['investigatedUrls']:
   r=m.get(u,{})
   if r.get('status')!=200:result='取得不可: '+str(r.get('status',r.get('error','保存記録なし')))+'。回避取得なし。'
   else:
    s,_=parsed(r);mt=re.search(r'<title[^>]*>(.*?)</title>',s,re.S|re.I)
    title=html.unescape(re.sub('<[^>]+>','',mt[1])).strip() if mt else r.get('contentType','原典')
    result='保存原典を調査: '+title[:130]+'。この施設の位置確定に不足する点はreason参照。'
   attempts.append({'url':u,'result':result})
  unresolved.append({'facilityId':fid,'attempts':attempts,'reason':row['decision']['reason']})
OUTPUT.parent.mkdir(parents=True,exist_ok=True)
OUTPUT.write_text(json.dumps({'schema':1,'region':'north','updates':updates,'unresolved':unresolved},ensure_ascii=False,indent=2)+'\n')
(ROOT/'audit.json').write_text(json.dumps({'schema':1,'scope':'north adopted facilities related to cardId prefixes 02..07, missing coordinate','checkedAt':'2026-11-05','actorType':'ai','facilities':audit_rows},ensure_ascii=False,indent=2)+'\n')
(ROOT/'target-ids.json').write_text(json.dumps(sorted(p['id'] for p in targets),indent=2)+'\n')
print(f'{len(targets)} targets: {len(updates)} updates, {len(unresolved)} unresolved; {len(cache)} reused snapshots')
