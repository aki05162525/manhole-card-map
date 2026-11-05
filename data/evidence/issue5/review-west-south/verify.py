import json, hashlib, zipfile, io, re, copy, subprocess
from pathlib import Path
R=Path('data/evidence/issue5/review-west-south'); P=Path('data/evidence/issue5/west-south'); C=Path('data/national/issue5/west-south.json')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(p,x):Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
x=read(C); proof=read(P/'coordinate-proof.json'); ledger=read('data/work/issue5-baseline/ledger.json'); full=read('data/work/issue5-baseline/full.json'); places={p['id']:p for p in ledger['places']}
code=Path('cmd/builddata/ledger.go').read_text(); struct=re.search(r'type Evidence struct \{.*?\n\}',code,re.S).group(); keys=re.findall(r'json:"([^"]+)"',struct)
inputs=[C,P/'README.md',P/'coordinate-proof.json',Path('data/work/issue5-baseline/ledger.json'),Path('data/work/issue5-baseline/full.json'),Path('cmd/builddata/ledger.go'),Path('data/evidence/issue5/chubu/p05-terms.html')]; hashes={str(p):sha(p) for p in inputs}
meta=read('data/evidence/issue5/chubu/p05-terms.source.json');assert sha(meta['snapshotPath'])==meta['snapshotSHA256']
(R/'current-terms.html').write_bytes(Path(meta['snapshotPath']).read_bytes());meta['reusedFrom']=meta['snapshotPath'];meta['snapshotPath']=str(R/'current-terms.html');write(R/'current-terms.source.json',meta)
z=zipfile.ZipFile(x['updates'][0]['evidence']['snapshotPath']); reviews=[]; checks=[]
for i,(u,p) in enumerate(zip(x['updates'],proof)):
 assert u['facilityId']==p['facilityId']; e=u['evidence'];assert set(e)==set(keys);assert sha(e['snapshotPath'])==e['snapshotSHA256']
 outer,inner=p['sourceLocator'].split('!'); member,frag=inner.split('#'); b=zipfile.ZipFile(io.BytesIO(z.read(outer))).read(member);geo=json.loads(b);f=geo['features'][p['featureIndex']]
 assert b==Path(p['memberPath']).read_bytes();assert hashlib.sha256(b).hexdigest()==p['memberSHA256'];assert f==p['rawFeature'];assert f['geometry']['coordinates']==[u['coordinate']['lng'],u['coordinate']['lat']]
 for k in ['distributionEvidence','buildingEvidence']:
  assert sha(p[k]['snapshotPath'])==p[k]['snapshotSHA256']
 rel=[r for r in ledger['relations'] if r['placeId']==u['facilityId']]
 reviews.append(dict(facilityId=u['facilityId'],name=places[u['facilityId']]['name'],decision='correction-required' if i==0 else 'accepted',coordinateDecision='accepted',coordinate=u['coordinate'],scope='building',reason=p['buildingIdentification']+(' baselineのhours/conditionに公式休館日不一致が表示されないため、下記exact訂正が必要。' if i==0 else ''),evidence=e,buildingEvidence={k:{a:b for a,b in p[k].items() if a in keys} for k in ['distributionEvidence','buildingEvidence']},baselineRelations=rel,relocationReview=p['relocationReview'],crs=geo.get('crs'),rawFeature=f,sourceLocator=p['sourceLocator']))
 checks.append(dict(facilityId=u['facilityId'],zipMemberMatches=True,rawCoordinateMatches=True,evidenceHashMatches=True,strictEvidenceFields=True))
# Exact original correction values are checked against their actual target, without writing there.
corrections=[]
for i,c in enumerate(x['corrections']):
 c=copy.deepcopy(c)
 if i<2:assert places[c['facilityId']]['name']==c['old']
 else:
  prior=read(c['targetPath']);assert c['old'] in Path(c['targetPath']).read_text()
 c['evidence']={k:v for k,v in c['evidence'].items() if k in keys};c['reviewDecision']='accepted';corrections.append(c)
r=next(r for r in ledger['relations'] if r['placeId']==reviews[0]['facilityId'])
hours=['9:00～17:00。配布ページは12/29～12/31休みと記載。施設ページは月曜（祝日は翌日）と12/29～1/3休館と記載し、公式情報が不一致。月曜（祝日は翌日）・1/1～1/3の配布可否は訪問前に神埼情報館へ確認。']
for field,new in [('hours',hours),('condition','公式配布ページと施設ページで休館日が不一致。月曜（祝日は翌日）・1/1～1/3の配布可否は未確定。神埼情報館（0952-37-1700）へ訪問前確認。')]:
 corrections.append(dict(facilityId=r['placeId'],targetPath='data/work/issue5-baseline/ledger.json',selector={'cardId':r['cardId'],'placeId':r['placeId']},field=field,old=r[field],new=new,reason='配布ページの転記自体は正しいが、施設ページとの相違を確定情報に見せない。月曜休配とも年始配布可とも断定しない。status=activeと座標は維持。',evidence=reviews[0]['buildingEvidence']['distributionEvidence'],supportingEvidence=reviews[0]['buildingEvidence']['buildingEvidence']))
license_text='P05個別ページの使用許諾条件は「オープンデータ（CC_BY_4.0）」であり、この個別指定に基づく。保存したagreement_01.htmlは2020年制定の旧政府標準規約準拠版。現行agreement.htmlは2026-03-23施行のPDL1.0で、権利表記の記載がない限り適用する旨と個別条件への留保がある。P05のCC BY 4.0指定をPDLのみへ置換しない。出典：国土交通省「国土数値情報（市町村役場等及び公的集会施設）2022年版」https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-2022.html（2026-11-05取得）。原ZIPから対象施設の座標を抽出しlat/lngへ転記した加工物で、国土交通省による作成・承認を意味しない。公式自治体HTMLへこのライセンスを拡張しない。'
docpatch=[{'targetPath':str(P/'README.md'),'operation':'replace-exact','old':'CC BY 4.0。原ZIP・利用条件・製品仕様書・測地系参考資料の原本とhashを保存した。','new':license_text+' 原ZIP・利用条件・製品仕様書・測地系参考資料の原本とhashを保存した。'}]
docpatch.append({'targetPath':str(P/'README.md'),'operation':'replace-exact','old':'今回の調査で新たに発見したドキュメントと実装コードの食い違いはない（アプリ実装全体の監査は対象外）。','new':'独立レビューで訂正提案3件のevidence.fetchedAtがGo Evidence非対応と判明。統合用Evidenceは実装の7フィールドに限定し、取得日時は補助記録に保持する。位置候補6件のEvidenceは適合。アプリ実装全体の監査は対象外。'})
fr=next(t for t in full['relations'] if t['placeId']==r['placeId'] and t['cardId']==r['cardId'])
assert fr['hours']==r['hours'] and fr['condition']==r['condition'] and fr['status']==r['status']
for a in docpatch:assert a['old'] in Path(a['targetPath']).read_text()
report=dict(schema=1,region='west-south',checkedAt='2026-11-05',actorType='ai',reviewMethod='保存公式原本を独立再読。P05 ZIPを再展開して原値とCRSを照合。一般利用規約2 URLのみWebでも確認。自治体ページの再取得・現地測量ではない。',summary={'accepted':5,'deferred':0,'correction-required':1,'coordinateAccepted':6,'unresolvedNotNewlyInvestigated':158},reviews=reviews,exactCorrections=corrections,documentationCorrections=docpatch,licenseReview={'finding':license_text,'sources':[meta, next(e for e in read(P/'reused-snapshots.json') if e['sourceUrl'].endswith('agreement_01.html')),next(e for e in read(P/'reused-snapshots.json') if e['sourceUrl'].endswith('KsjTmplt-P05-2022.html'))]},kanzakiFullBaselineCheck={'hours':fr['hours'],'condition':fr['condition'],'status':fr['status'],'review':fr['review'],'finding':'fullにも休館日不一致の注記なし。review=verifiedは衝突解消の証明ではない。fixed baselineへ直接適用せず、親統合入力を訂正してfullを再生成する。'},evidenceSchemaReview={'source':'cmd/builddata/ledger.go:17, decodeLedger:86, validateEvidence:116','allowedFields':keys,'updates':'6/6 exact field match','corrections':'元3件すべてevidence.fetchedAtが非対応。exactCorrectionsでは7フィールドへ限定。元取得時刻はfetches.jsonに残る。','supplemental':'coordinate-proof等の取得メタデータは補助記録として維持可能だが、Ledger Evidenceへ丸ごと転記不可。unresolvedは統合対象でなく全件の意味レビューは未実施。'},documentCodeDiscrepancies=[{'document':str(P/'README.md'),'claim':'今回の調査で新たに発見したドキュメントと実装コードの食い違いはない','finding':'訂正提案3件のEvidenceはfetchedAtを含み、Go Evidenceの7フィールド制約に適合しない。READMEの不一致なしという説明には、補助記録と統合用Evidenceの区別・削除処理の明記が必要。'}],limitations=['2022-04基準の建物代表点。入口・室内窓口・階の座標ではない。','現行保存本文に移転告知は見当たらないが、同住所の建替え不存在まで保証しない。','JGD2011/EPSG:6668原値を保持。WGS84への変換済み・epoch補正済みとは主張しない。','太宰府Cの臨時移転終了後復帰や通常代替関係を追加しない。','158保留全件の新規調査ではない。'])
write('data/national/issue5/reviews/west-south.json',report)
write(R/'validation.json',{'checks':checks,'inputHashes':hashes,'exactCorrectionsOldValuesMatch':True,'currentTermsSavedHashMatches':True,'readOnlyInputsUnchanged':all(sha(p)==h for p,h in hashes.items())})
# Compile a probe from the exact current Evidence struct; do not modify application code.
go='package main\nimport("bytes";"encoding/json";"fmt";"os")\n'+struct+'\nfunc main(){ b,_:=os.ReadFile("data/national/issue5/west-south.json");var x struct{ Updates []struct{Evidence json.RawMessage}; Corrections []struct{Evidence json.RawMessage} };if err:=json.Unmarshal(b,&x);err!=nil{panic(err)}; for i,u:=range append(x.Updates,x.Corrections...){d:=json.NewDecoder(bytes.NewReader(u.Evidence));d.DisallowUnknownFields();var e Evidence;err:=d.Decode(&e);fmt.Printf("%d: %v\\n",i,err);if (i<6)!=(err==nil){panic("unexpected schema result")}}}\n'
(R/'evidence-probe.go').write_text(go)
print(json.dumps(report['summary']));print('inputs unchanged:',all(sha(p)==h for p,h in hashes.items()))
