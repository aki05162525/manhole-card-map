"""Write review artifacts only. Does not modify candidates, baseline, manifest or production code."""
from pathlib import Path
import json,re,hashlib,html,datetime
R=Path('data/evidence/issue5/review-chubu');target='data/national/issue5/chubu.json';d=json.loads(Path(target).read_text());v=json.loads((R/'verification.json').read_text())
def dump(p,x):Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
sources=[]
for p in R.glob('fetch*-records.json'):sources+=json.loads(p.read_text())
byname={Path(s['snapshotPath']).name:s for s in sources if s.get('snapshotPath')}
def ev(n,loc):
 s=byname[n];return {k:s[k] for k in ['sourceUrl','snapshotPath','snapshotSHA256','fetchedAt']}|{'sourceLocator':loc,'checkedAt':'2026-11-05','actorType':'ai'}
notes=[
 ('accepted','現行配布原本の2階20番窓口と吉田西太田1934がP05燕市役所と一致。2026年更新の市採用情報が2013年に現在の庁舎へ移転したことを明示するため、2022年以後の別庁舎へ読み替えず同じ建物を特定できる。','tsubame-current-building.html','2013(平成25)年に現在の燕市庁舎に移転','追加調査不要。室内位置・入口精度は承認しない。'),
 ('accepted','同じ配布原本が第5弾の休日窓口を市役所1階夜間休日受付と明示。2013年からの現庁舎継続使用資料とP05名称住所を照合。平日窓口から住所一致だけで横展開したものではない。','tsubame-current-building.html','2013(平成25)年に現在の燕市庁舎に移転','追加調査不要。休日の関係状態・期限は既存値を維持。'),
 ('deferred','現行配布案内と2026年施設詳細は荒川地区公民館・羽ヶ榎104-25で一致し、P05数値も一致。ただし今回得た現行施設ページは建築年・2022年からの同一棟継続使用を示さない。移転記載がないことだけを否定証明に使わない。','arakawa-facility.html','所在地および施設利用案内','2022年と現行の棟配置が対応する施設台帳・改修履歴・建物図を追加。数値訂正は未提示。'),
 ('deferred','Turkey!カードの配布先と施設案内は上山田温泉3-1-1の上山田文化会館で一致。文化課の現行施設ページも得たが、2022年棟との連続性を示す施設計画PDFの直接取得は404。検索要約の1979年等を原本取得成功と扱わない。','chikuma-building.html','施設の一覧 上山田文化会館','現行の個別施設計画または建築・改修履歴の原本と配置図を照合し、P05棟との継続性を確認。'),
 ('accepted','第17弾代替窓口を現行配布原本で確認。2026年庁舎案内図1階の上下水道課は同一の庁舎平面に入る。2026年9月修正の新庁舎計画は供用開始を2028年12月予定と明示し、現庁舎解体を新庁舎供用後に予定。将来新庁舎の位置へ2022年座標を転用しないという条件で現庁舎代表点を承認。','oyabe-layout.html','2026-04-01更新、1階図の上下水道課','将来移転の確認課題を記録するが、relations.reviewUntil等は今回変更しない。'),
 ('deferred','配布原本は本庁舎1階総合案内を明示し水道部庁舎と区別している。一方、現行フロア図は本庁舎別館も区別する。P05「沼津市役所」という名称だけで本庁舎側の棟まで確定せず、旧住所featureの採用撤回とは独立に保留。','numazu-layout.html','本庁舎1階、本庁舎別館','P05点が本庁舎外周内にあることを確認できる棟別配置図/GISと2022年からの継続使用資料を追加。'),
 ('deferred','現行配布原本は福田400・福田支所2階を明示。市の現行施設ページも福田支所の住所と階構成を示す。ただし2022年建物と現行建物の同一性を立証する建築・改修履歴までは得ていない。観光協会IDの住所featureとは別件。','iwata-building.html','所在地・フロアマップ','建築年付き現行施設台帳などで2022年の福田支所棟が現存し配布課が入居することを確認。'),
 ('deferred','現行配布原本は吉田町役場2階上下水道課と住吉87を明示。庁舎マップは現行建物の案内であるが2022年以降の建替え・別棟を解決する資料までは得ていない。','yoshida-layout.html','庁舎マップ各階案内','2022年と現行の庁舎を結ぶ建築年・改修履歴付き施設台帳と配布課の入居を確認。')]
reviews=[]
for i,(u,n) in enumerate(zip(d['updates'],notes)):
 decision,reason,source,locator,needed=n
 reviews.append({'facilityId':u['facilityId'],'name':u['identityReview']['name'],'decision':decision,'coordinate':u['coordinate'],'scope':'building' if decision=='accepted' else 'not-approved','reason':reason,'originalRecordVerification':v['coordinates'][i],'currentDistributionEvidence':[ev(Path(e['snapshotPath']).name,e['sourceLocator']) for e in u['supportingEvidence']],'additionalEvidence':[ev(source,locator)],'requiredEvidence':needed,'coordinateCorrection':None,'relationAction':'unchanged'})
reviews[4]['additionalEvidence'] += [ev('oyabe-1f.png','1階右上の上下水道課5番窓口を画像目視'),ev('oyabe-revised.html','3事業スケジュール：新庁舎供用開始2028年12月見込み'),ev('oyabe-summary.pdf','実施設計概要版：新庁舎供用後の現庁舎解体工程')]
# Read original embedded responses, not the old reviewer conclusions.
oldReview=json.loads(Path('data/national/reviews/chubu-west-locations.json').read_text());originals=[]
for r in oldReview['reviews']:
 if r['facilityId'] not in {c['facilityId'] for c in d['corrections'][:5]}:continue
 for e in r.get('supportingEvidence',[]):
  p=e.get('source',{}).get('snapshotPath')
  if not p:continue
  s=Path(p).read_text();m=re.search(r'initEmbed\(',s)
  if not m:continue
  a,_=json.JSONDecoder().raw_decode(s[m.end():]);assert sha(p)==e['source']['snapshotSHA256']
  originals.append({'facilityId':r['facilityId'],'snapshotPath':p,'snapshotSHA256':sha(p),'sourceLocator':'initEmbed[21][3][0], initEmbed[21][3][12]','record':a[21][3][0],'category':a[21][3][12]})
sado=json.loads(Path(d['corrections'][5]['old']['snapshotPath']).read_text());sadoRecord=next(f for f in sado['features'] if f['attributes']['OBJECTID']==23)
originals.append({'facilityIds':[c['facilityId'] for c in d['corrections'][5:7]],'record':sadoRecord,'finding':'名称佐渡市役所・電話0259-63-3111。金井市民センター0259-63-3843とは異なる。棟識別属性なし。'})
s=Path(d['corrections'][7]['old']['snapshotPath']).read_text();links=[html.unescape(u) for u in re.findall(r'href=[\"\x27]([^\"\x27]+)',s) if 'google.com/maps/place' in u]
originals.append({'facilityId':d['corrections'][7]['facilityId'],'links':links,'finding':'原本本文は管理棟2階事務室。リンクの名称は新潟浄化センターで、管理棟識別を含まない。全敷地の厳密なgeometryを取得したとの主張ではない。'})
dump(R/'original-correction-records.json',originals);dump(R/'original-corrections.json',d['corrections'])
fixes=[]
def fix(path,old,new,reason,targetFile=target):fixes.append(dict(targetFile=targetFile,operation='replace',path=path,old=old,new=new,reason=reason,applyTo='新規統合用コピーのみ。元候補・固定台帳を変更しない。'))
for i,u in enumerate(d['updates']):
 old=u['evidence']['verificationMethod'];new=old.replace('住所ジオコード・viewport・蓋座標ではない。','本追補では住所ジオコーディングを行わず、P05の施設Pointを抽出した。P05自体の作成工程には住所ジオコーディングが含まれる。viewport・蓋座標ではない。')
 fix(f'/updates/{i}/evidence/verificationMethod',old,new,'カタログの作成方法との混同を防ぐ限定表現。座標変更なし。')
 for k,method in [('catalogEvidence','AIがP05カタログの基準年月・座標系・点形状・使用許諾条件・作成方法を照合。建物入居窓口の証拠ではない。'),('termsEvidence','AIが2026-03-23施行PDL1.0と出典・加工表示義務、適用除外の記載を照合。施設同定の証拠ではない。')]:
  fix(f'/updates/{i}/datasetEvidence/{k}/verificationMethod',u['datasetEvidence'][k]['verificationMethod'],method,'規約/カタログへの共通の施設名・入居建物照合という誤った方法記述を訂正。')
fix('/updates/4/identityReview/relocation',d['updates'][4]['identityReview']['relocation'],'現行庁舎1階に上下水道課。2026年9月修正の新庁舎計画では供用開始2028年12月予定、現庁舎解体は新庁舎供用後。2022年P05点は現庁舎に限定し、新庁舎へ継承しない。','新庁舎計画の原典を追加したため説明を具体化。関係期限は変更しない。')
c=d['corrections'][6]
for k in ['reason']:
 fix('/corrections/6/'+k,c[k],c[k].replace('GIS OBJECTID=23は佐渡市役所全体。','GIS OBJECTID=23の施設名は「佐渡市役所」で棟識別属性はない。'),'点featureから「全体」の幾何学的scopeを断定しない。')
fix('/corrections/6/new/verificationMethod',c['new']['verificationMethod'],c['new']['verificationMethod'].replace('GIS OBJECTID=23は佐渡市役所全体。','GIS OBJECTID=23の施設名は「佐渡市役所」で棟識別属性はない。'),'元の誤同定を撤回する趣旨は支持するが施設全体との断定は除去。')
# Exact separate address proposal; neither relations nor baseline is changed.
address={'targetFile':'data/work/issue5-baseline/ledger.json','selector':{'id':d['corrections'][4]['facilityId'],'collection':'places'},'field':'address','old':'愛知県岡崎市八帖町字往還通52','new':'愛知県岡崎市八丁町52番地','applyTo':'新規統合用コピーのみ。固定baselineは変更禁止。','coordinateAction':'保留維持'}
ledger=json.loads(Path('data/work/issue5-baseline/ledger.json').read_text());assert next(p for p in ledger['places'] if p['id']==address['selector']['id'])['address']==address['old']
correctionReviews=[{'facilityId':c['facilityId'],'decision':'accepted' if i!=6 else 'correction-required','reason':c['reason'],'exactOldMatch':True,'exactProposal':c,'reviewerNote':('全体scopeの断定をexactCorrectionsで修正後に採用。' if i==6 else '旧位置の採用撤回を支持。新座標の承認を意味しない。')} for i,c in enumerate(d['corrections'])]
result={'schema':1,'region':'chubu','checkedAt':'2026-11-05','actorType':'ai','reviewType':'independent-primary-source-building-review','candidateFile':target,'summary':{'updates':8,'accepted':3,'deferred':5,'correction-required':0,'historicalCorrectionsReviewed':8},'decisionIds':{key:[r['facilityId'] for r in reviews if r['decision']==key] for key in ['accepted','deferred','correction-required']},'reviews':reviews,'correctionReviews':correctionReviews,'exactCorrections':fixes,'additionalAddressCorrection':address,'evidenceEditorialPolicy':'exactCorrectionsは根拠説明・監査方法の訂正。acceptedは追加した原典を含む建物座標判断であり、元候補全文の無修正承認ではない。','rights':{'decision':'P05利用条件・出典加工表示は確認','sourceEvidence':[ev('p05-catalog.html','基準年月・使用許諾条件・作成方法'),ev('p05-terms.html','2026-03-23施行、PDL1.0、1.1出典・加工表示')],'finding':'候補のdatasetEvidence.attributionとREADMEは出典URL・データ名・加工を表示し、国の作成物との誤表示を避けている。支援HTML全体へのPDLライセンス適用は主張しない。assemblerがこの監査メタデータを台帳へ転記することはないため統合時にも出典文書を保持する。'},'goEvidenceCompatibility':{'decision':'pass','strictFields':v['primaryEvidenceFields'],'decodeProbe':v['goStrictDecode'],'notes':'supportingEvidence内fetchedAt等は主evidenceに混ぜない。apply_locationsはcoordinate/evidenceのみ転記しdatasetEvidence, identityReview, supportingEvidence, scopeは台帳へ渡さない。'},'documentCodeDiscrepancies':[],'documentCodeReview':'候補の主evidenceは7フィールドで実装と一致。今回読んだREADME・build.py・validate.py・assembler・Go厳密decodeに実際の文書/コード不一致は見つからなかった。READMEの再検証コマンドは候補成果物を書き直すため本レビューでは実行せず、独立した一時適用で検証した。','unresolvedScope':'既存130件は再調査済みに昇格しない。今回のdeferred5件も採用しない。3件を採用する場合、元の対象138件中残る135件が未承認。','relations':'固定ledgerのrelations全項目（状態・条件・期限含む）不変を一時適用で検証。','verificationFile':str(R/'verification.json'),'inputHashes':v['inputHashes']}
dump('data/national/issue5/reviews/chubu.json',result)
for p,h in v['inputHashes'].items():assert sha(p)==h,p
print(result['summary']);print('exact evidence edits',len(fixes))
