import json,pathlib,hashlib
O=pathlib.Path('/tmp/issue60-recheck-third-other');R=pathlib.Path.cwd();root=R/'data/evidence/issue60/human-answers-20261106';receipt=json.load(open(root/'receipt.json'));cs=json.load(open(O/'candidates.json'))
def write(n,x):(O/n).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
reports={11:((35.25791,139.66216),(35.25791,139.66228),'交番真東の独立白ブース。今回経度を訂正。'),19:((35.57715,140.38405),None,'マルシェ/とっチーノ東に接続する大型庇屋根の半屋外レジゲート/温室入口、開放キャノピー常設精算へ説明更新。古画像屋外通路に見えた原因との説明は利用者推測。'),30:((35.81156,139.63820),(35.81340,139.64230),'戸田笹目5-37-14正門入って右南平屋、前面展示マンホール。管理本館とは別。'),36:((36.03975,139.41890),(36.03975,139.42180),'道路大型駐車場から市野川側を渡った純和風平屋門型建物が券売管理、向かいうどん松音屋、入場後右奥文化財センター左売店。')}
users=[]
for n,(now,prev,desc) in reports.items():
 r=next(r for r in receipt['answers'] if r['number']==n)
 users.append(dict(number=n,facilityId=r['facilityId'],reportedConfirmationDate='2026-11-06',coordinateAcquisition='previous user answer: Google building click; not new independent survey',reportedCoordinate=dict(zip(['lat','lng'],now)),supersededCoordinate=dict(zip(['lat','lng'],prev)) if prev else None,report=desc,receiptEntry=r,status='user_assertion_not_adoption',independentlyObservedOnSite=False,source='Current task message; previous originals retained at receipt/corrections/direct-map-confirmation'))
write('user-report.json',users)
findings={11:('hold_numeric_conflict_and_correspondence','新点は交番523内。ブースとの数値対応は解消せず。524道路側点の独自導出未実施。'),19:('hold_correspondence_after_photo_inspection','既往レジ近接写真2枚を確認済み。方位を決める遠景/屋根輪郭なし。半屋外定義は認めるが報告地点との対応未確定。'),30:('candidate_with_report_conflict','正門右北西の998を推論。新報告点/南側指定とは不一致。親は右端屋根の用途同定を優先レビュー。'),36:('candidate_with_report_conflict','2018券売写真・道路西店舗・GSI写真から1258を推論。新点は川西側で不一致。文化財センター1265と別。')}
write('assessment.json',dict(schema=1,checkedAt='2026-11-06',head='f7fdd5cd402e873c6565cab2b75f49a4f854bd4a',total=4,limitedChecksCompleted=4,candidates=2,held=2,adoptionApproved=False,outcomes=[dict(number=u['number'],facilityId=u['facilityId'],status=findings[u['number']][0],finding=findings[u['number']][1],candidate=next(({'coordinate':c['coordinate'],'artifact':'candidates.json','combinedIndex':c['combinedIndex']} for c in cs if c['number']==u['number']),None),sourceUserInferenceSeparated=True) for u in users],docsCodeDiscrepancies=[],limits=['no field observation','no adoption review','no full suite','image capture dates unknown except Yoshimi travel 2018-11-14','Google direct reuse unresolved']))
paths=[R/'AGENTS.md',R/'REVIEW.md',R/'docs/verification/issue76-common.md',R/'tools/national/research_common.py',root/'receipt.json',root/'corrections.json',root/'coordinate-source-notes.json',root/'direct-map-confirmation.json',R/'data/evidence/kanto-prefecture/saitama/source-conditions.json',R/'data/evidence/kanto-prefecture/saitama/groups/tourism/yoshimi-geometry.json',R/'data/evidence/kanto-prefecture/kanagawa/peninsula/kinugasa-observation.json',R/'data/evidence/kanto-prefecture/chiba/batch2/visitor-five/togane-comparison.json']
paths += [pathlib.Path('/tmp/issue60-recheck-six/kanagawa')/n for n in ['kinugasa-center.jpg','kinugasa-center.html','assessment.json']]
paths += [pathlib.Path('/tmp/issue60-recheck-chiba-nov6')/n for n in ['assessment.json','numeric-comparison.json','togane-map.jpg','togane-air.jpg','togane-seamlessphoto.png','raster-frames.json','ryokuka.html','togane.html','asset-retrievals.json']]
paths += [pathlib.Path('/tmp/issue60-recheck-saitama-nov6')/n for n in ['assessment.json','raw/nanbu-plan.png','reused-plans.json','numerical-comparison.json']]
paths += [pathlib.Path(r['input']) for r in json.load(open(O/'calculations.json'))]
paths += [R/r['rawTile'] for r in json.load(open(O/'verification.json'))['checks']]
paths += list((O/'raw').glob('*'))
write('input-hashes.json',[dict(path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),bytes=p.stat().st_size) for p in sorted(set(paths)) if p.exists()])
old=json.load(open(R/'data/evidence/kanto-prefecture/chiba/batch2/visitor-five/togane-comparison.json'))
def walk(x):
 if isinstance(x,dict):
  if 'key' in x and 'sha256' in x:yield x
  for v in x.values():yield from walk(v)
 elif isinstance(x,list):
  for v in x:yield from walk(v)
checks=[]
for year in [2024,2026]:
 k=f'togane-register-photo{year}.jpg';r=next(r for r in walk(old) if r['key']==k);sha=hashlib.sha256((O/'raw'/f'19-register{year}.jpg').read_bytes()).hexdigest();assert sha==r['sha256'];checks.append(dict(year=year,sha256=sha,previousInputMatched=True))
write('photo-reuse-verification.json',checks)
assert [r['number'] for r in users]==[11,19,30,36];assert len({r['facilityId'] for r in users})==4
write('candidate-status.json',[dict(number=u['number'],candidate=next((c['coordinate'] for c in cs if c['number']==u['number']),None),adoptionApproved=False) for u in users])
print('4 IDs verified; 2 raw candidate features verified; 2 photo hashes match earlier originals; hashes saved')
