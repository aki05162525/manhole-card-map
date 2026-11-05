"""Offline generation and integrity checks. Run from repository root; no fetches."""
import pathlib,json,hashlib,zipfile,io,re,datetime,collections
ROOT=pathlib.Path(__file__).resolve().parents[4];D=ROOT/'data/evidence/issue7/kinki-west';OUT=ROOT/'data/national/issue7/kinki-west.json'
def read(p):return json.loads((ROOT/p).read_text())
def dump(p,o):p.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
ids=read('data/work/issue7-baseline/assignments.json')['kinki-west'];assert len(ids)==len(set(ids))
baseline=read('data/work/issue7-baseline/hashes.json')
for fn,h in baseline.items():assert sha(ROOT/'data/work/issue7-baseline'/fn)==h,(fn,'fixed input modified')
rows=read('data/evidence/issue7/kinki-west/inventory.json');rows={r['facilityId']:r for r in rows};assert set(rows)==set(ids)
logs=read('data/evidence/issue7/kinki-west/fetch-log.json');log={l['url']:l for l in logs};assert len(log)==len(logs)
for l in logs:
 if 'path' in l:assert sha(ROOT/l['path'])==l['sha256'],l['path']
 assert l['fetchedAt'] and ('path' in l or 'error' in l)
 assert 'google.' not in l.get('finalUrl',''),'Do not use Google map content'
zip_path='data/evidence/issue5/chubu/P05-22_GML.zip';zip_meta=read(zip_path+'.source.json');assert sha(ROOT/zip_path)==zip_meta['sha256']
z=zipfile.ZipFile(ROOT/zip_path);members={}
for pref in ['27','28','29','30']:
 inner=f'P05-22_{pref}_GML.zip';q=zipfile.ZipFile(io.BytesIO(z.read(inner)));member=f'P05-22_{pref}.geojson';b=q.read(member);geo=json.loads(b);assert geo['crs']['properties']['name']=='urn:ogc:def:crs:EPSG::6668';members[pref]=(geo,hashlib.sha256(b).hexdigest(),inner+'/'+member)
decisions=read('data/evidence/issue7/kinki-west/decisions.json');notes=read('data/evidence/issue7/kinki-west/unresolved-notes.json');decision={d['facilityId']:d for d in decisions};assert len(decision)==len(decisions)
oldjson=read('data/national/issue5/kinki.json');old={x['facilityId']:x for x in oldjson['unresolved']}
legacy=read('data/national/location-updates/kinki.json');legacy_by={r['facilityId']:r for r in legacy.get('unresolved',[])}
# Read and hash ALL referenced old distribution originals; do not copy or invent timestamps.
oldrefs={};old_source_meta=read('data/evidence/issue5/kinki/reused-sources.json'); old_time={x['snapshotPath']:x for x in old_source_meta}
for fid in ids:
 e=rows[fid]['distributionEvidence'];p=ROOT/e['snapshotPath'];assert p.exists(),e['snapshotPath'];assert sha(p)==e['snapshotSHA256']
 body=p.read_bytes();oldrefs[e['snapshotPath']]={'path':e['snapshotPath'],'sha256':sha(p),'bytes':len(body),'sourceUrl':e['sourceUrl'],'acquisitionMetadataReference':'data/evidence/issue5/kinki/reused-sources.json','fetchedAt':old_time.get(e['snapshotPath'],{}).get('fetchedAt'),'fetchedAtNote':'既存取得メタデータの原取得時刻。未記載ならnullで保持し再読時刻で置き換えない。'}
 # Existence of the text is a reread/structured extraction, not a claim of manual review.
 rows[fid]['priorSnapshotReadBytes']=len(body)
reviews=[];updates=[];unresolved=[];classification=[]
for fid in ids:
 r=rows[fid];attempts=[]
 for url in r['fetchUrls']:
  l=log[url];a={'kind':'new-web-fetch','url':url,'fetchedAt':l['fetchedAt']}
  if 'path' in l:
   b=(ROOT/l['path']).read_bytes();s=b.decode('utf-8',errors='replace');title=re.search(r'<title[^>]*>(.*?)</title>',s,re.S|re.I)
   a.update(snapshotPath=l['path'],snapshotSHA256=l['sha256'],status=l['status'],title=re.sub('<[^>]*>','',title[1]).strip() if title else None,
    result='原本取得・施設名住所および位置表現の構造探索。取得成功だけでは建物同定の承認を意味しない。',
    numericDestinationPatterns=len(re.findall(r'!3d\d+\.\d+!4d|[?&]q=\d|L\.marker|markerInfos|google.maps.Marker',s)),
    iframeViewportPresent='maps/embed?pb=' in s)
  else:a.update(result='取得失敗。制限回避・同一URL再試行なし。',error=l['error'])
  attempts.append(a)
 attempts.append({'kind':'new-p05-record-comparison','sourceUrl':zip_meta['url'],'snapshotPath':zip_path,'snapshotSHA256':zip_meta['sha256'],'fetchedAt':zip_meta['fetchedAt'],'result':f"大阪・兵庫・奈良・和歌山のGeoJSONを実際に再走査。名称/住所の広い候補 {len(r['p05Candidates'])} 件。候補には別自治体同名や住所前方一致が含まれ、自動採用しない。",'recordDetails':'data/evidence/issue7/kinki-west/inventory.json#'+fid})
 if fid in decision:
  d=decision[fid];geo,mhash,locator=members[d['pref']];f=geo['features'][d['index']];assert f['properties']['P05_003']==d['expectedName'];lon,lat=f['geometry']['coordinates'];assert 33<lat<36 and 134<lon<137
  assert f==next(c['feature'] for c in r['p05Candidates'] if c['pref']==d['pref'] and c['index']==d['index'])
  references=[log[u] for u in r['fetchUrls'] if 'path' in log[u]];assert references
  review={'facilityId':fid,'name':r['name'],'address':r['address'],'identityReason':d['identityReason'],'coordinate':{'lat':lat,'lng':lon},'sourceFeature':f,'sourceMember':locator,'sourceMemberSHA256':mhash,'featureIndex':d['index'],'datum':'JGD2011 EPSG:6668; GeoJSON経度,緯度をlat,lngに対応。測地系変換・測量精度の上乗せなし。','datasetFetchedAt':zip_meta['fetchedAt'],'currentSources':references,'priorDistributionEvidence':r['distributionEvidence'],'attempts':attempts,'decision':'candidate-for-parent-independent-review'}
  reviews.append(review)
  e={'sourceUrl':zip_meta['url'],'snapshotPath':zip_path,'snapshotSHA256':zip_meta['sha256'],'sourceLocator':f"{locator} $.features[{d['index']}] P05_003={d['expectedName']}; P05_004={f['properties']['P05_004']}; geometry.coordinates=[{lon},{lat}]; memberSHA256={mhash}", 'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':d['identityReason']+' 国土数値情報P05-22の建物外周内の施設点（CC BY 4.0）を現公式案内と照合。室内・入口の測量ではない。複数根拠のURL/取得時刻/hashは data/evidence/issue7/kinki-west/coordinate-review.json の同facilityId参照。'}
  assert set(e)=={'sourceUrl','snapshotPath','snapshotSHA256','sourceLocator','checkedAt','actorType','verificationMethod'}
  updates.append({'facilityId':fid,'coordinate':{'lat':lat,'lng':lon},'scope':'building','evidence':e})
  category='新規P05建物点同定';status='new-research-manual-candidate'
 else:
  k=fid.split('kinki-')[1];n=notes.get(k)
  if n:category,reason,nexttask=n;status='new-research-manual-unresolved'
  else:
   category='原典不足';status='new-fetch-and-p05-screening-partial'
   reason=f"対象「{r['name']}」（{r['address']}）について今回公式配布・関連施設ページを新規取得し、P05の4府県を再照合した。採用可能な建物点の名称住所・数値の組を確定していない。今回の原本構造探索とP05候補比較までで、全リンク・全添付資料の個別精査は未完。旧保留の転記による完了扱いではない。"
   nexttask=f"{r['name']}・{r['address']}に対応する自治体施設GIS/公式建物マーカー。今回取得ページの施設固有リンク・配置図を個別精査し、存在する場合は建物外形との対応を確認。"
  unresolved.append({'facilityId':fid,'reasonCategory':category,'reason':reason,'nextSource':{'url':r['distributionEvidence']['sourceUrl'],'task':nexttask},'investigationStatus':status,'attempts':attempts})
 prior=old.get(fid,{}).get('reason','');priorcat='移転別棟' if any(w in prior for w in ['移転','別館','建替','別施設','新窓口','公園全体']) else '原典不足'
 classification.append({'facilityId':fid,'name':r['name'],'address':r['address'],'classification':'candidate' if fid in decision else 'unresolved','investigationStatus':status,'reasonCategory':category,'previousReasonCategory':priorcat,'previousReason':prior,'previousNationalRecordPresent':fid in legacy_by,'previousOriginal':r['distributionEvidence']['snapshotPath'],'precisionRequirement':'building only; no room/entrance survey','newFetchAttempts':len(r['fetchUrls'])})
# Exact documentary correction proposal only; original file remains untouched.
spec='data/evidence/national/official-facility-index/p05-spec.txt';specbytes=(ROOT/spec).read_bytes();assert '該当施設の建物外周内に' in specbytes.decode()
doc='data/evidence/national/official-facility-index/README.md';before='製品仕様書8章は建物外周内の位置検査を定めている';assert before in (ROOT/doc).read_text()
corrections=[{'targetPath':doc,'old':before,'new':'製品仕様書6章「データ品質」は建物外周内の位置検査を定めている','reason':'保存済み第3.0.1版仕様書の目次と該当品質評価尺度は6章。8章はメタデータ。コード動作への変更ではなく参照章の訂正提案。','evidence':{'snapshotPath':spec,'snapshotSHA256':sha(ROOT/spec),'sourceLocator':'目次6 データ品質／品質評価尺度「該当施設の建物外周内に」；8 メタデータ'},'applied':False}]
result={'schema':1,'updates':updates,'unresolved':unresolved,'corrections':corrections}
allids=[x['facilityId'] for x in updates+unresolved];assert len(allids)==len(set(allids)) and set(allids)==set(ids)
assert all(len(x['attempts'])>=2 for x in unresolved)
# Dataset license/spec original references, not copies.
reuse=[{'path':zip_path,'sha256':sha(ROOT/zip_path),'fetchedAt':zip_meta['fetchedAt'],'metadataPath':zip_path+'.source.json'}]
for p in ['data/evidence/national/official-facility-index/p05-spec.pdf',spec,'data/evidence/issue5/chubu/p05-catalog.html','data/evidence/issue5/chubu/p05-terms.html','data/national/issue5/kinki.json','data/national/issue5/reviews/kinki.json','data/national/location-updates/kinki.json']:
 reuse.append({'path':p,'sha256':sha(ROOT/p),'fetchedAt':None,'note':'既存原本/記録の再読。取得時刻を再読時刻で置き換えない。'})
reuse+=list(oldrefs.values())
dump(OUT,result);dump(D/'coordinate-review.json',reviews);dump(D/'classification.json',classification);dump(D/'reused-references.json',reuse)
report={'assigned':len(ids),'updates':len(updates),'unresolved':len(unresolved),'corrections':len(corrections),'newFetchURLs':len(logs),'successfulFetches':sum('path' in l for l in logs),'failedFetches':sum('error' in l for l in logs),'investigationStatuses':dict(collections.Counter(c['investigationStatus'] for c in classification)),'allIdsClassifiedExactlyOnce':True,'allNewSnapshotHashesVerified':True,'oldDistributionHashesVerified':len(oldrefs),'p05ZipAndMemberHashesVerified':True,'coordinatesReproducedFromOriginalFeatures':len(updates),'fixedInputHashesUnchanged':baseline,'evidenceFieldsExactlySeven':True,'googleMapContentUsed':False,'distributionOrRelationChanges':False,'codeDocumentDiscrepancies':[],'sourceDocumentCorrections':len(corrections)}
dump(D/'validation.json',report);print(json.dumps({k:v for k,v in report.items() if k not in ['fixedInputHashesUnchanged']},ensure_ascii=False))
