"""Offline generation from explicit human-readable research decisions; no network."""
import json,pathlib,hashlib,datetime,zipfile,io,re
D=pathlib.Path('data/evidence/issue7/tohoku');OUT=pathlib.Path('data/national/issue7/tohoku.json')
def read(p):return json.loads(pathlib.Path(p).read_text())
def save(p,x):pathlib.Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
ids=read('data/work/issue7-baseline/assignments.json')['tohoku'];ledger=read('data/work/issue7-baseline/ledger.json');places={p['id']:p for p in ledger['places']};old={p['facilityId']:p for p in read('data/national/issue5/north.json')['unresolved']};dec=read(D/'decisions.json')
# Normalize all new snapshot paths; acquisition times remain unchanged.
records=[]
for name in ['fetch-records.json','support-records.json','extra-records.json']:
 rows=read(D/name)
 for r in rows:
  if 'snapshotPath' in r and pathlib.Path(r['snapshotPath']).is_absolute():r['snapshotPath']=str(pathlib.Path(r['snapshotPath']).relative_to(pathlib.Path.cwd()))
 save(D/name,rows);records+=rows
byurl={r['sourceUrl']:r for r in records};targets=read(D/'fetch-targets.json');sup=read(D/'support-targets.json');extra=read(D/'extra-targets.json');p05search={r['facilityId']:r['candidates'] for r in read(D/'p05-candidate-search.json')}
zipPath='data/evidence/issue5/chubu/P05-22_GML.zip';zipHash=sha(zipPath);z=zipfile.ZipFile(zipPath);checked=datetime.datetime.now(datetime.timezone.utc).date().isoformat();updates=[];unresolved=[];audit=[];oldrefs={}
def prior_category(s):
 if 'Google Maps' in s:return '条件未確認'
 if '追加proposal' in s:return '未再調査'
 if any(k in s for k in ['別棟','共通点','管理棟','住所が','不一致','番地','混在','同一建物']):return '移転・別棟・住所競合'
 return '原典不足'
def current_category(n):
 if n in [5,7,13,15,22,32,46,50,55,58,60,61,62,69,70,75,76,82]:return '移転・別棟・住所競合'
 return '原典不足'
def oldref(e):
 if not e or 'snapshotPath'not in e:return
 p=e['snapshotPath'];assert pathlib.Path(p).exists(),p;assert sha(p)==e['snapshotSHA256'],p
 oldrefs[p]={k:e.get(k) for k in ['sourceUrl','snapshotPath','snapshotSHA256']};oldrefs[p]['fetchedAt']=None;oldrefs[p]['note']='証拠オブジェクトに取得日時がないため不明。checkedAtから推定しない。旧取得台帳があればそちらを参照。'
for n,i in enumerate(ids):
 p=places[i];prev=old[i];oldref(p.get('evidence'));rels=[r for r in ledger['relations'] if r['placeId']==i]
 for r in rels:oldref(r.get('evidence'))
 urls=list(dict.fromkeys(targets[i]+sup[i]+extra.get(str(n),[])))
 if n==9:urls+=extra['3']
 if n==82:urls+=extra['32']
 attempts=[{'kind':'old-record-review','sourcePath':'data/national/issue5/north.json','sourceLocator':i,'result':prev['reason']},{'kind':'p05-22-name-address-search','sourcePath':zipPath,'sourceLocator':'P05-22_02..07 GeoJSON; p05-candidate-search.json#'+i,'result':'自治体コードで候補を絞り名称・住所を照合。候補なしと非採用を区別。','candidates':p05search[i]}]
 for u in dict.fromkeys(urls):
  r=byurl.get(u)
  if r:attempts.append({'kind':'new-fetch','result':'取得済み・原本保存' if 'snapshotPath'in r else '取得失敗・再試行なし',**r})
 a={'facilityId':i,'name':p['name'],'address':p['address'],'previousReasonCategory':prior_category(prev['reason']),'previousReason':prev['reason'],'investigationStatus':'new-source-investigation-and-old-record-review','attempts':attempts}
 if str(n) in dec['p05']:
  code,idx,finding=dec['p05'][str(n)];outer=f'P05-22_{code}_GML.zip';inner=f'P05-22_{code}.geojson';sub=zipfile.ZipFile(io.BytesIO(z.read(outer)));raw=sub.read(inner);fc=json.loads(raw);f=fc['features'][idx];lng,lat=f['geometry']['coordinates'];locator=f'{outer}!{inner}#/features/{idx}'
  ev={'sourceUrl':'https://nlftp.mlit.go.jp/ksj/gml/data/P05/P05-22/P05-22_GML.zip','snapshotPath':zipPath,'snapshotSHA256':zipHash,'sourceLocator':locator,'checkedAt':checked,'actorType':'ai','verificationMethod':finding+' 国土数値情報P05-22の建物外周内検査仕様に基づく建物代表点。JGD2011/EPSG:6668、経度・緯度の原配列を保持。2022年基準の点を今回取得した配布・施設案内と照合。入口・室内精度は主張しない。詳細証拠はdata/evidence/issue7/tohoku/audit.jsonの当該ID。出典：国土交通省 国土数値情報「市町村役場等及び公的集会施設データ」を加工（対象抽出・軸順変換）。現行第3.0版カタログ・PDL1.0と旧CC BY表記の併存はREADME参照。'}
  updates.append({'facilityId':i,'coordinate':{'lat':lat,'lng':lng},'scope':'building','evidence':ev});a.update(decision='candidate',finding=finding,rawFeature=f,sourceLocator=locator,memberSHA256=hashlib.sha256(raw).hexdigest(),crs=fc.get('crs'))
 elif str(n) in dec['html']:
  h=dec['html'][str(n)];r=byurl[h['sourceUrl']];ev={k:r[k] for k in ['sourceUrl','snapshotPath','snapshotSHA256']};ev.update(sourceLocator=h['sourceLocator'],checkedAt=checked,actorType='ai',verificationMethod=h['finding']+' 自治体一般著作権表示と単一座標の事実利用を区別し、HTML全体のオープンライセンスは主張しない。数値qの利用を個別に禁止する記載は確認できない。市施設案内を出典表示する。')
  updates.append({'facilityId':i,'coordinate':h['coordinate'],'scope':'building','evidence':ev});a.update(decision='candidate',finding=h['finding'],sourceLocator=h['sourceLocator'])
 else:
  reason=dec['unresolved'][str(n)];cat=current_category(n);nextsource={'urls':list(dict.fromkeys(urls))[-3:],'needed': '現配布先建物の名称住所に対応する自治体GIS・公開施設点又はPLATEAU建物外形。'+('公式案内と配置図で移転・別棟・番地の対応を解決する。' if cat.startswith('移転') else '表示中心・蓋・住所点でなく当該建物の数値原典を確認する。')}
  unresolved.append({'facilityId':i,'reasonCategory':cat,'reason':reason,'nextSource':nextsource,'investigationStatus':'new-source-investigation-unresolved','attempts':attempts});a.update(decision='unresolved',finding=reason,reasonCategory=cat)
 audit.append(a)
# Do not claim a failed PDF was read.
for collection in [unresolved,audit]:
 for a in collection:
  if a['facilityId']==ids[76]:
   key='reason' if 'reason'in a else 'finding';a[key]=a[key].replace('現配布案内・2021年新庁舎の公開資料を調査。','現配布案内を再取得。新庁舎2021年公開PDFは検索結果を確認して取得試行したがHTTP404で原本未取得。')
oldrefs[zipPath]={'sourceUrl':'https://nlftp.mlit.go.jp/ksj/gml/data/P05/P05-22/P05-22_GML.zip','snapshotPath':zipPath,'snapshotSHA256':zipHash,'fetchedAt':read(zipPath+'.source.json')['fetchedAt'],'metadataPath':zipPath+'.source.json'}
save(OUT,{'schema':1,'updates':updates,'unresolved':unresolved,'corrections':[]});save(D/'audit.json',audit);save(D/'old-references.json',list(oldrefs.values()));save(D/'summary.json',{'assigned':len(ids),'candidates':len(updates),'unresolved':len(unresolved),'newFetchAttempts':len(records),'successfulResponses':sum('snapshotPath'in r for r in records),'newFetchFacilityCoverage':sum(any(x['kind']=='new-fetch' for x in a['attempts']) for a in audit),'corrections':0});print(read(D/'summary.json'))
