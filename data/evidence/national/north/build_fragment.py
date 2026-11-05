"""Rebuild audited north fragment from reviewed decisions and immutable source data.
No network; coordinates accepted only from explicit reviewed destination markers.
"""
import json,pathlib,hashlib,re,unicodedata,collections
from collect import ROOT,D,CARDS
from read_sources import text,decode
load=lambda p:json.load(open(p))
M=load(ROOT/'manifest.json'); decisions=load(ROOT/'decisions.json'); coords=load(ROOT/'coordinates.json'); fixes=load(ROOT/'place-corrections.json')
Q=load('data/work/national-input/quality.json')['sourceHashes'];P={p['id']:p for p in D['places']};old=load('data/work/national-input/places.json');oldaliases={a:p['id'] for p in old['places'] for a in p['legacyIds']}
T={r['url']:text(r) for r in M};byurl={r['url']:r for r in M}
def source(key):
 rr=[r for r in M if key in r['url'] and r.get('status')==200]
 assert rr, key
 return rr[-1]
def evidence(r,loc,note):return {**{k:r[k] for k in ['snapshotPath','snapshotSHA256']},'sourceUrl':r['url'],'sourceLocator':loc,'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':note}
def norm(s):
 s=unicodedata.normalize('NFKC',s).translate(str.maketrans('一二三四五六七八九〇','1234567890'))
 return re.sub(r'北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|丁目|番地|大字|字|地割|第|番|号|の|[\s\-‐‑–—−ー・、。:：()（）「」『』]', '',s)
def addr(p,pool):
 a=re.split(r'[（(\s]',p['address'])[0];a=norm(a)
 # Source tables sometimes omit the municipal prefix, never match just street numbers.
 variants=[a,re.sub(r'^.*?[市郡]', '',a)]
 return any(len(x)>=5 and re.search('[一-龥ぁ-んァ-ン]',x) and x in pool for x in variants)
reasons={
'01-219-A001':'カード指定の市公式URLと検索で発見したwww付き公式URLがともにHTTP503。取得原本はエラー画面で配布条件を承認できない。',
'01-231-B001':'入力に配布関係・公式リンクなし。現行市上下水道案内は旧デザインの変更を記載するがB001終了日を特定できず、C001への自動対応をしない。',
'01-607-A001':'役場の配布ページ・組織ページは取得失敗。検索結果には2026/10/1配布再開があるが原本取得できず承認根拠には不十分。',
}
extra={'01-219-A001':['https://www.mombetsu.jp/life/?content=2384'],'01-231-B001':[source('business/sewer/manhole-card.html')['url']]}
places={};relations={};audit=[]
for c in CARDS:
 cid=c['id'];dec=decisions.get(cid);r=source(dec['url']) if dec else None
 urls=list(dict.fromkeys((c.get('links') or [])+extra.get(cid,[])+load(ROOT/'address-sources.json').get(cid,[])+([r['url']] if r else [])))
 sourcepool='\n'.join(T.get(u,'') for u in urls)
 attempts=[]
 for u in urls:
  m=byurl.get(u,{})
  attempts.append({'url':u,'result':m.get('status',m.get('error','not-fetched')),'fetchedAt':m.get('fetchedAt'),'snapshotPath':m.get('snapshotPath'),'snapshotSHA256':m.get('snapshotSHA256'),'pageTitle':T.get(u,'').split('\n')[0], 'findings':dec['note'] if r and u==r['url'] else ('取得本文を配布根拠・施設位置の照合に使用。採用可否は関係別記録を参照。' if T.get(u) else '配布本文を取得できず。')})
 entry={'cardId':cid,'state':'partial' if dec else 'pending','sourceUrls':urls,'attempts':attempts,'relations':[],'findings':dec['note'] if dec else reasons[cid],'proposals':[]}
 if dec:
  entry['proposals']=[{'description':v,'evidence':evidence(r,'マンホールカード 配布場所・時間・変更案内',dec['note'])} for v in dec.get('proposals',[])]
 for orig in [x for x in D['relations'] if x['cardId']==cid]:
  pid=orig['placeId'];p=dict(P[pid]);p.update(fixes.get(pid,{}));reason=None
  if not dec:reason=reasons[cid]
  elif dec.get('reject'):reason=dec['note']
  elif pid in dec.get('exclude',{}):reason=dec['exclude'][pid]
  marker=coords.get(pid)
  markerSource=source(marker['url']) if marker else None
  pool=norm(sourcepool+(T[markerSource['url']] if markerSource else ''))
  addressSources=[byurl[u] for u in urls if u in byurl and addr(p,norm(T.get(u,'')))]
  if markerSource and addr(p,norm(T[markerSource['url']])):addressSources.append(markerSource)
  addressOK=bool(addressSources)
  if not reason and not addressOK:reason='配布窓口は確認したが、入力住所「'+p['address']+'」の一致を取得済み公式本文から確定できない。施設住所を未承認。'
  a={'legacyPlaceId':pid,'sourceCondition':orig['condition'],'locationState':'unconfirmed','distributionState':'unknown','distributionFindingState':dec.get('status','active') if dec and not dec.get('reject') else 'unknown','sourceUrls':urls,'attempts':attempts,'remainingReason':reason or '', 'findings':dec['note'] if dec else reasons[cid]}
  if dec and (dec.get('reject') or pid in dec.get('exclude',{})):a['distributionFindingState']='unknown'
  if marker and markerSource['url'] not in a['sourceUrls']:a['sourceUrls']=urls+[markerSource['url']]
  if not reason:
   fid=oldaliases.get(pid,'facility:north-'+pid.split(':')[1]);a['facilityId']=fid
   ev=evidence(r,'マンホールカード / 配布場所・配布時間・在庫状況（'+c['city']+' '+cid+'）', 'AIがカード図柄・弾・配布施設を原典と照合。'+dec['note'])
   place={k:p.get(k,'') for k in ['name','address','phone']};place.update(id=fid,legacyIds=[pid],evidence=evidence(addressSources[0],p['name']+' / 所在地・配布場所住所（'+p['address']+'）','AIが公式ページの施設名称・住所と配布関係を照合。座標は別途目的地マーカー確認時のみ設定。'))
   if norm(place['phone']) not in pool:place['phone']=''
   if marker:
    raw=decode(pathlib.Path(markerSource['snapshotPath']).read_bytes())
    assert str(marker['lat']) in raw and str(marker['lng']) in raw,(pid,'coordinate literal absent')
    place['coordinate']={k:marker[k] for k in ['lat','lng']}
    place['evidence']=evidence(markerSource,marker['sourceLocator'],'AIが公式の目的地座標と配布施設名・住所を照合。建物代表点であり室内窓口の実測位置ではない。現地・人確認ではない。')
    a['locationState']='verified-building';a['coordinatePrecision']=marker['precision']
   else:a['remainingReason']='「'+p['name']+'」の公式目的地座標を確定できず座標省略。配布場所の住所一致は確認済み。'
   places.setdefault(fid,place)
   status=dec.get('status','active');a['distributionState']=status
   a['distributionEvidence']=ev
   condition=dec.get('conditions',{}).get(pid,dec.get('condition',orig['condition']))
   rel={'cardId':cid,'placeId':fid,'sourceHash':Q[cid],'hours':dec.get('hours',c['hours'] or []),'condition':condition,'status':status,'evidence':ev}
   for key in ['validFrom','validTo','reviewUntil']:
    if key in dec:rel[key]=dec[key]
   key=(cid,fid)
   if key in relations:
    existing=relations[key]
    if condition not in existing['condition']:existing['condition']+=' / '+condition
   else:relations[key]=rel
   if status=='unknown':a['remainingReason']+=' 配布時間・現在状態の未確定事項あり。'
  entry['relations'].append(a)
 if entry['relations'] and all(x['distributionState']=='ended' for x in entry['relations']):entry['state']='ended'
 elif entry['relations'] and not entry['proposals'] and all(x['locationState']=='verified-building' and x['distributionState']!='unknown' for x in entry['relations']):entry['state']='verified'
 entry['remainingReason']=' / '.join(dict.fromkeys(x['remainingReason'] for x in entry['relations'] if x['remainingReason'])) or ('' if dec else reasons[cid])
 if entry['proposals']:entry['remainingReason']+=' / 追加・移転・窓口分離proposalあり。'
 audit.append(entry)
ledger={'schema':1,'places':sorted(places.values(),key=lambda x:x['id']),'relations':sorted(relations.values(),key=lambda x:(x['cardId'],x['placeId']))}
result={'schema':1,'region':'north','checkedAt':'2026-11-05','actorType':'ai','cards':audit}
for path,value in [('data/overrides/regions/north.json',ledger),('data/national/regions/north.json',result)]:
 pathlib.Path(path).parent.mkdir(parents=True,exist_ok=True);pathlib.Path(path).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
print('cards',len(audit),'source relations',sum(len(c['relations']) for c in audit),'ledger places',len(places),'ledger relations',len(relations),'coordinates',sum('coordinate' in p for p in places.values()))
print(collections.Counter(c['state'] for c in audit)); print(collections.Counter(r['distributionState'] for c in audit for r in c['relations']))
