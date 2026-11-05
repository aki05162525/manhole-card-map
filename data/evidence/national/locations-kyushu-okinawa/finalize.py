import research as r,json,hashlib,pathlib,csv,io,datetime
from unresolved_notes import NOTES
P=json.load(open('data/overrides/regions/kyushu-okinawa.json'))['places'];U=json.load(open(r.ROOT/'verified-updates-by-index.json'));audit=json.load(open('data/national/regions/kyushu-okinawa.json'))
target={i for i,p in enumerate(P) if not p.get('coordinate')}
assert set(map(int,U)).isdisjoint(NOTES)
assert set(map(int,U))|set(NOTES)==target,(target-set(map(int,U))-set(NOTES),set(NOTES)-target)
refs={};unresolved=[];review=[]
def ref(x):
 if x.get('snapshotPath'):
  b=pathlib.Path(x['snapshotPath']).read_bytes();assert hashlib.sha256(b).hexdigest()==x['snapshotSHA256'],x
  original=next((m for m in r.OLD+r.records if m.get('snapshotPath')==x['snapshotPath']),{})
  refs[x['snapshotPath']]={**original,**x}
for i in sorted(NOTES):
 u,reason=NOTES[i];x=r.cache[u];ref(x);base=P[i]['evidence'];ref(base)
 result=('HTTP '+str(x['status']) if x.get('status') else str(x.get('error')))+'。'+reason
 unresolved.append({'facilityId':P[i]['id'],'attempts':[{'url':base['sourceUrl'],'result':'地域担当保存済み配布原本を再利用。配布施設の名称・住所と照合。'},{'url':u,'result':result}], 'reason':P[i]['name']+'（'+P[i]['address']+'）：'+reason})
 review.append({'facilityId':P[i]['id'],'index':i,'name':P[i]['name'],'address':P[i]['address'],'alternateSource':x,'reason':reason})
for i,v in U.items():
 ref(v['evidence']);ref(P[int(i)]['evidence'])
 # corroboration source remains separately traceable
 if int(i)==60:
  x=r.cache['https://www.mizunokagakukan.jp/access/'];ref(x)
  v['evidence']['verificationMethod']+=' 県CSVの住所は熊本市八景水谷までの表記のため、運営者アクセス '+x['url']+'（'+x['snapshotPath']+' SHA256='+x['snapshotSHA256']+'）の北区八景水谷1丁目11-1と同名施設を照合。'
for x in r.records:ref(x)
for p in json.load(open(r.ROOT/'coordinate-proof.json')):
 if isinstance(p['proof'],dict) and p['proof'].get('officialParent'):ref(p['proof']['officialParent'])
result={'schema':1,'region':'kyushu-okinawa','updates':[U[str(i)] for i in sorted(map(int,U))],'unresolved':unresolved}
out=pathlib.Path('data/national/location-updates/kyushu-okinawa.json');out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
(r.ROOT/'unresolved-research.json').write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n')
(r.ROOT/'referenced-snapshots.json').write_text(json.dumps(list(refs.values()),ensure_ascii=False,indent=2)+'\n')
# Keep unconfirmed distribution relations outside updates; no canonical facility is created.
legacy={p['id']:p for p in json.load(open('data/work/national-input/full.json'))['places']};candidates=[]
for card in audit['cards']:
 for rel in card['relations']:
  if rel.get('facilityId'):continue
  p=legacy[rel['legacyPlaceId']]
  item={'cardId':card['cardId'],'legacyPlaceId':rel['legacyPlaceId'],'name':p['name'],'address':p.get('address'),'distributionState':'unconfirmed','adoptAsDistribution':False,'originalReason':rel.get('remainingReason'),'attempts':rel.get('attempts',[]),'locationState':'unconfirmed','locationReason':'取得済み自治体公共施設CSV群の施設名・住所を照合したが、この入力施設（別館・窓口含む）の採用可能な目的地を確保できない。配布関係の保留は維持。'}
  if card['cardId']=='42-201-A001':
   z=next(z for z in json.load(open(r.ROOT/'selected-resources.json')) if z['dataset']=='422011_public_facility2');x=r.cache[z['resource']['url']];rows=list(csv.DictReader(io.StringIO(r.read(x))));row=rows[270];assert '南山手' in row['名称'];ref(x)
   item.update(locationState='candidate-building-point',coordinate={'lat':float(row['緯度']),'lng':float(row['経度'])},locationReason='長崎市CSVの南山手８番館（南山手地区町並み保存センター）、南山手町4-33と一致。建物位置のみの候補。カード配布関係の未確認を解消しない。',evidence={'sourceUrl':x['url'],'snapshotPath':x['snapshotPath'],'snapshotSHA256':x['snapshotSHA256'],'sourceLocator':'CSV論理レコード272 / 南山手８番館（南山手地区町並み保存センター） / 緯度・経度','checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actorType':'ai','verificationMethod':'市公開CSVの施設名と現在入力住所を照合。建物代表点であり室内窓口ではない。配布確定には使わない。'})
  candidates.append(item)
(r.ROOT/'unconfirmed-distribution-candidates.json').write_text(json.dumps({'schema':1,'region':'kyushu-okinawa','candidates':candidates},ensure_ascii=False,indent=2)+'\n')
validation={'targetFacilities':len(target),'coordinateUpdates':len(U),'unresolvedFacilities':len(unresolved),'alreadyLocatedExcluded':len(P)-len(target),'unconfirmedDistributionRelationsSeparatelyRecorded':len(candidates),'additionalCandidateCoordinates':sum('coordinate'in c for c in candidates),'uniqueIds':len({x['facilityId'] for x in result['updates']+unresolved}),'snapshotHashesVerified':len(refs),'newFetchManifestRecords':len(r.records),'allTargetsAssigned':True,'originalRegionalFilesNotWritten':True}
(r.ROOT/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n');print(validation)
