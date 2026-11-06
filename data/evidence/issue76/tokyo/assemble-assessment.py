"""Read-only assessment assembler; prints one county JSON. Run at repo root with python3 FILE COUNTY.
Uses frozen decisions and measured geometry evidence; does not approve or mutate any input.
"""
import json,sys,hashlib
from pathlib import Path
c=sys.argv[1]
N=Path('data/national/kanto-prefecture')/c
E=Path('data/evidence/kanto-prefecture')/c
A=Path('data/evidence/issue76')/c
load=lambda p:json.loads(Path(p).read_text())
hashrow=lambda r:hashlib.sha256(json.dumps(r,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
scope={'tokyo':N/'outcomes.json','kanagawa':N/'all-outcomes.json','chiba':E/'batch2/research-summary.json'}[c]
srcs={'tokyo':['integration/footprint-locations-proposal.json','integration/derived-held-locations-proposal.json'],'kanagawa':['locations-all-proposed.json'],'chiba':['batch2/locations-proposed.json']}[c]
selections={'tokyo':['integration/footprint-selection-proposal.json','integration/derived-held-selection-proposal.json'],'kanagawa':['selection-all-proposed.json'],'chiba':['batch2/selection-proposed.json']}[c]
lifecycles={'tokyo':['integration/footprint-lifecycle-proposal.json','integration/derived-held-lifecycle-proposal.json'],'kanagawa':['lifecycle-all-proposed.json'],'chiba':['batch2/location-lifecycle-proposed.json']}[c]
candidates={}
for p in srcs:
 for i,r in enumerate(load(N/p)['updates']):
  assert r['facilityId'] not in candidates
  candidates[r['facilityId']]=(str(N/p),i,r)
measure=load(A/'measurements.json');metrics={r['facilityId']:(i,r) for i,r in enumerate(measure['rows'])}
decisions=load(A/'decisions.json');out=[]
common=['docs/verification/issue76-common.md','data/evidence/issue76/common/product.json']
for i,r in enumerate(load(scope)['rows']):
 id=r['facilityId'];suf=id.removeprefix('facility:kanto-south-');rec,prior,reason,nextaction=decisions[suf]
 candidate=candidates.get(id); ev=[str(scope)+'#/rows/'+str(i),str(A/'decisions.json')+'#/'+suf]+common
 limitations=['新規の現地測量・原自治体画像の再読ではなく、既存読解・最新レビュー引継ぎと今回の距離評価。','原典の棟別精度、編集・総描、屋根/壁の差、測量時期は未確定部分がある。未知成分を0mとせず、普遍的な誤差半径は置かない。','配布関係・休止/終了・在庫は位置と別判断。原確認日2026-11-05、利用者回答日2026-11-06を維持。']
 if candidate: ev += [candidate[0]+'#/updates/'+str(candidate[1]),candidate[2]['evidence']['snapshotPath']+'#']
 if c=='chiba': ev.append(r['evidencePath']+'#')
 if c=='tokyo':
  if r.get('groupOutcomeRef'):ev.append(r['groupOutcomeRef'])
  if r.get('evidence') and isinstance(r['evidence'],str):ev.append(r['evidence']+'#')
  if r.get('candidate',{}).get('comparisonPath'):ev.append(r['candidate']['comparisonPath']+'#')
  if '/south/' in (candidate[2]['evidence']['snapshotPath'] if candidate else ''):ev.append(str(E/'south/inspection.json')+'#')
  if suf=='1a3833b4bda5568eaddb':ev.append(str(E/'review-corrections/corrections.json')+'#')
  if suf in ['1e2eb2c199aa90b834c0','cdc3bc3e1d850a2e973d','dfd35978e81cbcc80123','04903f9b604f31b843df','f8ee4ebfc645aa7894ed']:ev.append(str(E/'integration/human-answer-followup-20261106.json')+'#')
 if c=='kanagawa':
  if r.get('observationRef'):ev.append(r['observationRef']+'#')
  for ref in r.get('evidenceRefs',[]):
   if isinstance(ref,dict) and ref.get('path'):ev.append(ref['path']+'#')
  if candidate:
   p=Path(candidate[2]['evidence']['snapshotPath']); guesses=[p.parent/'observation.json',p.with_name(p.name.replace('-point','-observation')),p.with_name('sagamihara-inspection.json')]
   for g in guesses:
    if g.exists() and g!=p:ev.append(str(g)+'#')
 if suf=='e0a282f09bea26f727bf':reason+=' 既存holdoutは当該館で約3.97m、他棟約3.84–5.31m。境界余裕約4.50mに近く、内包保証とはしないが、隣棟まで約11.06mと配布矢印・別棟の配置から案内先の識別は維持されると提案する。'
 if suf=='52e07f72613c21d30eeb':reason+=' 資料館holdout差は約8.73mで境界余裕約9.19mに近い。略図の変形を含むため誤差上限にはせず、丸い端部と別棟引出線の対応を根拠にする。'
 metric=metrics.get(id);margin=None
 if metric and 'boundaryMarginMeters' in metric[1]:
  mi,m=metric;ref=str(A/'measurements.json')+'#/rows/'+str(mi);ev.append(ref)
  margin=m['boundaryMarginMeters']
  if m.get('selectedPortion'):margin=m['selectedPortion']['boundaryMarginMeters']
  other=m['nearestOtherFootprint'];road=m['nearestRoadCenterline']
  reason+=f" 今回の地上距離概算: 対象境界まで{margin}m、最寄り非重複外形まで{other['pointDistanceMeters']}m、道路中心線まで{road['pointDistanceMeters']}m。別外形には屋根・同施設の付属棟も含み、道路端までの距離ではない。"
  if m.get('overlappingUnselectedFeatures'):limitations.append('対象と重なる非選択外形はmeasurementsに別記し、対象境界へ結合せず非重複の近傍距離から除外。これらの距離を施設間の最小距離とは呼ばない。')
  if m['tilesMissing']:limitations.append('周辺3×3タイルのうち未保存範囲あり。距離は保存範囲内の最近傍であり、測定対象・欠落タイルはmeasurementsに明示。対象外形の既存全形確認を継承。')
  uncertainty='共通製品評価を適用。保存PBFの同一版・extent4096・原feature・XYZ逆投影を継承し、丸め後の提案点から境界/近傍外形/RdCLまでを局所cos補正して追加測定。格子約0.12mや小数7桁を位置精度としない。建物と周辺の独立配置・写真照合は以下のbuildingAssessmentと参照先の既存観察を継承する。定量残差がない照合は定性的根拠であって0m一致ではない。'
 else:
  uncertainty='共通製品評価は参照するが、本件は現棟/受付対応、対象外形欠落または追加変換の個別不確かさが残る。元図・fitの残差や格子精度を対象建物の絶対精度へ転用しない。意味のある対象建物境界の距離を計算できないためnullとする。'
 ev=list(dict.fromkeys(ev))
 out.append({'facilityId':id,'name':r['name'],'sourceLocationPath':candidate[0] if candidate else None,'sourceLocationSHA256':hashrow(candidate[2]) if candidate else None,'originalReviewDecision':prior,'recommendation':rec,'positionSuitability':{'status':'acceptable' if rec=='propose' else 'held','evidence':ev,'uncertaintyBasis':uncertainty,'buildingAssessment':reason},'boundaryMarginMeters':margin,'boundaryMarginMethod':str(A/'measurements.json')+'#/method' if margin is not None else None,'limitations':limitations,'nextAction':nextaction})
assert len(out)=={'tokyo':24,'kanagawa':14,'chiba':17}[c]
assert len({r['facilityId'] for r in out})==len(out)
assert len(decisions)==len(out)
result={'schema':1,'county':c,'baselineCommit':'888f61936aad65ea41c6e0105aed01c3acd1bd2a','asOf':'2026-11-05','assessmentDate':'2026-11-06','sourceSelectionPaths':[str(N/p) for p in selections],'sourceLifecyclePaths':[str(N/p) for p in lifecycles],'selectionPolicy':'Latest consolidated proposals only. Do not also select initial or regional duplicates. Proposal fields named approved in inherited fragments do not constitute this assessment approval. Held rows must not be integrated.','reviewProvenance':{'source':'Implementation assignment from parent, including latest final Codex findings. Not independently re-reviewed here.','tokyoResearchFinalHead':'6fe605d6' if c=='tokyo' else None,'statusMeaning':'supported/plausible/held describe inherited building-identity review, not adoption approval. acceptable/propose here are implementation proposals for independent review.','researchRecords':'Original research outcomes predate the supplied final reviews; preserve their historical pending wording.'},'commonEvidence':{'paths':common,'readFrom':'/home/akihiro/personal/manhole-card-map','status':'read; no copy added to this checkout','scope':'Same 2026-07-01 PMTiles ETag dfa81a9cba11aad28247d63a2d8361ec-2015, BldA and existing XYZ processing. Does not automatically apply to plan-derived or rail-projected points.','unknowns':'No per-building absolute error ceiling; local evidence judged qualitatively without treating unknown error as zero.'},'candidateCoordinateChanges':[],'outcomes':out}
print(json.dumps(result,ensure_ascii=False,indent=2))
