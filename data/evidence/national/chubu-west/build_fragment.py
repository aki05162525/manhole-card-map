"""Rebuild only the assigned fragment/audit from immutable input + explicit decisions."""
import json, pathlib, hashlib, re
from urllib.parse import urlparse
from collections import Counter
from decisions import D,N,P,C
R=pathlib.Path('data/evidence/national/chubu-west')
def read(p):return json.loads(pathlib.Path(p).read_text())
def save(p,x):
 p=pathlib.Path(p);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
x=read('data/work/national-input/full.json');q=read('data/work/national-input/quality.json');old=read('data/work/national-input/places.json')
cards=[c for c in x['cards'] if c['id'][:2] in ('21','22','23')]; ids={c['id'] for c in cards}
places={p['id']:p for p in x['places']}; rels=[r for r in x['relations'] if r['cardId'] in ids]
manifest=read(R/'manifest.json'); M={a['url']:a for a in manifest};gkp=read(R/'gkp-rows.json')
assert ids==set(gkp['rows']); assert set(D)<=ids
oldids={alias:p['id'] for p in old['places'] for alias in p['legacyIds']}
F=lambda pid:oldids.get(pid,'facility:chubu-west-'+pid.split(':')[1])

def evidence(url,locator,method):
 m=M[url];assert m.get('status')==200,url
 return {'sourceUrl':url,'snapshotPath':m['snapshotPath'],'snapshotSHA256':m['snapshotSHA256'],'sourceLocator':locator,'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':method}

def attempts(urls):
 out=[]
 for url in sorted(set(u.split('#')[0] for u in urls)):
  m=M.get(url)
  if not m:continue
  a=dict(m)
  a['result']='原本取得成功。カード別採否は本監査のdistributionState・remainingReasonを参照' if m.get('status')==200 else ('HTTP '+str(m['status'])+'：原本配布案内を確認できない' if 'status' in m else '取得失敗：'+m['error'])
  out.append(a)
 return out
searches=[]
for f in sorted(R.glob('search-*.json')):
 s=read(f); searches.append({'path':str(f),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'queries':s['queries'],'content':s['result']})
ledger={'schema':1,'places':[],'relations':[]}; lp={}; audit=[]
for c in cards:
 cid=c['id'];d=D.get(cid);cr=[r for r in rels if r['cardId']==cid]; ar=[]
 initial=c['links'];hosts={urlparse(u).netloc for u in initial}
 urls=set(initial)|{u for u in M if urlparse(u).netloc in hosts}
 if d:urls|={d['url'],*d.get('extraUrls',[])}
 for r in cr:
  if r['placeId'] in C:urls.add(C[r['placeId']]['url'])
 basecity=re.split(r'[ (（]',c['city'])[0]
 shortcity=re.sub(r'[市町村]$','',basecity)
 ss=[{'snapshotPath':s['path'],'snapshotSHA256':s['sha256'],'queries':s['queries'],'result':'検索結果のみ。公式原本と同一視せず台帳の承認根拠には使用しない。'} for s in searches if any(shortcity in query for query in s['queries'])]
 for s in searches:
  if any(shortcity in query for query in s['queries']):
   urls.update(u for u in M if u in s['content'])
 ats=attempts(urls)
 for i,r in enumerate(cr):
  pid=r['placeId'];p=places[pid];ov=(d.get('byIndex',[])[i] if d and i<len(d.get('byIndex',[])) else {});adopt=bool(d and not ov.get('skip'));co=C.get(pid)
  reason=[]
  if adopt:
   dd={**d,**ov};method='AIが公式配布案内のカード図柄・配布施設と既存関係を照合し、明示されたカード配布時間・条件を確認。不明な時間は不明と表示。人手・現地確認ではない。'
   if dd.get('extraUrls'):
    method+=' 補足原本：'+'; '.join(u+' ['+M[u]['snapshotPath']+' sha256:'+M[u]['snapshotSHA256']+']' for u in dd['extraUrls'])
   ev=evidence(dd['url'],dd['locator'],method)
   lr={'cardId':cid,'placeId':F(pid),'sourceHash':q['sourceHashes'][cid],'hours':dd.get('hours',c['hours']),'status':dd.get('status','active'),'condition':dd.get('condition',r.get('condition','')),'evidence':ev}
   for k in ['reviewUntil','validFrom','validTo']:
    if k in dd:lr[k]=dd[k]
   ledger['relations'].append(lr)
   if pid not in lp:
    pe=evidence(dd['url'],dd['locator'],'AIがカード配布窓口名を既存入力・現在GKP行と照合。住所・電話は基礎入力を保持し、明示訂正のみ反映。施設座標未確認。')
    pp={'id':F(pid),'legacyIds':[pid],'name':p['name'],'address':p['address'],'phone':p.get('phone',''),'evidence':pe,**P.get(pid,{})}
    if co:
     pp['coordinate']={k:co[k] for k in ['lat','lng']};pp['evidence']=evidence(co['url'],co['locator'],'AIが公式原本の施設名・住所と目的地座標を照合。建物代表点であり室内配布窓口の位置ではない。蓋座標・ジオコード・表示中心は不使用。')
    lp[pid]=pp
   hoursgood=not any('未独立確認' in h or '独立明記なし' in h for h in lr['hours'])
   if not hoursgood:reason.append('配布の実施・窓口は確認したが具体的配布時刻は独立確定できない。')
   if dd.get('note'):reason.append(dd['note'])
   ds='verified' if hoursgood and not dd.get('note') else 'partial'
  else:
   ds='pending'
   if ov.get('reason'):reason.append(ov['reason'])
   elif cid in N:reason.append(N[cid])
   else:
    failures=[a['url']+' ('+str(a.get('status','取得失敗'))+')' for a in ats if a.get('status')!=200]
    successes=[a['url'] for a in ats if a.get('status')==200]
    reason.append(p['name']+'のカード別配布時間・曜日・在庫は独立確定できない。配布案内の取得失敗：'+('、'.join(failures) or 'なし')+'。'+('施設・自治体ページを取得したが、カード別現況の承認には不十分：'+'、'.join(successes) if successes else '採用できる代替公式原本は得られなかった。'))
  if not co:reason.append(p['name']+'について名称・住所に対応する公式の目的地座標を確定できず、座標を設定しない。')
  if d and d.get('proposal'):reason.append('元入力にない追加・代替窓口あり。カードのproposals参照。')
  a={'legacyPlaceId':pid,'facilityName':p['name'],'locationState':'verified' if co else 'unconfirmed','distributionState':ds,'sourceUrls':sorted(urls),'attempts':ats,'remainingReason':' '.join(reason)}
  if adopt:a.update(facilityId=F(pid),adoptedStatus=lr['status'],adoptedHours=lr['hours'])
  ar.append(a)
 state='verified' if all(a['locationState']=='verified' and a['distributionState']=='verified' and not a['remainingReason'] for a in ar) else ('partial' if any(a['distributionState']!='pending' or a['locationState']=='verified' for a in ar) else 'pending')
 ac={'cardId':cid,'city':c['city'],'state':state,'relations':ar,'sourceUrls':sorted(urls),'currentGkp':gkp['rows'][cid],'gkpEvidence':{k:v for k,v in gkp.items() if k!='rows'},'searchAttempts':ss,'remainingReason':' '.join(dict.fromkeys(a['remainingReason'] for a in ar if a['remainingReason']))}
 if d and d.get('proposal'):ac['proposals']=[{'reason':d['proposal'],'sourceUrl':d['url'],'evidence':evidence(d['url'],d['locator'],'AIが現行公式配布案内を基礎入力の全関係と比較。新規対応は未採用。')}]
 if cid=='21-361-A001':ac['proposals']=[{'reason':N[cid],'sourceUrl':'https://www.town.tarui.lg.jp/page/1147.html'}]
 audit.append(ac)
ledger['places']=sorted(lp.values(),key=lambda p:p['id'])
summary={'assignedCards':len(cards),'assignedRelations':len(rels),'currentGkpRowsReviewed':len(gkp['rows']),'cardsWithAdoptedRelations':len({r['cardId'] for r in ledger['relations']}),'adoptedFacilities':len(lp),'adoptedRelations':len(ledger['relations']),'locatedFacilities':sum('coordinate' in p for p in lp.values()),'cardStates':dict(Counter(a['state'] for a in audit)),'relationDistributionStates':dict(Counter(r['distributionState'] for a in audit for r in a['relations'])),'unlocatedRelations':sum(r['locationState']!='verified' for a in audit for r in a['relations']),'fetchAttempts':len(manifest),'fetch200':sum(m.get('status')==200 for m in manifest)}
save('data/overrides/regions/chubu-west.json',ledger)
save('data/national/regions/chubu-west.json',{'schema':1,'region':'chubu-west','checkedAt':'2026-11-05','actorType':'ai','summary':summary,'cards':audit})
print(json.dumps(summary,ensure_ascii=False,indent=2))
