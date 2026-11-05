from decisions import *
from unresolved import U
assert set(D).isdisjoint(U)
assert set(D)|set(U)==set(range(len(ps))),set(range(len(ps)))-set(D)-set(U)
(ROOT/'target-facilities.json').write_text(json.dumps(ps,ensure_ascii=False,indent=2)+'\n')
out={'schema':1,'region':'chubu-east','updates':[],'unresolved':[]}; chains=[]
for i,d in sorted(D.items()):
 p=ps[i];e=fetch(d['url']);official=fetch(d['officialUrl']);b=pathlib.Path(e['snapshotPath']).read_bytes();sha=hashlib.sha256(b).hexdigest()
 assert e.get('status')==200
 for n in ['lat','lng']:
  # Coordinates must exist in raw payload or the saved response's explicit redirect target.
  assert str(d[n]).encode() in b or str(d[n]) in e.get('finalUrl',''),(i,n,d[n])
 method='AIが公式施設案内・現在住所・当該目的地を照合。'+d['note']+' 建物代表点であり、室内の正確な窓口・階・入口を測位したものではない。'
 if d['officialUrl']!=d['url']:method+=' 公式参照元: '+d['officialUrl']+'（原本 '+official['snapshotPath']+'）。'
 out['updates'].append({'facilityId':p['id'],'coordinate':{'lat':d['lat'],'lng':d['lng']},'evidence':{'sourceUrl':d['url'],'snapshotPath':e['snapshotPath'],'snapshotSHA256':sha,'sourceLocator':d['locator'],'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':method}})
 chains.append({'facilityId':p['id'],'facilityName':p['name'],'address':p['address'],'officialPage':official,'coordinateSource':e,'locator':d['locator'],'interpretation':method})
for i,(urls,reason) in sorted(U.items()):
 p=ps[i];arr=[]
 for url in urls:
  e=fetch(url);arr.append({'url':url,'result':'HTTP '+str(e.get('status','unknown'))+'; '+('保存済み原本を再利用。' if e.get('cacheReused') else '原本取得。')+reason})
 out['unresolved'].append({'facilityId':p['id'],'attempts':arr,'reason':p['name']+'（'+p['address']+'）: '+reason})
path=pathlib.Path('data/national/location-updates/chubu-east-south.json');path.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
(ROOT/'evidence-chains.json').write_text(json.dumps(chains,ensure_ascii=False,indent=2)+'\n')
# Pending extraction headings are not approved facility IDs and are kept separate.
pending=[]
for c in audit['cards']:
 if c['cardId'][:2] not in ['19','20']:continue
 for r in c['relations']:
  if not r.get('facilityId'):pending.append({'cardId':c['cardId'],'legacyPlaceId':r['legacyPlaceId'],'reason':r.get('remainingReason'),'note':'元地域監査で施設同定・配布関係が保留。既承認施設の位置追補とは別候補として保持し、配布を確定にしない。'})
(ROOT/'unconfirmed-legacy-candidates.json').write_text(json.dumps(pending,ensure_ascii=False,indent=2)+'\n')
validation={'targets':len(ps),'updates':len(D),'unresolved':len(U),'unconfirmedLegacyCandidates':len(pending),'allTargetsCoveredExactlyOnce':True,'evidenceHashChecked':0,'coordinateLiteralsChecked':len(D)*2,'inputSHA256':{}}
for e in manifest:
 if e.get('snapshotPath'):
  b=pathlib.Path(e['snapshotPath']).read_bytes();assert hashlib.sha256(b).hexdigest()==e.get('sha256',e.get('snapshotSHA256'));validation['evidenceHashChecked']+=1
for p in ['data/work/national-input/full.json','data/work/national-input/quality.json','data/work/national-input/places.json','data/overrides/regions/chubu-east.json','data/national/regions/chubu-east.json']:
 validation['inputSHA256'][p]=hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
(ROOT/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n');print(json.dumps(validation,ensure_ascii=False,indent=2))
