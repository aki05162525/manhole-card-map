import pathlib,json,hashlib,shutil,subprocess
O=pathlib.Path('/tmp/issue60-recheck-saitama-nov6');R=pathlib.Path.cwd();W=pathlib.Path('/home/akihiro/.t3/worktrees/manhole-card-map/t3-60b8ee0c/data/work/kanto-prefecture/saitama/groups/waterworks')
cs=json.load(open(O/'candidates.json'));users=json.load(open(O/'user-report.json'));nums=json.load(open(O/'numerical-comparison.json'))
reused=[]
for name in ['nanbu-plan.png','ugan-correct-148.png']:
 p=W/name;dest=O/'raw'/name;shutil.copyfile(p,dest);reused.append(dict(originalPath=str(p),path=str(dest),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),status='inherited rendered official plan, viewed this round; original source retrieval metadata in repository waterworks/retrievals.json; not newly acquired'))
(O/'reused-plans.json').write_text(json.dumps(reused,ensure_ascii=False,indent=2)+'\n')
holds={27:('駅南という旧説明は撤回され、北上公式園内図の管理棟＝円形広場南西、駅へ南下という関係と一致。数値点は旧農地道路上だが、この保存GSI版が整備前であるため、それを現建物否定の根拠にしない。','未完了は再利用可能な整備後画像を座標付き道路に対応付けて管理棟の数値点を自前導出する工程。既存の模式図を地理参照した誤差評価は今回未実施。新polygonを必須とはしない。Google数値の利用条件は未評価。'),30:('正門近くの守衛室という用途は提示旅行記事でも確認。今回点は建物2503の北東にあり最寄り外形まで28.945m、河川沿い道路側。北西の小棟494/998や492との対応を公式概略図だけでは固定できない。管理本館候補点との約70mという説明だけではどの正門小棟か特定できない。入口代表点を一律排除した判断ではない。','保存公式アクセス図の正門記号を、笹目川沿い道路のどの接続路か現行航空写真または公式正門写真で照合。点近傍に別の新守衛室がある可能性と旧図のずれを検証する。これは当方の対応付け未完了で、利用者の取得方法不明ではない。'),35:('2023年4月開業と駅南口は町公式本文で確認。公式写真は横長二階建て・直線階段・テラス。円形基調・らせん木スロープという叙述はYottecoの外観と不一致で、別施設混同の可能性が高いが混同先は未同定。新点は駅南出口の南側区画まで移り、旧159m東という距離は新点へ継承しない。最寄り旧小棟3374まで1.949mでも旧街区建物を新棟に転用しない。','現在のYotteco写真・駅南口再整備図を更新されたGSI地図/空中写真へ対応付け、横長新棟の代表点を導出する。今回その座標付き資料の追加取得・地理参照は未実施であり資料不存在とは言わない。'),36:('公式町頁・観光頁は北吉見324と百穴概要を確認できるが券売棟の位置を表示しない。新点は既存道路東側の1255/1257よりさらに東、最寄り1259まで46.535mで敷地内部。利用者の券売管理棟と文化財センターを区別する説明は保持するが、南東ゲートを示す図としては今回の2頁を使えない。','券売所を写した正門外観と、南北道路・文化財センター1265との位置関係を照合する。地理参照可能な公式写真/構内図の探索は次工程。距離だけによる棄却、面積だけによる1257採用はしない。')}
ass=[]
for u,num in zip(users,nums):
 n=u['number'];c=next((x for x in cs if x['number']==n),None)
 ass.append(dict(number=n,facilityId=u['facilityId'],userReportRef='user-report.json',decision='candidate_for_parent_independent_review' if c else 'unresolved',candidateRef=f'candidates.json#/{cs.index(c)}' if c else None,verifiedAndInferred=c['buildingIdentification'] if c else holds[n][0],nextAction='親による棟同定・不確かさ・利用条件の独立採用レビュー。入力hash固定後に判断する。' if c else holds[n][1],numericalRef=f'numerical-comparison.json#/{nums.index(num)}',adoptionApproved=False))
(O/'assessment.json').write_text(json.dumps(ass,ensure_ascii=False,indent=2)+'\n')
text='''# Issue60 埼玉10件・限定再照合

10件すべて処理。6件はGSI由来の建物代表点候補、4件は未解決。採用承認・manifest反映はしていない。対象HEAD: `'''+subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()+'''`。現残件は指定indexの2026-11-05台帳・2026-11-06採用基準で全国475／関東32を再利用した。

今回の回答は `user-report.json` に利用者報告として保存。全件2026-11-06確認、Google地図の建物クリック取得という既回答を保持。公式原本の確認、利用者報告、当方推定を区別し、Google数値は配信候補に転載していない。

## 固定候補（独立レビュー前）

|No|代表点（緯度,経度）|GSI外形|根拠と注意|
|---|---|---|---|
'''
for c,g in zip(cs,json.load(open(O/'candidate-geometries.json'))):
 text+=f"|{c['number']}|{c['coordinate']['lat']}, {c['coordinate']['lng']}|{','.join(map(str,g['combinedIndexes']))}|{c['buildingIdentification']}|\n"
text+='''
22の北半分、23の南西側30%区画は受付側/管理本館側を選ぶ当方の図読解であり、GSIに棟内部用途境界が収録されているという意味ではない。23は国道298号・笹目川・分水槽を用いて配置図を回転して比較した。32は管理棟図の上を西へ回転させ、二円形設備・道路・駐車場との相対関係でH形連接棟を選んだ。新しい建物polygon、入口測量、全周一致は要求していない。

24・32は**利用者の提示数値そのものと、訂正した建物説明がまだ不一致**。候補は説明と公式資料を採った当方の推定である。24のGoogle点は北1067/2650、32は西の大規模処理施設1471内。親はこの点を最優先に独立判断すること。22の「木造」は写真だけでは確認できず根拠から除外した。

各候補の原タイルhash、選択feature、加工法、内包、境界余裕は `candidate-geometries.json` / `candidates.json`。境界余裕5.379〜23.048mは絶対精度上限ではない。個別測量日と絶対誤差は未確認。用途の同定誤りが位置不確かさの主要な残留リスクであり、座標系名称だけで保留とはしていない。共通GSI利用条件は既存 `source-conditions.json` のPDL1.0・出典/加工表示評価を継承し、独立承認を代替しない。

## 未解決4件

'''
for n,(problem,nxt) in holds.items():text+=f'### {n}\n\n{problem}\n\n次の一手：{nxt}\n\n'
text+='''## 旧計算・原文の評価

- 22/23: 旧149m/117mは旧入力座標の計算。今回訂正点は既存比較外形内となり、この距離は解消した。
- 25/29: 旧121m/259mは限定された旧比較集合との距離として成立し得るが、別の5221/1228を今回比較すると内包。旧候補選択を確定事実扱いした判断は修正が必要。25の旧28-21から2008移転説は今回の提示2頁では確認せず、原因推定として分離。
- 24/32: 数値の東西南北変換を原タイルの選択featureと照合して一致確認。取得方法が不明なのではなく、叙述とクリック数値の対象が異なる。
- 27/35: 旧GSI版の更新前形状を現在の建物不存在と読み替えない。35の形状説明は公式写真と不一致、混同先の断定はしない。
- docs/code不一致：今回確認した実装（XYZ y-down変換・タイル結合）と参照文書の食い違いは検出なし。過去評価との上記差は入力変更・比較集合・推定の差であり、過去計測を現在結果としては扱っていない。

## 検証と保存範囲

`/tmp/saitama-research-venv/bin/python -B /tmp/issue60-recheck-saitama-nov6/verify.py` 成功。10番号・10ID・現残件照合、6候補の原タイル7個中の対象feature一致、丸め後内包を確認。全研究再decode、全suite、独立採用レビュー、現地調査、在庫確認は未実施。原本HTML/図は研究用保存のみで、配信資産に混ぜない。

成果は本ディレクトリのみ。共有repo・元承認15件・衣笠No12・利用者編集ファイルを変更せず、commit/push/再委任なし。一般原本URLと取得日時/hashはretrievals系JSON、旧配置図はreused-plans.json、固定入力一覧はinput-hashes.jsonに記録。
'''
(O/'report.md').write_text(text)
paths=[R/'REVIEW.md',R/'tools/national/research_common.py',R/'data/evidence/issue60/human-answers-20261106/receipt.json',R/'data/national/issue76/remaining-index-after-human-answers.json',R/'data/evidence/kanto-prefecture/saitama/source-conditions.json',R/'data/evidence/issue60/human-answers-20261106/round2/saitama/report.md',R/'data/evidence/kanto-prefecture/saitama/groups/waterworks/retrievals.json']
paths+=list(O.glob('*.json'))+list((O/'raw').glob('*'))+list(O.glob('*.py'))+[O/'report.md']
for g in json.load(open(O/'candidate-geometries.json')):paths +=[pathlib.Path(t['path']) for t in g['rawTiles']]
manifest=[dict(path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size) for p in sorted(set(paths)) if p.name!='input-hashes.json']
(O/'input-hashes.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('assessment',len(ass),'candidates',len(cs),'fixed inputs',len(manifest))
