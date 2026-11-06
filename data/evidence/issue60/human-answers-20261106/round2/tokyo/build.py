import json,pathlib,hashlib,copy
root=pathlib.Path('/home/akihiro/personal/manhole-card-map');out=pathlib.Path('/tmp/issue60-round2-tokyo')
def read(p):return json.loads((root/p).read_text())
def norm(x):return hashlib.sha256(json.dumps(x,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
def filehash(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
old=read('data/national/issue76/tokyo/assessment.json');held=[r for r in old['outcomes'] if r['recommendation']=='hold'];num=json.loads(pathlib.Path('/tmp/issue60-human-tokyo/numerical-comparison.json').read_text())
confirmation='data/evidence/issue60/human-answers-20261106/direct-map-confirmation.json';answers='data/evidence/issue60/human-answers-20261106/answers.md'
propose={1,2,3,4,5,9}; updates=[];rows=[]
reason={
1:'利用者は地図上で松島ビルを直接クリックしたと明示。提示点は4550内で既存候補から2.71m。既存住所18-14、東の18-15/4551、西側18-13の配置と新たな棟指定を合わせ、4550を配布先建物と判断する。51.4㎡という水平面積だけで103号室を含めないとする旧疑義は決定的な反証ではない。GSI由来の既存内点を維持し、ユーザー点を座標源にしない。',
2:'利用者が店舗を地図上で指定した点は2982内で、既存候補から5.70m。同一細長棟の範囲である。既存相互写真の丸吉・花蝶、東西路とアーケードの配置に新しい棟指定を併用して2982を支持する。新記述のRocco/ポピーの店順は独立未検証として残し、旧写真の店順を置換しない。狭い境界余裕だけでは却下しない。',
3:'URの15号棟1階配布は公式本文で確認済み。周辺6棟と道路・41号棟との配置で得た既存写像点に対し、利用者が直接指定した15号棟点は中心から8.05m、写像矩形辺から僅か0.37m外。図の手読み・模式化と棟内指定位置の差として整合し、別棟を案内する具体的な兆候はない。対象棟未収録やdatum名だけを保留理由にせず、既存の図写像点を提案する。',
4:'市公式の配布先はチケット売り場。既存入口写真は大屋根下TICKET小棟を示す。利用者が同小棟を地図上で直接選んだ点が2872内で、既存点から3.56mとなり、旧屋根/窓口の用途疑義を補完する。管理事務所2877の形状差をTICKET棟へ転用しない。入口群ではなく当該小棟への案内として既存点を提案。',
5:'ミュージアム棟は公式配置図で周囲のラボ41・スター3棟から分離同定済み。新たな直接指定点は既存写像矩形内部で中心から11.96m。矩形内の入口寄り位置と代表点の差として説明できる。利用者のスター3棟を西とする説明は、公式配置の東という既存読解に優先させない。棟名指定・直接指定点・公式配置の整合から既存中心を提案する。',
6:'直接指定の取得方法は解消。ただし提示点は既存推定点から13.12m南西で、旧概寸23.9x15.4mの短軸方向へ13.11m離れ、想定壁辺より約5.41m外。旧交番区画辺=外形辺の仮定又は新指定点が建物/外ひろばのどちらかという具体的な食い違いを解消できない。点を単純移動せず保留。',
7:'利用者のE03直接指定は既存投影点から1.68mで、E02/E04の店順とも整合。位置面の判断は補強される。ただし公開候補の沿線方向位置は利用条件未確認の地理院住所検索API値から作成されたまま。クリック確認で由来は置換できないため、この候補は採用提案せず保留。API由来に依存しない導出又は利用条件の判断が残る。',
8:'直接クリックであることは確認されたが、提示点は旧事務棟の既存独立同定点から約203.81m、旧事務棟境界から186.21m外。旧事務棟という建物名と新座標の具体的矛盾は方法確認だけで解消しない。既存点・新点とも今回は選択しない。',
9:'現サービスセンターは公式発表の屋内ひろば・円形屋根と計画西端管理棟の対応で同定済み。新たな直接指定点は既存写像箱内で中心から11.41m。約22.9x29.6mの建物範囲内で、現棟を直接指す補完情報が得られた。旧検査点残差10mを精度上限に読み替えず、同じ街区西端の独立サービスセンターへの案内として既存の計画写像代表点を提案。',
10:'直接クリックの提示点は既存荻外荘本体5899内、旧本体内点から3.26m。利用者が指定した「本体でなく屋外・入場前の別受付」という構造の説明と点が整合しない。現再移築部の形状差もあり、本体の点を現窓口点として代用せず保留。'}
for i,(r,n) in enumerate(zip(held,num),1):
 row=copy.deepcopy(r);row['number']=i;row['recommendation']='propose' if i in propose else 'hold';row['adoptionApproved']=False
 row['sourceLocationPath']=r['sourceLocationPath'];row['sourceLocationSHA256']=r['sourceLocationSHA256'];candidate=None
 if i in propose:
  if r['sourceLocationPath']:
   candidate=copy.deepcopy(next(u for u in read(r['sourceLocationPath'])['updates'] if u['facilityId']==r['facilityId']))
   assert norm(candidate)==r['sourceLocationSHA256']
  else:
   rp=n['referencePath'];j=read(rp);coord=n['referenceCoordinate']
   candidate={'facilityId':r['facilityId'],'coordinate':coord,'scope':'building','evidence':{'sourceUrl':'https://github.com/gsi-cyberjapan/optimal_bvmap' if i==1 else 'https://www.city.edogawa.tokyo.jp/e066/toshikeikaku/kankyo/midori/torikumi/r4soureku.html','snapshotPath':rp,'snapshotSHA256':filehash(root/rp),'sourceLocator':'candidate.geometry feature4550 / candidate.inclusion.coordinate' if i==1 else 'manualPointLatLng; planBuildingWallBoxPx; mappedWallBoxLatLng; checkPoint','checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'既存調査の未承認代表点を保持。利用者の2026-11-06直接地図指定で棟対応を補完し採用審査へ提出。国土地理院最適化ベクトルタイルを加工。' if i==1 else '区公式計画図の管理棟代表点を、周辺街区の道路角からGSI写真へ双線形写像した既存参考点を保持。原検査点残差約10mは精度上限としない。2026-11-06利用者の現棟直接地図指定で補完し採用審査へ提出。計画図・写真の全文や図版を公開用資産へ転載しない。'}}
   row['sourceLocationPath']=str(out/'candidate.json');row['sourceLocationSHA256']=norm(candidate)
  updates.append(candidate);row['candidateRef']=str(out/'candidate.json')+'#/updates/'+str(len(updates)-1)
 row['adoptionMethod']='国土地理院最適化ベクトルタイルの既存建物外形内点を維持し、利用者の現建物直接指定を棟同定の補完証拠として採用評価。出典・加工表示を継承。' if i in [1,2,4] else 'UR公式配置図を周辺のGSI建物外形に対応させた既存相似変換点を維持し、利用者の現建物直接指定を補完証拠として採用評価。対象棟のGSI外形は未収録。図版の転載を伴わない単一代表点。' if i in [3,5] else '区公式計画図の管理棟点を周辺街区の道路角でGSI写真へ双線形写像した既存代表点を維持し、利用者の現建物直接指定で補完。対象棟の数値外形は未収録。図版の転載を伴わない単一代表点。' if i==9 else None
 row['userCoordinate']=n['userCoordinate'];row['coordinateComparison']=n;row['userReportedAt']='2026-11-06'
 row['positionSuitability']={'status':'acceptable' if i in propose else 'held','evidence':list(dict.fromkeys(r['positionSuitability']['evidence']+[answers,confirmation,str(out/'numerical-comparison.json')+'#/'+str(i-1)])),'uncertaintyBasis':'共通製品評価と既存個別計算を継承。利用者が地図上の建物を直接クリックしたことを補完証拠とするが、独立測量・絶対誤差保証ではない。点間距離・内包は同一建物との整合検査で、誤差上限を与えない。','buildingAssessment':reason[i]}
 row['limitations']=r['limitations']+['今回の直接地図指定は利用者報告であり、私がGoogle Maps画面・撮影時点・測量を独立確認したものではない。','元候補のcheckedAt=2026-11-05と新回答2026-11-06を分ける。元候補の未承認表記は歴史記録として保持する。']
 if i in [3,5,6,9]:
  row['sourceUseAssessment']={'purpose':'数値の単一代表点という地理的事実の提示。原図、トレース外形、画像の公開資産への転載は行わない。','policyURLs':['https://www.ur-net.go.jp/site/guide.html','https://akabanemuseum.ur-net.go.jp/wedsitenote/'] if i in [3,5] else ['https://www.city.akiruno.tokyo.jp/site_policy/0000000005.html'] if i==6 else ['https://www.city.edogawa.tokyo.jp/e004/aboutweb/riyo.html'],'policyFinding':'一般の転載・改変制限と引用等の例外を確認。単一の事実座標の導出を一律禁止する条項は今回確認していない。図版転載禁止だけから座標事実の使用禁止とは断定しない。図の公開ライセンス付与や権利者の個別許諾取得を主張しない。','reviewScope':'位置面の採用提案と、単一座標の事実抽出としての出典取扱いを独立レビューで判断。','evidence':str(out/'policy-retrievals.json')}
 if i in [1,2,4]:row['sourceUseAssessment']={'purpose':'GSI PDL対象の数値外形由来の既存点。利用者クリック値は棟の選択を補完するだけで出力座標源ではない。','status':'既存共通製品利用条件を継承。一般写真・HTML全文転載なし。'}
 row['nextAction']='新回答と位置面の判断・出典の取扱いだけを独立採用レビューする。旧計算/全suiteは繰り返さない。' if i in propose else reason[i]
 rows.append(row)
payload={'schema':1,'county':'tokyo','assessmentDate':'2026-11-06','basis':'new direct-map confirmation; prior computation and reviews inherited','adoptionApproved':False,'summary':{'total':10,'propose':6,'hold':4},'commonEvidence':old['commonEvidence'],'inputSHA256':{confirmation:filehash(root/confirmation),answers:filehash(root/answers),'data/national/issue76/tokyo/assessment.json':filehash(root/'data/national/issue76/tokyo/assessment.json')},'sourceUsePolicy':'Google/user clicks corroborate building identification; no adoption coordinate copied from the clicks. Existing GSI or official-plan-derived numerical points retained. Single geographic facts distinguished from diagram copying.','outcomes':rows,'newDocsCodeMismatches':[],'preservedSourceDifferences':['5 stars west in user description versus east in prior official-plan reading','6 point/assumed building rectangle mismatch','8 old office name versus displaced point','10 outdoor separate reception versus mansion body point']}
(out/'candidate.json').write_text(json.dumps({'schema':1,'updates':updates},ensure_ascii=False,indent=2)+'\n');(out/'assessment.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
(out/'numerical-comparison.json').write_bytes(pathlib.Path('/tmp/issue60-human-tokyo/numerical-comparison.json').read_bytes())
assert len(rows)==10 and len(updates)==6 and len({u['facilityId']for u in updates})==6
for row in rows:
 if row['recommendation']=='propose':
  candidate=next(u for u in updates if u['facilityId']==row['facilityId']);assert norm(candidate)==row['sourceLocationSHA256'];assert candidate['coordinate']==row['coordinateComparison']['referenceCoordinate']
(out/'verification.json').write_text(json.dumps({'status':'PASS','scope':['10 prior held IDs covered','6 candidate row canonical hashes verified','all6 candidate coordinates preserve prior research values','direct-map confirmation and raw answers file hashes recorded','no fullsuite, raw tile re-decode, repository modifications or adoption approval'],'canonicalAssessmentOutcomesSHA256':norm(rows),'candidateFileSHA256':filehash(out/'candidate.json')},ensure_ascii=False,indent=2)+'\n')
print(payload['summary'])
