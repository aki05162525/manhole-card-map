import json,pathlib,hashlib,shutil,math,subprocess
P=pathlib.Path('/tmp/issue60-recheck-third-tokyo'); R=pathlib.Path('/home/akihiro/personal/manhole-card-map')
def read(p):return json.loads(pathlib.Path(p).read_text())
def write(n,x): (P/n).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
inputs=[]
def retain(p):
 p=pathlib.Path(p); b=p.read_bytes(); h=hashlib.sha256(b).hexdigest(); dest=P/'inputs'/h/p.name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b);inputs.append(dict(original=str(p.resolve()),copy=str(dest),sha256=h,bytes=len(b)));return str(dest)
paths=['AGENTS.md','REVIEW.md','docs/distribution-design.md','data/evidence/issue60/human-answers-20261106/receipt.json','data/evidence/issue60/human-answers-20261106/answers.md','data/evidence/kanto-prefecture/tokyo/outer/flare-reading.json','data/evidence/kanto-prefecture/tokyo/outer/flare-estimate.json','data/evidence/kanto-prefecture/tokyo/outer/flare-estimate.py.txt','data/evidence/kanto-prefecture/tokyo/outer/flare-comparison.json','data/evidence/kanto-prefecture/tokyo/east/mikawashima-comparison.json','data/evidence/kanto-prefecture/tokyo/west/ogikubo/candidate-point.json','data/evidence/kanto-prefecture/tokyo/west/ogikubo/comparison.json','data/evidence/issue76/tokyo/measurements.json','data/evidence/issue76/common/product.json','data/evidence/kanto-prefecture/chiba/rights.json','data/evidence/kanto-prefecture/tokyo/integration/human-answer-followup-20261106.json']
paths += ['/tmp/issue60-flare-followup/'+n for n in ['followup.json','layout.pdf','layout.png']]
paths += ['/tmp/issue60-recheck-six/tokyo/'+n for n in ['assessment.json','comparison.json','report.md','retrievals.json','mikawa-1.png','mikawa-2.png','raw/5023a0dc56bf8e3dcaa2de77535cc8080985cda0832f675151caee9ab3de2f36.pdf']]
for p in paths:retain(p)
rights=read(R/'data/evidence/kanto-prefecture/chiba/rights.json')
for x in rights['reusedSources']:
 assert hashlib.sha256((R/x['path']).read_bytes()).hexdigest()==x['sha256'];retain(R/x['path'])
measure=next(x for x in read(R/'data/evidence/issue76/tokyo/measurements.json')['rows'] if 'cdc3bc' in x['facilityId'])
for x in measure['containingSourceFeatures']:
 assert hashlib.sha256((R/x['path']).read_bytes()).hexdigest()==x['sha256'];retain(R/x['path'])
retain(R/'data/evidence/kanto-prefecture/tokyo/west/ogikubo/16-58185-25802.pbf.gz')
receipt={x['number']:x for x in read(R/'data/evidence/issue60/human-answers-20261106/receipt.json')['answers']}
user={6:'中のひろば屋内と外のひろばロータリー屋外を区別。交番・公衆トイレは西側で建物は東と今回報告。以前の東側交番説明から変更。新画像なし、同じ公式図。',8:'線路西の座標・一般街区誤認を撤回。線路東側の旧事務棟を明示。荒川二丁目停留場東の正門門衛所から入った直後の赤煉瓦旧事務棟が受付との報告。',10:'独立北ブース説を撤回。本体北側玄関（来場者入口/ガイダンス受付）がカード窓口。道路東の新展示棟とは別との報告。'}
write('user-report.json',dict(confirmationDate='2026-11-06',source='今回の依頼文からの要約。研究者の現地観測ではない。',googleHistory='過去のGoogle建物クリックによる取得回答は保持する。直接転記の利用条件は未解決。',answers=[dict(number=n,facilityId=receipt[n]['facilityId'],report=user[n]) for n in [6,8,10]]))
m=read(R/'data/evidence/kanto-prefecture/tokyo/east/mikawashima-comparison.json'); o=read(R/'data/evidence/kanto-prefecture/tokyo/west/ogikubo/candidate-point.json')
def inv(base,xy):
 x,y=xy;return dict(lat=round(math.degrees(math.atan(math.sinh(math.pi*(1-2*(base['y']+y/4096)/65536)))),7),lng=round((base['x']+x/4096)/65536*360-180,7))
def inside(p,r):
 x,y=p;v=False
 for a,b in zip(r,r[1:]+r[:1]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:v=not v
 return v
def margin(p,r):
 def d(a,b):
  dx=b[0]-a[0];dy=b[1]-a[1];t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy))) if dx or dy else 0
  return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
 return min(d(a,b) for a,b in zip(r,r[1:]+r[:1]))
checks=[]
for n,base,xy,ring,expected in [(8,m['numeric']['baseTile'],m['numeric']['pointTileXY'],m['manualUnionRing'],m['candidate']),(10,o['baseTile'],o['manualPointXY'],o['geometry']['coordinates'][0],o['inclusion']['coordinate'])]:
 coord=inv(base,xy);assert coord==expected;assert inside(xy,ring)
 scale=40075016.68557849*math.cos(math.radians(coord['lat']))/(65536*4096)
 checks.append(dict(number=n,coordinate=coord,baseTile=base,pointXY=xy,withinSavedRing=True,boundaryMarginMeters=round(margin(xy,ring)*scale,3),note='保存外形限定再計算。絶対位置誤差の保証ではない。原タイル再decodeなし。'))
write('reproduction.json',checks)
common=dict(checkedAt='2026-11-06',adoptionApproved=False,coordinateSource='GSI最適化ベクトルタイル保存外形から独自計算済み代表点を再利用。Google座標転記なし。',rights='PDL1.0/GSI規約の共通製品証跡をhash照合して再利用。自治体・運営者図全文の再配布は承認しない。',uncertainty='製品の個別測量時点と絶対誤差は不明。格子の7桁は精度保証でない。棟・道路・周辺配置の独立照合と内側余裕で対象への案内支障を評価。CRS名称単独を保留理由にしない。')
candidates=[]
for n,coord,features in [(8,m['candidate'],[6677,9777]),(10,o['inclusion']['coordinate'],[5899])]:
 candidates.append(dict(number=n,facilityId=receipt[n]['facilityId'],name=receipt[n]['heading'],coordinate=coord,combinedFeatureIndices=features,status='candidate_for_parent_independent_review',scope='現受付を含む建物代表点。入口・室内窓口の位置ではない。',**common))
write('candidate.json',dict(schema=1,updates=candidates))
outcomes=[dict(number=6,facilityId=receipt[6]['facilityId'],recommendation='hold',adoptionApproved=False,userReport=user[6],originalReading='配置図の矢印は紙面左上向き。図の上辺に北側電源、下辺に南側電源の記載がある。公衆トイレ・交番は紙面右、本体から見て北矢印基準で東寄り（交番は南東寄り）。道路は下から右へ回り、駅は左下。中のひろばは室内、外のひろばは大屋根を含む屋外区画で、ロータリー車道そのものとは同一視しない。',inference='北矢印・駅・道路・交番から図の向きは整合し、左右を反転して新説明に合わせる根拠はない。しかし図の交番区画辺をGSI交番建物外形辺と同一視する旧推定の平行移動は確定しない。',history=['利用者旧点35.732470,139.228771は保持、採用なし。','既存推定35.7325569,139.2288693は保持、採用なし。','旧記録の方位の単純な東/西表現は概略。今回図に合わせ東寄り/南東寄りと明確化。','167㎡は中のひろば面積で建物総面積ではないとの既往訂正を維持。'],trueContradictions=['今回の西側交番/東側本体と、北矢印付き同一図での配置が反対。'],unfinishedSteps=['許容する位置根拠上で同じ道路角又は交番建物自体を図中で同定し、区画辺＝建物辺の仮定を外した平行移動を拘束する工程。既存±3mはこの仮定誤差全体の上限ではない。'],notRequired=['本体の古polygon','全周一致','入口測量','CRS名確定のみ','屋内限定']),dict(number=8,facilityId=receipt[8]['facilityId'],recommendation='candidate_for_parent_independent_review',adoptionApproved=False,userReport=user[8],originalReading='R7 PDF p1北矢印付き案内図で旧事務棟は都電の東、門衛所の北。p2鳥瞰でも正門・門衛所の奥、文化財群の西側に旧事務棟。受付カード用途を旧事務棟内と明記した図ではない。',inference='旧事務棟名の指定、線路側と入場経路の訂正が元6677+9777との対応を補完。旧西側点との矛盾は撤回により解消。現受付用途は利用者報告と既存集合案内を併用した判断として候補化。',history=['初回35.738150,139.782850と前回35.73695,139.78265は線路西側の誤指定として棄却。数値/説明履歴は保存。'],positionSuitability='既往union境界余裕9.096m、非重複別外形14.99m、道路中心線13.664m。線路東約32mという配置、正門/文化財群の並びも整合。誤差値をゼロとは扱わないが、別街区への誤案内を示す不一致は解消したと評価。',limits=['赤煉瓦という色・材質は今回旧事務棟そのものの写真として独立確認していない。パンフの赤煉瓦文化財写真を旧事務棟へ転用しない。','現受付用途は利用者報告であり研究者の現地確認・公式の用途明記へ読み替えない。'],trueContradictions=[],unfinishedSteps=['親による候補/用途根拠の独立採用レビューと統合検査。']),dict(number=10,facilityId=receipt[10]['facilityId'],recommendation='candidate_for_parent_independent_review',adoptionApproved=False,userReport=user[10],originalReading='運営者visitor-mapは本体北側に見学者入口を描く。受付/カードの文字はない。access図は道路東側展示棟を区別。杉並区7585は展示棟の1Fショップカフェ・2F展示室と2025-07-16開業を記載。',inference='利用者が本体北側入口をカード窓口に指定したため、既存5899の荻外荘本体という同定と現在受付の同棟対応を補完できる。図と旧外形の幅差（再移築部未反映の可能性）は残るが、本体内代表点を別棟に変える理由ではなく、全周一致や入口の外形内包は要求しない。',history=['初回35.699021,139.622278はGoogle由来報告として保持、今回転記なし。','北独立ブース説と35.69942,139.62238（5896内）は撤回、今回採用対象から除外。'],positionSuitability=f"保存5899内代表点を再現。境界余裕{checks[1]['boundaryMarginMeters']}m。南の芝生、東の道路、その東の別展示棟との位置関係が一致。本体への案内として支障を示す別棟不一致は解消。古外形の幅差は絶対誤差上限として数値化しない。",trueContradictions=[],unfinishedSteps=['親による候補/用途根拠の独立採用レビューと統合検査。'])]
write('assessment.json',dict(schema=1,head=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),checkedAt='2026-11-06',summary=dict(assessed=3,candidates=2,hold=1,approved=0),outcomes=outcomes,docsCodeDifferences=[],limits=['共有repo編集なし・commit/PRなし・全suiteなし・現地観測なし。','原研究の取得日は保持。今回の2026-11-06は限定照合日で、旧原本の新規取得日としない。']))
write('input-hashes.json',inputs)
# Every snapshot is immutable relative to its recorded input hash.
for x in inputs:assert hashlib.sha256(pathlib.Path(x['copy']).read_bytes()).hexdigest()==x['sha256']
for x in read(P/'retrievals.json'):assert hashlib.sha256(pathlib.Path(x['path']).read_bytes()).hexdigest()==x['sha256']
write('verification.json',dict(inputCopiesVerified=len(inputs),freshHTTP200Sources=5,coordinateReproductions=2,fullSuiteRun=False,rawTilesDecoded=False,repoEdited=False,approved=0,limitations=['SVG描画の初回はシステムPythonにcairosvgがなく失敗。出力先専用venvへ導入後、2図の描画に成功。','web取得はフレアPDF Internal Error、三河島PDF403。既存2026-11-06取得原本のhashと画像を再利用。']))
print(json.dumps(dict(inputs=len(inputs),checks=checks),ensure_ascii=False))
