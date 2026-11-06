import pathlib,json,hashlib,shutil,math,datetime,subprocess
from shapely.geometry import Polygon,Point,shape
O=pathlib.Path('/tmp/issue60-annotated-aerial-followup');R=pathlib.Path('/home/akihiro/personal/manhole-card-map')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(n,v): (O/n).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
inputs=[]
def keep(p):
 p=pathlib.Path(p);h=sha(p);dst=O/'inputs'/h/p.name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,dst);inputs.append(dict(original=str(p),copy=str(dst.relative_to(O)),sha256=h,bytes=p.stat().st_size));return p
attachments=['4a8cf4cf-80d1-43ec-a7e2-950fc582e012','3272c654-4f29-439c-b8ad-4d55f50bf225','b1dec281-1e0c-4947-8108-63882f9bb7f0']
for n,s in zip([6,11,19],attachments):
 p=keep('/home/akihiro/.t3/userdata/attachments/fb63a4cd-1c0e-4a8f-b4bd-a3badad279dc-'+s+'.png');shutil.copyfile(p,O/f'{n}-user-annotated.png')
for p in ['AGENTS.md','REVIEW.md','docs/distribution-design.md','data/evidence/kanto-prefecture/kanagawa/peninsula/kinugasa-comparison.json','data/evidence/kanto-prefecture/kanagawa/peninsula/kinugasa-16-58192-25901.pbf.gz','data/evidence/kanto-prefecture/kanagawa/peninsula/kinugasa-tiles.json','data/evidence/kanto-prefecture/kanagawa/peninsula/validation.json','data/evidence/location-batch1/gsi-terms.html','data/evidence/issue60/kinugasa-followup/original/kanagawa/kinugasa-center.jpg','data/evidence/issue60/kinugasa-followup/original/kanagawa/retrievals.json']:keep(R/p)
for folder,files in {'issue60-user-schematic-followup':['report.md','verification.json','input-hashes.json','11-calculation.json','gsi-frames.json','gsi-retrievals.json','6-gsi.png','11-gsi.png','11-gsi-detail.png'],'issue60-recheck-third-other':['report.md','user-report.json','photo-reuse-verification.json'],'issue60-recheck-third-tokyo':['report.md','verification.json','input-hashes.json'],'issue60-recheck-chiba-nov6':['README.md','assessment.json','verification.json','togane-map.jpg','togane-air.jpg','togane-seamlessphoto.png','raster-frames.json','asset-retrievals.json','raster-retrievals.json'],'issue60-flare-followup':['layout.pdf','layout.png','current-exterior.jpg','followup.json']}.items():
 for f in files:keep(pathlib.Path('/tmp')/folder/f)
protected=pathlib.Path('/tmp/kanto-remaining-recheck.md')
write('session.json',dict(reportedConfirmationDate='2026-11-06',receiptRecordedAt='2026-11-06T04:06:53Z',receiptTimeMeaning='今回依頼を読み照合中に時計で記録した時刻。メッセージ配送時刻は取得できず、撮影日・既往確認日とは別。',head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=R,text=True).strip(),protectedFileSHA256=sha(protected),sourcePhotographyDates=None,sourceEditMethods=None,redistributionPermission='not established; research copies only'))
write('user-report.json',dict(reportedConfirmationDate='2026-11-06',claims=[dict(number=6,coordinate=[35.73177,139.22852],previous=[35.73251,139.22867],statement='ロータリー南側横長敷地中央切妻屋内、駅→本棟→トイレ→交番の順。赤枠を屋内本体と指定。'),dict(number=11,coordinate=[35.25792,139.66228],statement='交番東10m白ブースを赤丸、交番青枠。'),dict(number=19,coordinate=[35.53986,140.34586],previous=[35.57685,140.38330],statement='レストラン東隣庇赤丸、マルシェ/道126等をラベル。常設精算ゲート。')],classification='利用者の対象指定。画像背景の観測・独立測量・公式の用途記載とは別。'))
d=json.loads((R/'data/evidence/kanto-prefecture/kanagawa/peninsula/kinugasa-comparison.json').read_text());r=d['rows'][1];a,b,c,e=r['feature']['geometry']['coordinates'][0][:4]
lerp=lambda p,q,t:[p[i]+(q[i]-p[i])*t for i in range(2)]
# 524's roadward quarter; interpretation support region, NOT surveyed booth boundary.
ring=[lerp(a,e,.75),lerp(b,c,.75),c,e];g=Polygon(ring);q=g.centroid;t=r['baseTile']
def ll(x,y):
 return [math.degrees(math.atan(math.sinh(math.pi*(1-2*(t['y']+y/4096)/2**t['z'])))),(t['x']+x/4096)/2**t['z']*360-180]
coord=[round(v,7) for v in ll(q.x,q.y)];scale=2*math.pi*6378137*math.cos(math.radians(coord[0]))/(2**16*4096)
lat,lon=coord;rounded=Point(((lon+180)/360*2**16-t['x'])*4096,((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**16-t['y'])*4096)
def distance(p,q):
 lat1,lon1,lat2,lon2=map(math.radians,p+q);h=math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2;return 6371008.8*2*math.asin(math.sqrt(h))
candidate=dict(number=11,facilityId='facility:kanto-south-b8a0f5c7b930cf13dc47',candidateId='issue60-annotated-aerial-11-524-roadward-v1',coordinate=dict(lat=lat,lng=lon),status='candidate_for_parent_independent_review',adoptionApproved=False,checkedAt='2026-11-06',source='国土地理院 optimal_bvmap-v1 を加工。Google数値・画素から座標を転記していない。',sourceFeatureId=r['feature']['id'],sourceGeometry=r['feature']['geometry'],baseTile=t,sourceSHA256=sha(R/'data/evidence/kanto-prefecture/kanagawa/peninsula/kinugasa-comparison.json'),method='524の道路側端の1/4帯の重心。帯は写真の浅いブースへの案内点選定用で、実測境界ではない。',supportRegionTileXY=ring,pointTileXY=[q.x,q.y],roundingWithinSupportRegion=g.contains(rounded),within524=shape(r['feature']['geometry']).contains(rounded),supportRegionWidthM=math.dist(c,e)*scale,supportRegionDepthM=math.dist(a,e)*scale/4,boundaryMarginM=g.boundary.distance(rounded)*scale,reportedPointDistanceM=distance(coord,[35.25792,139.66228]),uncertainty={'selectionRegion':'幅約4.3m・奥行約3.4mの前端帯内で中心を選ぶモデル。元画像の真の屋根境界精度ではない。','absoluteErrorBoundM':None,'risks':'航空写真の解像・屋根倒れ・ベクトル時点差、注記の太さ。数mのずれで隣壁・歩道へは出うる。','navigationImpact':'交番と東隣壁の間の道路側白ブースへの案内は支持。奥の525代表点を案内しない。窓口測量精度の保証なし。'},identityEvidence=['利用者赤丸は青交番枠の東隣・道路側','公式正面写真は左KOBANと右隣壁の間の浅い白ブース','GSI523/524/525と道路・駅の順序が一致'],independentReview='親が524道路側と赤丸/正面写真の対応を確認する。自動承認なし。')
write('candidate-11.json',candidate)
write('calculations.json',{'6':{'oldToNewDistanceM':distance([35.73251,139.22867],[35.73177,139.22852]),'latitudeSouthShiftM':distance([35.73251,139.22867],[35.73177,139.22867])},'19':{'oldToNewDistanceM':distance([35.57685,140.38330],[35.53986,140.34586])},'11':{'candidateCoordinate':coord,'reportedPointDistanceM':candidate['reportedPointDistanceM'],'within524':candidate['within524'],'withinSupportRegion':candidate['roundingWithinSupportRegion']}})
write('input-hashes.json',inputs)
assert candidate['within524'] and candidate['roundingWithinSupportRegion']
assert all(sha(O/x['copy'])==x['sha256'] for x in inputs)
write('verification.json',dict(inputCopiesHashMatched=len(inputs),limitedCalculationPassed=True,rawDecodeRun=False,fullSuiteRun=False,repoEdited=False,protectedFileSHA256=sha(protected),priorResults='11の旧最新点525内/524まで0.439mは既往計算を再利用。新点計算と区別。',adoptionApproved=False))
print(json.dumps({'coordinate':coord,'width':candidate['supportRegionWidthM'],'depth':candidate['supportRegionDepthM'],'distance':candidate['reportedPointDistanceM'],'calculations':json.loads((O/'calculations.json').read_text())},ensure_ascii=False))
