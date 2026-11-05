"""Rebuild fragment/audit offline from immutable input and AI-reviewed decisions."""
import json,pathlib,hashlib,copy,urllib.parse,re
from decisions import D
from coordinates import C
from unresolved import P
ROOT=pathlib.Path('data/evidence/national/kanto-south')
def read(p):return json.loads(pathlib.Path(p).read_text())
def write(p,x):p=pathlib.Path(p);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
x=read('data/work/national-input/full.json');quality=read('data/work/national-input/quality.json');prior=read('data/work/national-input/places.json');manifest=read(ROOT/'manifest.json');M={r['url']:r for r in manifest}
cs=[c for c in x['cards'] if c['id'][:2] in ('00','12','13','14')];ps={p['id']:p for p in x['places']};old={p['id']:p for p in prior['places']}
for p in prior['places']:
 for a in p['legacyIds']:old[a]=p
P['14-100-C001']=(P['14-100-C001'][0],['https://www.city.yokohama.lg.jp/kurashi/machizukuri-kankyo/kasen-gesuido/gesuido/koho/manholecard.html'])
def ev(url,locator,method):
 r=M[url];assert r.get('status')==200,(url,r)
 return {'sourceUrl':url,'snapshotPath':r['snapshotPath'],'snapshotSHA256':r['sha256'],'sourceLocator':locator,'checkedAt':r['fetchedAt'][:10],'actorType':'ai','verificationMethod':method}
def attempt(u):
 r=M[u];return {k:r[k] for k in ['url','fetchedAt','status','finalUrl','snapshotPath','sha256','error'] if k in r}
places={};rels=[];audit=[]
for c in cs:
 cid=c['id'];d=D.get(cid);rs=[r for r in x['relations'] if r['cardId']==cid];urls=list(c.get('links')or[])
 if d: urls += [d.get('url') or urls[-1]]
 if cid in P:urls+=P[cid][1]
 urls += [v['url'] for (cc,i),v in C.items() if cc==cid]
 urls=list(dict.fromkeys(u for u in urls if u in M))
 ac={'cardId':cid,'state':'pending','relations':[],'sourceUrls':urls,'attempts':[attempt(u) for u in urls],'remainingReason':P[cid][0] if cid in P else ''}
 if d:ac['reviewNote']=d.get('note','');ac['distributionEvidence']=ev(d.get('url') or c['links'][-1],cid+'／'+ '・'.join(ps[r['placeId']]['name'] for r in rs)+'：配布場所・配布時間・在庫状況（該当デザインの節）','AIが当該カードの公式配布案内本文を照合して手動転記。現地・人の確認ではない。')
 for i,r in enumerate(rs):
  pid=r['placeId'];p=ps[pid];adopt=d is not None and (d['indices'] is None or i in d['indices'])
  ar={'legacyPlaceId':pid,'inputName':p['name'],'inputAddress':p['address'],'locationState':'unresolved','distributionState':'unknown','sourceUrls':urls,'attempts':[{'url':u,'status':M[u].get('status'),'error':M[u].get('error')} for u in urls],'remainingReason':''}
  if not adopt:
   ar['remainingReason']=P[cid][0] if cid in P else d.get('note','窓口同定未解決');ac['relations'].append(ar);continue
  e=ac['distributionEvidence'];fid=old[pid]['id'] if pid in old else 'facility:kanto-south-'+pid.split(':')[1]
  if fid not in places:
   if pid in old:np=copy.deepcopy(old[pid])
   else:np={'id':fid,'legacyIds':[pid],'name':p['name'],'address':d.get('addresses',{}).get(i,p['address']),'phone':p.get('phone',''),'evidence':copy.deepcopy(e)}
   if pid not in old:np['evidence']['verificationMethod']='AIが公式配布案内と入力窓口の名称・所在地を照合。座標未確定のため省略。現地確認ではない。'
   if i in d.get('placeUrls',{}):np['evidence']=ev(d['placeUrls'][i],np['name']+'／場所・住所','AIが公式施設案内の所在地と配布案内の窓口を照合。座標は未確定。')
   if (cid,i) in C:
    co=C[cid,i];np['coordinate']={k:co[k] for k in ('lat','lng')};np['evidence']=ev(co['url'],co['locator'],'AIが公式の施設名称・所在地と地図リンクの目的地q/destinationを照合。建物代表点であり室内窓口座標や現地確認ではない。')
   places[fid]=np
  np=places[fid]
  rr={'cardId':cid,'placeId':fid,'sourceHash':quality['sourceHashes'][cid],'hours':d['hours'],'status':d['status'],'condition':d.get('conditions',{}).get(i,r.get('condition','')),'evidence':copy.deepcopy(e)}
  for k in ['reviewUntil','validFrom','validTo']:
   if k in d:rr[k]=d[k]
  rels.append(rr);ar['facilityId']=fid;ar['distributionState']=d['status'];ar['locationState']='verified-building-point' if 'coordinate' in np else 'unlocated';ar['distributionEvidence']=copy.deepcopy(e)
  reasons=[]
  if 'coordinate' not in np:reasons.append(f"{np['name']}（{np['address']}）の目的地座標を、上記取得済み公式案内から建物と対応付けて確定できない。住所・蓋・表示中心から推定せず省略。")
  if not d['hours'] or any('独立' in h or '時刻は未記載' in h for h in d['hours']):reasons.append('カード固有の配布時間・曜日の原典が不足。施設営業時間は代用しない。')
  if d.get('note'):ar['reviewNote']=d['note']
  ar['remainingReason']=' '.join(reasons);ac['relations'].append(ar)
 if d:
  ac['state']='ended' if all(r['distributionState']=='ended' for r in ac['relations']) else ('verified' if ac['relations'] and all(not r['remainingReason'] for r in ac['relations']) else 'partial')
  ac['remainingReason']=' / '.join(dict.fromkeys(r['remainingReason'] for r in ac['relations'] if r['remainingReason']))
 audit.append(ac)
# Reviewed same-counter duplicates; preserve both extracted aliases.
merges={'facility:kanto-south-ee655eabbae609609ba1':'facility:kanto-south-309b952c40d174e0bb1a',
'facility:kanto-south-f4e5b05bc434d0caa9e0':'facility:kanto-south-72f121331d86ddcc5080',
'facility:kanto-south-070822e0ef07461b9c84':'facility:kanto-south-04903f9b604f31b843df',
'facility:kanto-south-b504192ea2e346dd5657':'facility:kanto-south-a60af499924663813476'}
for src,dst in merges.items():
 if src not in places:continue
 places[dst]['legacyIds']+=places.pop(src)['legacyIds']
 for r in rels:
  if r['placeId']==src:r['placeId']=dst
 for ac in audit:
  for r in ac['relations']:
   if r.get('facilityId')==src:r['facilityId']=dst
for p in places.values():
 p['name']=re.sub(r'\(令和8年8月(?:17|22)日配布再開\)','',p['name'])
ledger={'schema':1,'places':list(places.values()),'relations':rels}
write('data/overrides/regions/kanto-south.json',ledger)
a={'schema':1,'region':'kanto-south','checkedAt':'2026-11-05','cards':audit,'proposals':[]}
# Explicitly proposed relations, not silently bound to an existing extracted relation.
proposals={
'12-221-A001': [('replacement','八千代市上下水道局1階 お客様センター（工事）','八千代市大和田新田312-5','平日8:30～17:00。12/29～1/3除く。'),('relocation','八千代市水道サービス（宿直対応）','八千代市大和田新田312-5 上下水道局庁舎内','土日祝8:30～17:00。12/29～1/3除く。')],
'12-227-A001':[('replacement','浦安市役所6階 治水課','浦安市猫実1-1-1','旧道路整備課との窓口継続性を要確認。')],
'12-227-B001':[('addition','浦安市役所6階 治水課','浦安市猫実1-1-1','郷土博物館以外の追加配布窓口。')],
'12-229-A001':[('addition','袖ケ浦市観光協会','','平日の追加窓口。住所・目的地座標の追加照合が必要。')],
'13-100-I101':[('addition','板橋区くらしと観光課','東京都板橋区板橋2-65-6 情報処理センター6階','いたばし観光センター休館日（年末年始を除く）9:00～17:00。')],
'13-100-N001':[('addition','テクノプラザかつしか','','マカロン臨時休業時の代替。リカちゃんカードと同じ配布時間。')],
'14-201-C001':[('temporary-replacement','ヴェルニー公園管理事務所','','ティボディエ邸休止期間の代替配布。11月13日まで。既存施設座標を移さない。')],
'13-100-Y001':[('addition','江戸川区役所本庁舎3階 広報課','','平日8:30～17:00。入力にない代替窓口。')],
'14-210-A001':[('addition','三浦海岸駅前観光案内所','三浦海岸駅改札前','平日・休日9:30～17:00、12/28～1/3休み。')],
'14-218-B001':[('future-addition','オーエンス文化会館 第2駐車場','','2026-11-22 9:00～15:00先行配布予定。荒天中止。'),('future-addition','綾瀬市役所5階','','2026-11-24以降9:00～16:00予定。11/23は配布なし。')]
}
for cid,pp in proposals.items():
 ca=next(c for c in cs if c['id']==cid);d=D.get(cid);u=(d.get('url') if d else None) or ca['links'][-1]
 for kind,name,addr,cond in pp:a['proposals'].append({'cardId':cid,'kind':kind,'name':name,'address':addr,'condition':cond,'reason':'現行公式の窓口が不変入力の既存関係に安全に対応できないため、統合担当による新規関係・移転判断が必要。','evidence':ev(u,name+'／配布場所・配布条件','AIが公式本文の追加・移転・将来案内を抽出。未採用proposalであり施設座標は推定しない。')})
a['summary']={'assignedCards':len(cs),'assignedRelations':sum(len(c['relations']) for c in audit),'cardsWithAdoptedDistribution':len(D),'adoptedFacilities':len(places),'adoptedRelations':len(rels),'facilitiesWithCoordinates':sum('coordinate' in p for p in places.values()),'newCoordinateFacilities':sum(p['id'] not in old and 'coordinate' in p for p in places.values()),'unadoptedRelations':sum(r['distributionState']=='unknown' for c in audit for r in c['relations']),'relationsWithRemainingIssues':sum(bool(r['remainingReason']) for c in audit for r in c['relations']),'proposalCount':len(a['proposals']),'fetches':len(manifest)}
write('data/national/regions/kanto-south.json',a);print(json.dumps(a['summary'],ensure_ascii=False,indent=2))
