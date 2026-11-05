"""Offline generation and verification. Does not fetch or mutate inputs."""
import json,hashlib,zipfile,io,re,datetime,subprocess
from pathlib import Path
B=Path('data/evidence/issue7/hokuriku');BASE=Path('data/work/issue7-baseline');OUT=Path('data/national/issue7/hokuriku.json')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def save(p,d):Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
A=read(BASE/'assignments.json')['hokuriku'];L=read(BASE/'ledger.json');P={p['id']:p for p in L['places']};old=read('data/national/issue5/chubu.json');oldU={p['facilityId']:p for p in old['unresolved']}
R=sum([read(B/x) for x in ['fetch-records.json','additional-fetches.json','followup-fetches.json','final-fetches.json']],[]);byurl={r['sourceUrl']:r for r in R}
D={}
for line in (B/'decisions.tsv').read_text().splitlines():
 suffix,cat,reason=line.split('\t');fid=next(x for x in A if x.endswith(suffix));D[fid]={'reasonCategory':cat,'finding':reason}
assert set(D)==set(A)
ZIP='data/evidence/issue5/chubu/P05-22_GML.zip';zh=sha(ZIP);z=zipfile.ZipFile(ZIP);datasets={};records=[]
for pref in range(15,19):
 nested=f'P05-22_{pref}_GML.zip';s=zipfile.ZipFile(io.BytesIO(z.read(nested)));member=f'P05-22_{pref}.geojson';raw=s.read(member);j=json.loads(raw);datasets[pref]=(j,nested,member,hashlib.sha256(raw).hexdigest())
# Independent name/address search for ALL assigned facilities; approximate names are leads only.
leads=[]
for fid in A:
 p=P[fid];hits=[]
 for pref,(j,n,m,h) in datasets.items():
  for i,f in enumerate(j['features']):
   name=f['properties']['P05_003'];addr=f['properties']['P05_004'];norm=lambda s:re.sub('[ 　県郡市町村字大番地号ヶケニ二ー－-]','',s)
   if (len(name)>3 and name in p['name']) or (norm(addr) and norm(addr) in norm(p['address'])):
    hits.append({'pref':pref,'index':i,'feature':f,'sourceLocator':n+'!'+m+'#/features/'+str(i)})
 leads.append({'facilityId':fid,'method':'P05-22 prefectures 15–18: full feature scan, name containment or normalized address containment; leads only, not automatic approval','matches':hits})
save(B/'p05-leads.json',leads)
selected={'0c0f3438fa9b21563d94':(16,685),'b0499212fbe7ed94fa2a':(15,772),'6f1cf560a94cdce2b66d':(17,798),'cf23f7f3846328ad1c67':(17,798),'ee483872ed2d67e3f0ab':(15,1540),'a97e4141d06f3d78c1ff':(17,916),'b7d603f8e144e10c3bb0':(18,31)}
updates=[];identity=[]
for suffix,(pref,i) in selected.items():
 fid=next(x for x in A if x.endswith(suffix));j,n,m,h=datasets[pref];f=j['features'][i];lng,lat=f['geometry']['coordinates'];locator=f'{n}!{m}#/features/{i}'
 ev={'sourceUrl':'https://nlftp.mlit.go.jp/ksj/gml/data/P05/P05-22/P05-22_GML.zip','snapshotPath':ZIP,'snapshotSHA256':zh,'sourceLocator':locator+'; '+f['properties']['P05_003']+' / '+f['properties']['P05_004'],'checkedAt':datetime.datetime.now(datetime.timezone.utc).date().isoformat(),'actorType':'ai','verificationMethod':'AIがP05-22の名称住所付きPointと今回取得した現行配布先建物を照合。JGD2011/EPSG:6668のGeoJSON経度緯度をlat/lngに組替えた。変換・室内窓口測量はしていない。P05自体は住所ジオコーディングを含む作成工程だが製品仕様の建物外周内検査を採用する。個別照合はdata/evidence/issue7/hokuriku/identity-review.json。'}
 updates.append({'facilityId':fid,'coordinate':{'lat':lat,'lng':lng},'scope':'building','evidence':ev});records.append({'facilityId':fid,'sourceLocator':locator,'memberSHA256':h,'crs':j.get('crs'),'feature':f})
 identity.append({'facilityId':fid,**D[fid],'sources':[r for r in R if fid in r.get('facilityIds',[])]})
fid=next(x for x in A if x.endswith('2a3c4c27a70d89172634'));r=byurl['https://www.city.shibata.lg.jp/shisetsu/kanko/kanko/1022382.html'];s=Path(r['snapshotPath']).read_text();match=re.search(r'https://maps.google.com/maps\?q=([0-9.]+),([0-9.]+)',s);assert match
updates.append({'facilityId':fid,'coordinate':{'lat':float(match[1]),'lng':float(match[2])},'scope':'building','evidence':{'sourceUrl':r['sourceUrl'],'snapshotPath':r['snapshotPath'],'snapshotSHA256':r['snapshotSHA256'],'sourceLocator':'h2 地図 / a[href="'+match[0]+'"]; 施設案内 蔵春閣 / 諏訪町1丁目9番20号','checkedAt':datetime.datetime.now(datetime.timezone.utc).date().isoformat(),'actorType':'ai','verificationMethod':'市が施設詳細HTMLに記載した蔵春閣の数値目的地点qを直接抽出。市の配布原本と施設名称住所が一致し、2023年公開の移築後建物を示す。Google地図本体の取得・抽出やviewportの転用はない。建物代表点であり入口・室内測量ではない。HTMLは座標系名を明記せず、緯度経度qの原値をそのまま保持。'}})
identity.append({'facilityId':fid,**D[fid],'sources':[r]+[x for x in R if fid in x.get('facilityIds',[])]})
# Supplement identity evidence for Arakawa and complete source metadata, separately from Go Evidence.
identity[1]['sources'].append(byurl['https://www.city.murakami.lg.jp/soshiki/90/arakawakouminnkann.html'])
for item in identity:
 if item['facilityId'].endswith('a97e4141d06f3d78c1ff'):item['sources'].append(byurl['https://www.town.noto.lg.jp/kakuka/1012/gyomu/kyouikufront/syokannshisetsu/syougaigakusyuushisetsu/4876.html'])
 if item['facilityId'].endswith('b7d603f8e144e10c3bb0'):item['sources'].append(byurl['https://www.city.fukui.lg.jp/kurasi/suido/youkoso/jyougesuidoukyoku.html'])
accepted={x['facilityId']for x in updates};unresolved=[]
for fid in A:
 if fid in accepted:continue
 attempts=[{'kind':'new-http-fetch','sourceUrl':r['sourceUrl'],'snapshotPath':r.get('snapshotPath'),'snapshotSHA256':r.get('snapshotSHA256'),'fetchedAt':r['fetchedAt'],'result':r.get('error','HTTP '+str(r.get('status'))+'; '+D[fid]['finding'])}for r in R if fid in r.get('facilityIds',[])]
 attempts.append({'kind':'new-local-dataset-investigation','sourceUrl':'https://nlftp.mlit.go.jp/ksj/gml/data/P05/P05-22/P05-22_GML.zip','snapshotPath':ZIP,'snapshotSHA256':zh,'result':'全国保存ZIPの15–18県を新たに走査。p05-leads.jsonの当該ID参照。公的集会施設・役場データのため商業施設等の網羅を意味しない。'})
 attempts.append({'kind':'prior-record-reread','path':'data/national/issue5/chubu.json','locator':'unresolved[facilityId='+fid+']','result':'旧理由とpriorResearchの全国追補・レビューを照合。今回のHTTP取得と区別。'})
 unresolved.append({'facilityId':fid,'reasonCategory':D[fid]['reasonCategory'],'reason':D[fid]['finding'],'nextSource':{'url':P[fid]['evidence']['sourceUrl'],'required':('棟名付き現行GIS・建物外形と配布建物の対応。旧競合点の出所と棟を解消する資料。' if D[fid]['reasonCategory']in ['multiple-buildings','coordinate-conflict','relocation-or-building-identity'] else '対象建物を明示した自治体施設詳細または公開GISの数値座標。'),'notRequired':'入口や室内窓口の精密位置、全施設一律の2022年以降改修不存在証明は不要。'},'investigationStatus':'new-investigation-performed-unresolved','attempts':attempts})
# Attach adaptive follow-ups explicitly by facility.
extra={ 'b7d939284218814b6bba':['21263f0a9b00628b2798.html'], '2c154ba68d0d6982682e':['5a9bde81102913dfba1c.pdf','f664a5c95afb2a0f442a.html'], '23bfc837f9708f3a5bff':['d53d241bc095af904dd4.html'], '3309d6639e95492f62ff':['d53d241bc095af904dd4.html'], '9720552572da10795a23':['f0a0e1189955c1413d11.pdf','56203.pdf'], 'd96a5cb4a1b2f5fc4173':['f0a0e1189955c1413d11.pdf','56203.pdf'], 'a97e4141d06f3d78c1ff':['4699003427708de7d04f.html'], 'shibata-tourist-information':['b4d854f0a3a36dd06236.html']}
for x in unresolved:
 for suffix,names in extra.items():
  if x['facilityId'].endswith(suffix):
   for r in R:
    if any(r.get('snapshotPath','').endswith(n) or r['sourceUrl'].endswith(n) for n in names):x['attempts'].append({'kind':'new-adaptive-http-fetch',**r})
# Exact correction to a demonstrated old prose error, not distribution/coordinate changes.
fid=next(x for x in A if x.endswith('63a2e5f9e47674402ad4'));idx=next(i for i,x in enumerate(old['unresolved'])if x['facilityId']==fid);before=old['unresolved'][idx]['reason'];after=before.replace('河井町4-66-1','糸魚川市大町2-2-19')
corrections=[{'facilityId':fid,'path':'data/national/issue5/chubu.json','pointer':f'/unresolved/{idx}/reason','old':before,'new':after,'reason':'旧調査理由に輪島市の住所が混入。糸魚川市の現行配布原本と固定台帳は大町2-2-19。座標の承認や台帳変更を意味しない。','evidence':byurl[P[fid]['evidence']['sourceUrl']]}]
save(OUT,{'schema':1,'updates':updates,'unresolved':unresolved,'corrections':corrections});save(B/'identity-review.json',identity);save(B/'p05-records.json',records)
save(B/'classification.json',[{'facilityId':f,'name':P[f]['name'],**D[f],'status':'candidate' if f in accepted else 'unresolved','investigationStatus':'new-investigation-performed'}for f in A])
# Read and hash every referenced existing snapshot without copying it; unknown retrieval times stay unknown.
refs={};missing=[]
def walk(x):
 if isinstance(x,dict):
  p=x.get('snapshotPath');h=x.get('snapshotSHA256')
  if p and h:
   if Path(p).exists():
    actual=sha(p);assert actual==h,(p,actual,h);refs[p]=h
   else:missing.append(p)
  for v in x.values():walk(v)
 elif isinstance(x,list):
  for v in x:walk(v)
for fid in A:
 walk(P[fid]);walk(oldU.get(fid,{}))
for x in old['updates']:
 if x['facilityId']in A:walk(x)
for r in R:walk(r)
walk(read(OUT));save(B/'referenced-snapshot-hashes.json',refs)
inputs={str(BASE/n):sha(BASE/n)for n in ['ledger.json','full.json','assignments.json','hashes.json']}
for n,h in read(BASE/'hashes.json').items():assert sha(BASE/n)==h
for p in ['data/national/issue5/chubu.json','data/national/issue5/chubu-reviewed.json','data/national/issue5/reviews/chubu.json','data/national/location-updates/chubu-east-north.json','data/national/reviews/facility-point-scope.json','cmd/builddata/ledger.go','data/evidence/national/official-facility-index/p05-spec.pdf','data/evidence/national/official-facility-index/p05-spec.txt','data/evidence/national/official-facility-index/p05-spec.pdf.source.json','data/evidence/issue5/chubu/P05-22_GML.zip.source.json',ZIP]:inputs[p]=sha(p)
save(B/'input-hashes.json',inputs)
fields={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
for u in updates:assert set(u['evidence'])==fields
assert len(updates)+len(unresolved)==len(A)==len(set(A));assert accepted.isdisjoint({x['facilityId']for x in unresolved})
for rec in records:
 u=next(x for x in updates if x['facilityId']==rec['facilityId']);assert [u['coordinate']['lng'],u['coordinate']['lat']]==rec['feature']['geometry']['coordinates']
assert updates[-1]['coordinate']=={'lat':float(match[1]),'lng':float(match[2])}
result={'assigned':len(A),'candidates':len(updates),'unresolved':len(unresolved),'corrections':len(corrections),'httpAttempts':len(R),'httpSuccesses':sum('snapshotPath'in r for r in R),'referencedSnapshotHashesVerified':len(refs),'missingOldSnapshots':sorted(set(missing)),'fixedInputHashesMatch':True,'uniqueCompleteClassification':True,'numericOriginalsExactMatch':True,'goEvidenceFieldsMatch':True,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()};save(B/'validation.json',result);print(json.dumps(result,ensure_ascii=False))
