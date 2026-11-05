"""Build review artifacts only. Does not apply proposed corrections."""
import hashlib,json,pathlib,re
R=pathlib.Path.cwd();D=R/'data/evidence/issue7/review-hokkaido';S=R/'data/evidence/issue7/hokkaido';out=R/'data/national/issue7/reviews/hokkaido.json'
def read(p):return json.loads(pathlib.Path(p).read_text())
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def write(p,d):pathlib.Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
source=read(R/'data/national/issue7/hokkaido.json');audit=read(S/'candidate-audit.json');nums={x['facilityId']:x for x in read(D/'numeric-checks.json')};updates={x['facilityId']:x for x in source['updates']};pending={x['facilityId']:x for x in source['unresolved']}
old='現行第3.0版カタログ・PDL1.0規約を確認。'
new='P05-2022個別ページのCC_BY_4.0指定と出典・加工表示を保持する（https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-2022.html、https://creativecommons.org/licenses/by/4.0/）。現行第3.0版カタログと一般PDL1.0規約も確認したが、個別CC BY指定を置き換える根拠とはしない。'
corrections=[]
for i,u in enumerate(source['updates']):
 if nums[u['facilityId']]['method']=='P05-22':
  v=u['evidence']['verificationMethod'];assert old in v
  corrections.append({'id':'evidence-'+u['facilityId'],'targetPath':'data/national/issue7/hokkaido.json','jsonPointer':f'/updates/{i}/evidence/verificationMethod','facilityId':u['facilityId'],'old':v,'new':v.replace(old,new),'reason':'個別CC_BY_4.0の記録を落とさず、一般PDLとの区別を明示する。座標数値・scope・checkedAtは訂正不要。','applied':False})
p=read(S/'policy.json');oldpolicy=p['P05']['description'];newpolicy='P05-2022個別ページはオープンデータ（CC_BY_4.0）と指定し、agreement_01.htmlはCC BY 4.0による利用を認める。この個別指定、出典と加工表示、ライセンス参照を保持する。現行第3.0版カタログと一般規約のPDL1.0表示は別に記録し、個別指定の取消しとは解釈しない。2022年4月基準、JGD2011。旧H22/H25/H26の個別制限に新P05の条件を付け替えない。'
corrections.append({'id':'policy-P05','targetPath':'data/evidence/issue7/hokkaido/policy.json','jsonPointer':'/P05/description','old':oldpolicy,'new':newpolicy,'applied':False})
code=(S/'build.py').read_text();line=next(x for x in code.splitlines() if old in x)
corrections.append({'id':'generator-P05','targetPath':'data/evidence/issue7/hokkaido/build.py','matchType':'exact-line','old':line,'new':line.replace(old,new),'applied':False,'reason':'再生成時に訂正を消さない。実ファイルは編集しない。'})
text=(S/'README.md').read_text();line=next(x for x in text.splitlines() if x.startswith('5. issue5 north'))
corrections.append({'id':'readme-P05','targetPath':'data/evidence/issue7/hokkaido/README.md','matchType':'exact-line','old':line,'new':'5. issue5 north README・`build.py` のCC BY 4.0表記はP05-2022個別ページのCC_BY_4.0指定に根拠があり、現行一般PDL1.0の存在だけでは誤りとはいえない。今回は個別CC BY指定を保持し、現行第3.0版カタログ・一般PDLとの適用範囲を分けて記録する。','applied':False})
discrepancies=[
 {'id':'historical-1','kind':'documentation-overclaim','finding':'旧locations READMEは現名称住所の照合を説明する一方、decide.pyの旧H22/H25/H26データ処理は個別利用条件・CRSを記録せず採用する。公式施設索引の条件確認方針を満たす実装ではない。','paths':['data/evidence/national/locations-north-hokkaido/README.md','data/evidence/national/locations-north-hokkaido/decide.py','data/evidence/national/official-facility-index/README.md'],'action':'旧点を承認済みとして引き継がず、今回の原典・条件で判断。旧成果は変更しない。'},
 {'id':'historical-2','kind':'documentation-overclaim','finding':'旧READMEの建物内複数窓口の説明に対し、decide.pyは登別市役所総称点を第2庁舎にも、苫小牧市役所総称点を北庁舎にも候補化している。現配布本文は棟を区別。','action':'登別本庁舎だけ採用、第2庁舎・苫小牧北庁舎は保留。'},
 {'id':'historical-3','kind':'generated-explanation-mismatch','finding':'旧decide.pyは釧路と留萌の共通verificationMethodに「るもいプラザ公式施設ページ」を含める。釧路の出典連鎖の個別説明になっていない。','action':'釧路へ留萌根拠を流用しない。留萌は今回の市HTML q原値を使用。'},
 {'id':'historical-4','kind':'already-corrected-in-baseline','finding':'千歳の旧成果は経営管理課、現本文は総務課。固定baselineの施設nameは既に総務課総務係へ訂正済み。古いsourceLocatorは過去の取得時説明として残る。','action':'名称訂正は再提出しない。baseline・過去証拠は変更しない。'},
 {'id':'P05-individual-vs-general','kind':'current-review-documentation-correction','finding':'元README第5項とpolicy.jsonのPDLに基づく説明は、P05-2022個別ページのCC_BY_4.0を適用根拠として保持していない。旧issue5のCC BY表記自体は原典と整合するため、一般PDL登場だけでコード誤りとはしない。','action':'exact old/new訂正案に従い、個別指定と現行一般規約を併記。'},
 {'id':'Go-date-validation-gap','kind':'verification-coverage-gap','finding':'元verify.pyはEvidenceの7キー存在を検査するがcheckedAtの日付形式は検査しない。Go実装cmd/builddata/ledger.go:121はtime.Parse("2006-01-02", e.CheckedAt)を必須にする。今回30件は日付のみで全て通過し、日時文字列負例は拒否された。','action':'本レビューのGo probe結果を契約検証に使用。候補checkedAtの訂正は不要。'}]
# Keep licensing references with their actual bytes and specific scope.
policyrefs=[]
spec=p['P05']
assert sha(spec['specificationPath'])==spec['specificationSHA256']
corrections.append({'id':'P05-specification-locator','targetPath':'data/evidence/issue7/hokkaido/policy.json','jsonPointer':'/P05/specificationLocator','old':spec['specificationLocator'],'new':'6章 データ品質、本文12頁「位置正確度・絶対正確度」：該当施設の建物外周内、全数検査、誤率0%','applied':False,'reason':'原本の8章はメタデータ。建物外周内検査は6章。'})
discrepancies.append({'id':'P05-specification-locator','kind':'documentation-source-mismatch','finding':'policy.jsonは建物外周内検査を8章と記すが、PDF原本は6章データ品質・本文12頁。8章はメタデータ。','action':'原本の6章を根拠に評価し、locatorのexact old/newを提出する。数値・建物同定は影響なし。'})
for label,path,url,locator in [
 ('P05-2022 individual','data/evidence/issue5/north/originals/f4fb606b48648e225580eefef68bacd8daf75d1245b938c2057d7798f2d898e9.html','https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-2022.html','このデータの使用許諾条件 / オープンデータ（CC_BY_4.0）'),
 ('individual linked terms','data/evidence/issue5/north/originals/f9947a182c0f946a298b04f4cf2d112ed13807b22abaf52b74272c7e710744e1.html','https://nlftp.mlit.go.jp/ksj/other/agreement_01.html','1(6)ウ CC BY 4.0互換'),
 ('current general PDL','data/evidence/issue7/hokkaido/originals/c0ba91f10947af25ac807a3cdb4c21f7f300124dc0eac048f6f466c02472a9b4.html','https://nlftp.mlit.go.jp/ksj/other/agreement.html','権利表記の記載がない限りPDL1.0'),
 ('municipal portal','data/evidence/issue7/hokkaido/originals/f8ed6755d73ebd7147265cff4aac2cd0cef94ed2b203e31a46fec43b8896c118.html','https://www.harp.lg.jp/opendata/terms.html','第1条 CC BY 4.0・個別指定優先・数値データ、第2条第三者権利')]:
 policyrefs.append({'label':label,'snapshotPath':path,'snapshotSHA256':sha(path),'sourceUrl':url,'sourceLocator':locator})
oldrumoi=next(x for x in read('data/national/location-updates/north-hokkaido.json')['updates'] if x['facilityId']=='facility:north-5e7ef2bf3873a0c566d6')
assert sha(oldrumoi['evidence']['snapshotPath'])==oldrumoi['evidence']['snapshotSHA256']
focus={
 'furano':{'facilityIds':['facility:north-5146ae8cc4fb697aa46b'],'finding':'2025-07-17はポータル作成/更新日。CSV PF0000000001の複合庁舎・弥生町1-1・43.342336,142.383447を2022-09-26新庁舎開庁記事と現総合窓口案内に接続。旧役場43.342024,142.383104および別行総合保健センター43.3426675,142.3820473は不使用。特定EPSGは原典未記載。'},
 'kembuchi':{'facilityIds':['facility:north-f19c149e540fddcdc014'],'finding':'XLSX B12=0000000011、E12=剣淵町絵本の館、I12=緑町15番3号、M12=0165-34-2624が現配布案内と一致。K12/L12を使用。隣接資料館はB13=0000000012・15番4号・44.10038,142.35868。ふりがなrPhを名称本体と混ぜずsharedStringsの直下tで読んだ。特定EPSGは原典未記載。'},
 'noboribetsu':{'facilityIds':['facility:north-proposal-noboribetsu-duty','facility:north-03d0245a068dd82eaa37'],'finding':'市庁舎案内のmarkerInfos[0] title=北海道登別市役所を中央町6-11本庁舎に対応させる。現配布案内の本庁舎1階宿直室は採用、第2庁舎2階は保留。center値および千歳町3-1-5のP05は流用しない。'},
 'teshio':{'facilityIds':['facility:north-c2f6c2b5109a65d91a91','facility:north-fbbc6a7052c886cafee9'],'finding':'配布本文1464-113とfooter1466-113の原文差は未解決の住所表記として保持。ただし双方の役場名、新栄通8丁目、電話01632-2-1001が一致し本文の2階建設課/1階当直室が同じ役場を指定。P05は町役場・新栄通8で一致。別棟・移転・異なる数値候補を示す差ではないため建物点採用を妨げない。住所修正を提案しない。'},
 'rumoi':{'facilityIds':['facility:north-5e7ef2bf3873a0c566d6','facility:north-7d980545cacdb9317d51'],'oldGoogleResponse':oldrumoi,'currentHTMLCoordinate':updates['facility:north-5e7ef2bf3873a0c566d6']['coordinate'],'finding':'旧短縮URL/Google応答値43.9387173,141.6470101と、新市HTML q=43.93876130596552,141.64699032117065は別の値・別原典。市HTMLを旧値の出典へ付け替えていない。カード配布節の留萌プラザ2F・開運町3-4-11に接続し分庁舎へは流用しない。背景地図・Google応答の再配布を承認しない。'}
}
# Resolve exact teshio IDs from audit instead of relying on a manually typed hash.
focus['teshio']['facilityIds']=[a['facilityId'] for a in audit if a['facilityId'] in updates and a['name'].startswith('天塩町役場')]
rows=[]
for a in audit:
 fid=a['facilityId'];row={'facilityId':fid,'name':a['name'],'address':a['address'],'scopeOfReview':'building representative point; no entrance/interior precision required','supportingSources':[{'sourceUrl':s['url'],'snapshotPath':s['snapshotPath'],'snapshotSHA256':s['snapshotSHA256']} for s in a['supportingSources']]}
 if fid in updates:
  n=nums[fid];isp=n['method']=='P05-22';row.update(status='correction-required' if isp else 'accepted',coordinateDecision='accepted',coordinate=updates[fid]['coordinate'],reason=a['decision'],rawVerification={'path':'data/evidence/issue7/review-hokkaido/numeric-checks.json','facilityId':fid,'coordinateExact':True,'hashValid':True,'idAssigned':True,'goEvidenceValid':True,'checkedAtDateOnly':True,'axisOrder':n['axisOrder'],'crs':n['crs']},sourceConditions=('個別CC_BY_4.0指定を保持する説明訂正が必要。出典・加工表示は存在し、数値・建物同定の差戻しではない。' if isp else '自治体施設一覧はポータルCC BY 4.0/個別CC BY表示を確認。EPSG未記載を保持。' if n['method'].startswith('municipal') else '市がHTMLで直接指定した座標事実を出典付きで使用。HTML全文・写真・背景地図の公開許諾まで承認するものではない。'),requiredCorrectionIds=['evidence-'+fid,'policy-P05','generator-P05','readme-P05'] if isp else [])
 else:
  p=pending[fid];row.update(status='deferred',coordinateDecision='deferred',reason=p['reason'],nextSource=p['nextSource'],independentAssessment='提出原本・記録に今回採用できる数値原典/対象棟の接続が揃っていないため保留。過去の保留判断だけを新たな建物同定の証拠とはしない。',reviewDepth='submitted-evidence review; not an exhaustive new search',sourceConditions='旧Google応答やH22/H25/H26点の利用条件を新P05/市HTMLへ付け替えない。取得済みHTMLの全文公開を承認しない。')
 rows.append(row)
for row in rows:
 if row['status']=='correction-required':row['requiredCorrectionIds'].append('P05-specification-locator')
accepted=[r['facilityId'] for r in rows if r['status']=='accepted'];condition=[r['facilityId'] for r in rows if r['status']=='correction-required'];adoptable=[r['facilityId'] for r in rows if r['coordinateDecision']=='accepted']
report={'schema':1,'region':'hokkaido','reviewedAt':'2026-11-05','actorType':'ai','reviewType':'independent-adoption-review','inputPath':'data/national/issue7/hokkaido.json','inputSHA256':sha('data/national/issue7/hokkaido.json'),'instructions':'ユーザー提示AGENTSを適用。cwdと祖先にAGENTS.md実ファイルなし。コード契約優先。指定レビュー出力以外は変更禁止。','decisionDefinitions':{'accepted':'建物同定・原数値・条件・Go契約を満たす。','correction-required':'建物点は採用可だが個別CC BY指定を保持する説明訂正後に採用する。数値再調査は不要。','deferred':'提出された証拠だけでは対象建物と利用可能な数値原典を接続できない。追加探索完了の主張ではない。'},'counts':{'accepted':len(accepted),'correction-required':len(condition),'deferred':len(rows)-len(adoptable),'coordinateAccepted':len(adoptable)},'acceptedFacilityIds':accepted,'correctionRequiredFacilityIds':condition,'adoptionFacilityIdsAfterExactCorrections':adoptable,'reviews':rows,'corrections':corrections,'policyEvidence':policyrefs,'focusFindings':focus,'documentCodeDiscrepancies':discrepancies,'validation':read(D/'validation.json'),'limitations':['入口・室内位置の測量精度や、全施設の未知の改修不存在証明を要求していない。','38保留件すべてを新規深掘りし尽くしたとは主張しない。特に夕映・よろーな等は追加原典/建物対応で結論が変わり得る。','原本保存の監査目的とHTML全文・写真・地図の公衆送信許諾は別。今回の採否は個別座標事実を対象とする。','Go Evidenceの通過は施設同定やライセンスの意味的正しさまで検証しない。'],'writesAppliedToSource':False,'distributionOrRelationChanges':False,'chitoseNameCorrectionResubmitted':False}
assert len(rows)==68 and len(adoptable)==30 and len(condition)==26 and len(accepted)==4
for c in corrections:
 path=R/c['targetPath']
 if 'jsonPointer' in c:
  v=read(path)
  for k in c['jsonPointer'].strip('/').split('/'):v=v[int(k)] if isinstance(v,list) else v[k]
  assert v==c['old']
 else:assert path.read_text().count(c['old'])==1
write(out,report);write(D/'exact-corrections.json',corrections);write(D/'document-code-discrepancies.json',discrepancies);write(D/'focus-findings.json',focus)
for p,h in read(D/'protected-hashes.json').items():assert sha(p)==h,p
write(D/'final-integrity.json',{'protectedFilesUnchanged':True,'protectedFilesChecked':len(read(D/'protected-hashes.json')),'exactOldValuesMatched':len(corrections),'reviewIDs':68,'acceptedIDs':4,'correctionRequiredIDs':26,'deferredIDs':38,'sourceOrManifestEditsApplied':False})
print(json.dumps(report['counts'],ensure_ascii=False));print('All exact old values matched; protected inputs unchanged.')
