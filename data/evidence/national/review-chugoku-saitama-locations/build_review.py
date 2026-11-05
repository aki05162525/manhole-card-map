"""Offline independent review artifact builder. Writes only this review's two allowed paths."""
import json,hashlib,re,zipfile,io,html,urllib.parse,datetime
from pathlib import Path
ROOT=Path.cwd(); OUT=Path('data/evidence/national/review-chugoku-saitama-locations')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def rel(p):
 p=Path(p);return str(p.relative_to(ROOT) if p.is_absolute() else p)
def write(name,d): (OUT/name).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def snippet(t,term,after=160):
 i=t.find(term)
 return t[max(0,i-25):i+after] if i>=0 else ''
def excerpts(t,name,address):
 terms=[name, name.split(' ')[0],address.split('県')[-1][:8],'所在地','住所','配布場所','本館','東館','受付']
 s=list(dict.fromkeys(snippet(t,x) for x in terms if x));return [x for x in s if x][:5]
inputs={r:read('data/national/location-updates/'+r+'.json') for r in ['chugoku-shikoku','kanto-north-saitama']}
audit={'chugoku-shikoku':{r['facilityId']:r for r in read('data/evidence/national/locations-chugoku-shikoku/facility-audit.json')},'kanto-north-saitama':{r['facilityId']:r for r in read('data/evidence/national/locations-kanto-north-saitama/decisions.json')}}
texts={r:{x['index']:x for x in read(OUT/(r+'-extracted.json'))} for r in inputs}
support={(r['region'],r['index']):r for r in read(OUT/'support-extracted.json')}
parentPath='data/work/national-assembled-tokyo-kinki-locations.json';parent=read(parentPath);places={p['id']:p for p in parent['places']}
sm=read('data/evidence/national/locations-kanto-north-saitama/manifest.json'); smurl={m['url']:m for m in sm}
cm=read('data/evidence/national/locations-chugoku-shikoku/reused-manifest.json')
# These decisions concern the meaning of the proposed point, not numerical presence alone.
cs_defer={
13:'主原典は備前長船刀剣博物館を含む刀剣の里の案内で、鍛刀場・工房等の複数棟を明示する。保存されたqと配布受付建物との対応を確定できない。博物館または配布棟を指す独立した地点根拠が必要。長船支所の保留とは別件。',
14:'公式施設紹介はビジターセンター・ミュージアム・サイクリングセンター・風の葉を含む複数棟。qはGREENable HIRUZEN全体の目的地で、カード受付建物を選ぶ証拠がない。',
29:'配布原典は入船山記念館券売所を指定。一方地点原典は旧司令長官官舎、郷土館、歴史民俗資料館を含む入船山記念館全体。券売所の建物点と同定できない。',
39:'原典は約3万平方メートルの庭園と書院・茶室・あずまやを説明。qは長府庭園目的地であり、配布受付建物との対応なし。庭園全体点を建物確定点にしない。',
44:'インフォメーションセンターが萩・明倫学舎本館内にあることは確認できる。ただし複数校舎の施設全体qが本館を指すことは保存原典だけでは未確認。棟別地点か配置図との対応が必要。',
80:'端出場エリア（立川町707-3）と東平エリア（654-3）は識別でき、本館1階チケット売り場も同定できる。しかし観光ページの施設全体qから本館への対応は証明されていない。',
83:'og:localityとog:latitude,og:longitudeはウェルピア伊予全体の位置メタデータ。複合宿泊・スポーツ施設のどの受付建物に対応するか未確認。',
100:'道の駅一覧の美良布全体qと所在地1211は一致するが、韮生の里美良布直販店の建物を選ぶ根拠が不足。道の駅全体を店舗別棟の点にしない。'}
s_defer={i:'県施設情報の地点対象は水循環センター全体。公社の支社名・管理先・住所の対応は確認できるが、管理棟／支社受付建物の地点とする証拠がない。管理棟名付き地点または配置図との対応が必要。取得メタデータ欠落ではなく建物同定不足による保留。' for i in range(5)}
s_defer.update({5:'小山川水循環センター（東五十子382-1）の施設全体q。配布を受け付ける建物を区別する証拠がなく、他5支社と同じ建物精度基準で保留。',27:'配布案内は鴻巣市役所本庁舎1階24番窓口。主原典は新館にも言及する市役所全体アクセスであり、qが本庁舎を選ぶ棟別根拠が不足。',28:'同じ下水道課の別ID。配布案内の本庁舎1階24番窓口と市役所全体qの対応未確認。重複IDを統合せず両方保留。',30:'配布原典が草加市文化会館コミュニティー棟1階を明記。県の施設Markerは文化会館名で、ホールとコミュニティー棟のどちらを指すか未確認。住所一致だけで別棟へ流用しない。',36:'配布案内は入間市役所本庁舎B棟2階。県施設Markerは入間市役所全体で、B棟との対応が未確認。',37:'守衛室は公式配布案内で本庁舎地下と確認でき、独立守衛小屋とは扱わない。ただしA/B棟を含む市役所代表点から該当建物への対応が未確認のため、平日窓口とともに保留。'})
cs_notes={2:'主原典の題名は益田観光ガイド友の会だが、住所駅前町17-2・連絡先益田市観光協会・電話0856-22-7120が配布案内と対応。別URL/別題名だけで排除せず、当該住所の観光協会地点として採用。',6:'くらしきシティプラザ2Fと西ビル2階は同じ原典本文に併記。同一施設として採用。',7:'座標は玉島3-8-25の旧柚木家住宅を指し妥当。しかしfacilityの住所・電話がJR新倉敷駅と混在。親台帳に駅窓口は別IDで存在するため、旧柚木家側の記録修正後に採用可能。駅の座標には流用しない。',11:'牛窓支所の地点と、公式来館案内の牛窓庁舎3・4階の美術館を対応。同一建物の別階なので採用。',12:'牛窓支所を指すinitlat/initlongを外部JSのMarker生成へ追跡。初期中心だけを採用したものではない。',22:'GDMap2のid=354、title=道の駅「くめなん」に結び付くlat/lng。一般地図初期中心とは区別。',25:'配布を行う大州雨水貯留池見学案内本文の所在地と施設用staticmap markers/q。マツダスタジアム地下の見学施設の位置であり、マンホール蓋の数値は採用しない。',28:'P05の三篠公民館・打越町10-23は現配布案内と一致。市子育てページは同住所だが電話も082-253-2529と配布案内082-237-3077から異なる。当該ページのq/markers=34.3659828,132.4618454は不採用にし、P05=34.411862,132.449707の独立した建物地点仕様のP05を選択。',46:'主原典は上下水道局の大手町3-3-2。フッターの市役所3-3-3と区別しstaticmap markersを採用。',50:'P05は吉野川市役所東館の独立feature。市組織案内・配布案内も東館1階を明記。同住所の本館featureへ流用していない。',51:'P05の吉野川市役所featureと配布案内本館1階休日窓口を照合。東館の別featureと区別。',54:'同じ広島字東裏30でも松茂町総合会館のP05 featureを採用。町役場のMarkerとは別の建物点。',58:'P05市民サービスセンターと公式配布先瓦町FLAG8階の名称住所が対応。',60:'現公式地図は大手町2-4-21。旧P05大手町2-3-1は不採用。移転前の地点を流用していない。',71:'markerInfos内の綾川町立生涯学習センターを選択。同配列の綾上図書館やcenter値は採用しない。',78:'原典名自体が八幡浜みなっと「みなと交流館」。施設全体名だけではなく対象館名・住所・営業時間を照合。',91:'主原典は施設公式JS。latlngがMap.centerだけでなくMarker.positionに渡ることを確認。施設案内の高須353-2との参照連鎖で採用。',94:'のいち駅構内と明記した香南市観光協会ページの地点。駅全体中心を外挿したものではない。',97:'同じ現住所の観光協会別ID。原典はのいち駅構内の協会を明記。ID統合はしない。'}
s_notes={11:'県の地点対象は川口駅前行政センター（キュポ・ラ本館棟4階）。市配布案内はキュポ・ラ2階総合受付。観光物産協会の保存原本809b50559d8fe90f211c.htmlも「キュポ・ラ本館棟2階（川口市川口1-1-1）」と明記。住所だけでなく同じ本館棟という連鎖により建物代表点を共有。上下水道局庁舎の別原典は採用根拠から除外。',13:'市配布案内と観光協会が忍2-1-8・商工センター1階と明記。観光協会の「道路向かい」は駐車場の説明で、物産館が別棟という意味ではない。商工センターMarkerを採用。',23:'観光原典は本庄早稲田の杜ミュージアムそのもの。早稲田大学キャンパス全体の中心ではなく93号館1階の施設目的地。',33:'県原典住所欄に新曽南庁舎1・2階。市の庁舎案内が同庁舎4階上下水道部を明記するため、階だけ異なる建物代表点として採用。',34:'新曽南庁舎1・2階のさくらパルを明示した県Marker。市配布案内の2階と対応。',35:'県原典は戸田公園駅前行政センター3Fの子育て広場、市公式トビック案内は同センター2階・本町4-15-11。同じ建物を明示しているので採用。',40:'県施設レコードの名称が「桶川市観光協会 中山道宿場館」。寿1-11-19の同居施設として採用。',41:'県施設レコードに観光協会と宿場館を併記。別IDを維持して同一建物点を共有。',48:'県レコードはステラ・イーストの1～3階の施設利用情報と福岡1-1-8を掲載。市配布案内は同施設受付カウンター。市役所の別住所／第2庁舎とは区別。',51:'公式配布案内が滑川町役場の土日祝警備員室と明記。別敷地のセンター守衛室ではなく役場窓口として扱う。',54:'県Markerの名称は新しい村・森の市場 結。町配布記事13667も森の市場 結を指定。アクセス原典で別棟の農の家は市場を通り越すと明記されており、村全体の点と区別できる。'}
reviews=[];p05=[];pathpatch=[];evidencefiles={}
for region,data in inputs.items():
 for i,u in enumerate(data['updates']):
  e=u['evidence'];a=audit[region][u['facilityId']];p=rel(e['snapshotPath']);b=Path(p).read_bytes();h=hashlib.sha256(b).hexdigest();assert h==e['snapshotSHA256']
  evidencefiles[p]=h
  primary={'sourceUrl':e['sourceUrl'],'snapshotPath':p,'snapshotSHA256':h,'bytes':len(b),'sourceLocator':e['sourceLocator']}
  if region=='chugoku-shikoku':
   matches=[m for m in cm if m.get('requestedUrl')==e['sourceUrl'] and m.get('sha256')==h];assert matches
   primary['acquisitionRecords']=[{'requestedUrl':m.get('requestedUrl'),'fetchedAt':m.get('fetchedAt'),'reusedFrom':m.get('reusedFrom')} for m in matches]
   if Path(e['snapshotPath']).is_absolute():pathpatch.append({'target':'data/national/location-updates/'+region+'.json','facilityId':u['facilityId'],'path':f'/updates/{i}/evidence/snapshotPath','old':e['snapshotPath'],'new':p})
  else:
   m=smurl[e['sourceUrl']];assert m['snapshotSHA256']==h
   primary['fetchedAt']=m.get('fetchedAt');primary['acquisitionMetadataMissing']=m.get('fetchedAt') is None
  name=a['name'];address=a['address'];body=texts[region].get(i,{}).get('text','')
  primary['identityExcerpts']=excerpts(body,name,address)
  if 'P05' in e['sourceUrl']:
   member,rest=e['sourceLocator'].split('!');geo,n=rest.split('#/features/');z=zipfile.ZipFile(io.BytesIO(zipfile.ZipFile(io.BytesIO(b)).read(member)));g=json.loads(z.read(geo));f=g['features'][int(n)];assert f['geometry']['coordinates']==[u['coordinate']['lng'],u['coordinate']['lat']]
   feature={'facilityId':u['facilityId'],'sourceLocator':e['sourceLocator'],'properties':f['properties'],'geometry':f['geometry'],'geojsonCrs':g.get('crs'),'coordinateMatches':True};p05.append(feature);primary['feature']=feature
   role='P05 named public-building feature, JGD2011 longitude/latitude in GeoJSON'
  else:
   raw=urllib.parse.unquote(html.unescape(b.decode('utf-8',errors='replace')));nums={float(x) for x in re.findall(r'(?<![\d.])\d{2,3}\.\d+',raw)};assert u['coordinate']['lat'] in nums and u['coordinate']['lng'] in nums
   pos=raw.find(str(u['coordinate']['lat']));context=raw[max(0,pos-100):pos+300];context=re.sub(r'AIza[\w-]+','[public-map-key-omitted]',context)
   primary['coordinateContext']=context
   loc=e['sourceLocator'];role=('named facility GeoCoordinates' if 'GeoCoordinates' in loc else 'facility-level og location metadata' if 'og:' in loc else 'named marker / marker position' if any(x in loc for x in ['marker','Marker','GDMap','initlat','initMap','setGoogleMap']) else 'explicit facility destination/place link')
  src=[]
  for s in support[(region,i)]['sources']:
   sp=s['path'];evidencefiles[sp]=sha(sp);src.append({'sourceUrl':s['url'],'snapshotPath':sp,'snapshotSHA256':evidencefiles[sp],'excerpts':excerpts(s['text'],name,address)})
  deferred=(cs_defer if region=='chugoku-shikoku' else s_defer);notes=(cs_notes if region=='chugoku-shikoku' else s_notes)
  status='deferred' if i in deferred else 'correction-required' if region=='chugoku-shikoku' and i==7 else 'accepted'
  reason=deferred.get(i) or notes.get(i) or ('P05施設名・所在地と保存された現在の公式配布/施設案内が対応。同住所の他施設を選ばず、当該公共施設の建物代表点として採用。' if 'P05' in e['sourceUrl'] else '原典中の当該施設名・所在地と配布施設を照合。施設に結び付く明示地点であり、室内窓口や階の精密位置を要求せず建物代表点として採用。')
  reviews.append({'facilityId':u['facilityId'],'region':region,'updateIndex':i,'name':name,'address':address,'status':status,'coordinate':u['coordinate'],'pointRole':role,'reason':reason,'primaryEvidence':primary,'identityEvidence':src,'recordCorrectionRequired':status=='correction-required','currentnessScope':'2026-11-05に保存・確認された原典の範囲。取得時刻不明原本は現時刻取得とみなさない。','precision':'building representative; no indoor counter accuracy; no viewport/lid/address-geocode substitution'})
# The 24 metadata-gap records: provenance is reconstructed only as URL/bytes association.
gaps=[]
for m in sm:
 if m.get('fetchedAt') is not None:continue
 p=Path(m['snapshotPath']);inspection=p.with_suffix('.inspection.txt');line=inspection.read_text().splitlines()[0];assert line=='URL '+m['url'];assert p.stem==hashlib.sha256(m['url'].encode()).hexdigest()[:20];assert sha(p)==m['snapshotSHA256'];evidencefiles[str(p)]=sha(p);evidencefiles[str(inspection)]=sha(inspection)
 affected=[r['facilityId'] for r in reviews if r['primaryEvidence']['snapshotPath']==str(p)]
 gaps.append({'sourceUrl':m['url'],'snapshotPath':str(p),'snapshotSHA256':sha(p),'bytes':p.stat().st_size,'inspectionPath':str(inspection),'inspectionSHA256':sha(inspection),'inspectionFirstLine':line,'urlDerivedFilenameMatches':True,'contentHashMatches':True,'fetchedAt':None,'snapshotSavedAtRecorded':m.get('snapshotSavedAt'),'snapshotSavedAtIsAcquisitionTime':False,'affectedPrimaryUpdateFacilityIds':affected,'evaluation':'URL/bytesの監査可能な関連は成立。HTTP状態・取得日時の証明は欠落したまま。施設同定は別途原典内容で判定し、欠落のみでは却下しない。'})
assert len(gaps)==24 and sum(len(g['affectedPrimaryUpdateFacilityIds']) for g in gaps)==15
write('metadata-gap-chain.json',gaps);write('p05-records.json',p05);write('snapshot-path-patches.json',pathpatch)
# Exact existing-record changes only, no invented replacement coordinate.
oldid='facility:cs-424799903d1a9c1291';station='facility:ws-811926f2652d6640dc'
patches=[]
for fid,field,new in [(oldid,'address','岡山県倉敷市玉島3丁目8-25'),(oldid,'phone','086-522-0151'),(station,'phone','086-526-8446')]:
 patches.append({'target':parentPath,'collection':'places','match':{'id':fid},'field':field,'old':places[fid][field],'new':new,'reason':'倉敷市公式配布案内の西爽亭と休館日代替の新倉敷駅観光案内所を独立施設として整理。座標や配布関係を変更しない。'})
# Preserve specifically requested unresolveds; they are outside the 156 update partition.
preserved=[]
for u in inputs['chugoku-shikoku']['unresolved']:
 a=audit['chugoku-shikoku'][u['facilityId']]
 if any(x in a['name'] for x in ['津和野','長船支所','東広島市観光案内所','神楽']):preserved.append({'facilityId':u['facilityId'],'name':a['name'],'address':a['address'],'status':'deferred','reason':u['reason'],'attempts':u['attempts'],'scope':'original-unresolved; excluded from 156-update counts'})
write('preserved-unresolved.json',preserved)
inputpaths=['data/national/location-updates/'+r+'.json' for r in inputs]+[parentPath,'data/evidence/national/locations-chugoku-shikoku/facility-audit.json','data/evidence/national/locations-kanto-north-saitama/decisions.json','data/evidence/national/locations-kanto-north-saitama/manifest.json','data/evidence/national/locations-chugoku-shikoku/reused-manifest.json']
report={'schema':1,'reviewType':'independent-location-semantics','reviewedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actorType':'ai','inputs':[{'path':p,'sha256':sha(p)} for p in inputpaths],'policy':{'accepted':'名称・現在住所と明示地点の対象建物の対応に十分な保存根拠がある。CSの共通パス修正は統合前必須。','deferred':'根拠不足を施設別に明記。代替座標は推定しない。','correction-required':'座標自体ではなく現施設記録の修正が先行。exact old/newを提案する。','acquisitionTime':'missing stays null; checkedAt / mtime is not fetchedAt','prohibited':['viewport','lid coordinates','raw address geocode','old site ID reused for relocation','same-address different-building substitution'],'sourcePriority':'saved original bytes, independent name/address/building reading; hashes prove integrity only'},'summary':{region:{status:sum(r['region']==region and r['status']==status for r in reviews) for status in ['accepted','deferred','correction-required']} for region in inputs},'acceptedFacilityIds':[r['facilityId'] for r in reviews if r['status']=='accepted'],'deferredFacilityIds':[r['facilityId'] for r in reviews if r['status']=='deferred'],'correctionRequiredFacilityIds':[r['facilityId'] for r in reviews if r['status']=='correction-required'],'reviews':reviews,'exactCorrections':patches,'snapshotPathNormalization':{'requiredBeforeIntegration':True,'count':len(pathpatch),'exactPatches':str(OUT/'snapshot-path-patches.json'),'policy':'固定文字列を盲目的に削除せず、repo root配下にresolveできることを確認しrelative_to(root)を適用。変換先bytesのSHA256が元値と一致することを検査。sourceUrl/sourceLocator/hash/checkedAtは変更しない。補助audit/manifestの絶対パスも同じ写像で追跡可能にする。原本の移動・再取得・書換えは不要。'},'licenseAndCrsReview':{'source':'国土交通省 国土数値情報（市町村役場等及び公的集会施設データ）P05-2022','sourceUrl':'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05.html','license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','crs':'JGD2011 / (B,L); GeoJSON coordinates are [longitude,latitude]','transformation':'元の数値をそのまま保持。WGS84へ厳密変換した、測量した、精度改善したとの主張はしない。','pointMeaning':'製品仕様書5.1にJGD2011、位置正確度の尺度に該当施設建物外周内との照合を記載。2022年版を現在の公式施設名・所在地と照合して採用。','geocodeDistinction':'原典作成方法には街区位置参照情報によるジオコーディング後、地図で位置整備した工程がある。本レビューは住所からの新規ジオコードではなく、建物位置検査仕様を持つ公的featureの採用。READMEの「住所ジオコーディング不使用」は今回の処理に限定して読む。','attribution':'国土交通省「国土数値情報（市町村役場等及び公的集会施設データ）P05-2022」（CC BY 4.0）を加工（該当feature抽出・facilityId対応付け）。国土交通省による承認を意味しない。','reviewedUpdateCount':len(p05),'uniqueFeatureCount':len({p['sourceLocator'] for p in p05}),'featureEvidence':str(OUT/'p05-records.json'),'savedReferences':['data/evidence/national/official-facility-index/p05.html','data/evidence/national/official-facility-index/p05-spec.txt','data/evidence/national/official-facility-index/p05-license.html']},'metadataGapReview':{'missingOriginalCount':24,'affectedPrimaryUpdateCount':15,'evidence':str(OUT/'metadata-gap-chain.json'),'result':'全24件でinspection URL、URL由来filename、保存bytes hashが一致。取得時刻・HTTPメタデータは復元しない。5支社は別理由（建物未同定）で保留。'},'preservedUnresolved':preserved,'documentCodeDiscrepancies':[{'document':'data/evidence/national/locations-chugoku-shikoku/README.md','code':'tools/national/assemble.py:repo_path / evidence','finding':'追補を親統合用と説明する一方、101件のsnapshotPathは絶対パス。assemble.repo_pathは絶対パスを拒否する。CS validate.pyはPathを直接読み絶対パスを許すため、ローカルvalidate成功は統合可能性を保証しない。','resolution':'コードに従いrepo相対パスへ変換するexact patch 101件を提案。元成果物は未変更。'}],'validationEvidence':str(OUT/'validation.json'),'limitations':['保存原本に基づくAIレビューであり現地実測・人手確認ではない。','acceptedは配布関係や在庫・営業時間の更新承認ではない。','deferredは施設不存在や座標誤りの断定ではなく、要求された建物精度を裏付ける証拠不足。','原本にない取得日時・座標・棟対応を推測していない。']}
Path('data/national/reviews/chugoku-saitama-locations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
for p in report['licenseAndCrsReview']['savedReferences']:evidencefiles[p]=sha(p)
write('evidence-integrity.json',[{'path':p,'sha256':h} for p,h in sorted(evidencefiles.items())])
print(json.dumps(report['summary'],ensure_ascii=False));print('P05',len(p05),'unique',report['licenseAndCrsReview']['uniqueFeatureCount'],'path patches',len(pathpatch),'protected unresolved',len(preserved))
