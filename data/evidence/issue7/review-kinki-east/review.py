"""Read-only verification of inputs; writes only the two authorized review destinations."""
import json,re,hashlib,zipfile,io,math,datetime
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse
R=Path('data/evidence/issue7/review-kinki-east')
OUT=Path('data/national/issue7/reviews/kinki-east.json')
INPUT=Path('data/national/issue7/kinki-east.json')
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(p,x):Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
class Text(HTMLParser):
 def __init__(self,b):
  super().__init__();self.parts=[];self.skip=0
  m=re.search(br'charset=["\s]*([\w-]+)',b[:5000]);enc=m[1].decode() if m else 'utf-8';self.feed(b.decode(enc,errors='replace'))
 def handle_starttag(self,t,a):
  if t in ('script','style'):self.skip+=1
 def handle_endtag(self,t):
  if t in ('script','style'):self.skip=max(0,self.skip-1)
 def handle_data(self,d):
  if not self.skip:self.parts.append(d)
 def text(self):return re.sub(r'\s+',' ',' '.join(self.parts)).strip()
def txt(p):return Text(Path(p).read_bytes()).text()
def distance(a,b):
 la,lb=map(math.radians,[a[1],b[1]]);dl=math.radians(b[0]-a[0]);dt=lb-la
 return 6371008.8*2*math.asin(math.sqrt(math.sin(dt/2)**2+math.cos(la)*math.cos(lb)*math.sin(dl/2)**2))
def norm(s):return s.replace('大字','').replace('番地','-').replace('番','-').replace('の','-')
p=read(INPUT);ledger=read('data/work/issue7-baseline/ledger.json');places={x['id']:x for x in ledger['places']}
assignment=read('data/work/issue7-baseline/assignments.json')['kinki-east']
prov=read('data/evidence/issue7/kinki-east/source-provenance.json');new=read(R/'fetch-log.json');by_path={x['snapshotPath']:x for x in prov+new if 'snapshotPath' in x}
protected=[INPUT,Path('cmd/builddata/ledger.go'),Path('data/work/issue7-baseline/hashes.json')]+list(Path('data/work/issue7-baseline').glob('*.json'))+list(Path('data/evidence/issue7/kinki-east').rglob('*'))+[Path('data/national/issue5/kinki.json'),Path('data/national/issue5/kinki-reviewed.json')]
protected={str(x):sha(x) for x in protected if x.is_file()}
checks=[]
for x in prov+new:
 if 'snapshotPath' in x:
  actual=sha(x['snapshotPath']);assert actual==x['snapshotSHA256'],x['snapshotPath'];checks.append({'path':x['snapshotPath'],'sha256':actual,'matches':True})
fixed=read('data/work/issue7-baseline/hashes.json')
for name,h in fixed.items():assert sha('data/work/issue7-baseline/'+name)==h
assert sha('data/work/issue7-baseline/hashes.json')==read('data/evidence/issue7/kinki-east/input-checksums.json')['hashesFileSHA256']
code=Path('cmd/builddata/ledger.go').read_text();body=re.search(r'type Evidence struct \{(.*?)\n\}',code,re.S)[1];fields=re.findall(r'`json:"([^"]+)"`',body);assert len(fields)==7
zpath=p['updates'][0]['evidence']['snapshotPath'];z=zipfile.ZipFile(zpath);geo={};members={};raw_geo={}
for pref in ['24','25','26']:
 member='P05-22_'+pref+'_GML.zip';iz=zipfile.ZipFile(io.BytesIO(z.read(member)));gn='P05-22_'+pref+'.geojson';b=iz.read(gn);geo[pref]=json.loads(b);raw_geo[pref]=json.loads(b,parse_float=str,parse_int=str);members[pref]={'archiveMember':member,'geojsonMember':gn,'geojsonSHA256':hashlib.sha256(b).hexdigest()}

def reference(path,locator,quote=None):
 x=by_path[str(path)];r={k:x[k] for k in ['sourceUrl','snapshotPath','snapshotSHA256']};r['sourceLocator']=locator
 if quote:r['excerpt']=quote;assert quote in txt(path)
 return r

def newer(part,locator):
 x=next(x for x in new if part in x['sourceUrl']);return reference(x['snapshotPath'],locator)
notes=[
'公式配布案内は甲賀地域市民センター・相模173番地1。市アクセス案内の同一施設節で甲賀地域市民センター見出しと甲賀大原地域市民センターの電話表記を併記。名称差だけの推測ではない。P05の甲賀支所568・甲賀大原市民センター582・584はいずれも約1m以内で、584を建物代表点として採用する。',
'配布案内は料金お客様サービスセンターを元町4番2号の彦根市役所1階と明記。独立取得した当該センター専用ページも市役所1階11番窓口を指定。上下水道部の別課や中央町別館への住所流用ではなく、P05市役所285と対応する。',
'配布案内の土日祝欄がふるさとセンター2階歴史資料館・竜光3を明示。P05ふるさとセンター817に名称・住所が一致。平日の役場816とは分離する。',
'配布案内のひと・まち街道交流館・水口町八坂7番4号とP05同名558が対応。同住所の水口地域市民センター629等との数m差は一覧に記録するが、同名施設点を優先できる。徒歩7分離れたみなくるプラザ駐車場の座標は不使用。',
'配布案内が駅前総合案内所・梅田町1-9、守山駅西口隣接を明示。P05の個別案内所513を選択。駅全体の点や市役所の点を流用していない。',
'配布案内は上下水道課を役場庁舎2階と明示。P05役場823と一致。同住所の中央公民館824は異なる名称・異なる点であり選択しない。',
'配布案内の平日窓口は役場2階・円明寺夏目3。P05役場816と一致。休日のふるさとセンター817とは別建物として扱う。',
'配布案内は東員町役場上下水道課、所在地は山田1600。P05町役場1114を選択。同番地の総合体育館1113・保健福祉センター1115・大字表記付き武道館1120は別名称・別点として除外する。',
'公式配布場所欄は東員町役場上下水道課に続けて休日は執行時間外受付と指定。同じ役場の建物代表点1114を共有する合理的根拠がある。台帳の守衛室という室名を改名する判断ではない。体育館・保健福祉センター・武道館の点は除外する。',
'配布案内は大宮庁舎2階・口大野226。市庁舎案内は経営総務課と大宮市民局を同庁舎2階に列挙する。P05庁舎693と市民局694は約3m差。2026年4月24日公式資料も大宮庁舎を改修と明示し、上下水道部の丹後庁舎から大宮庁舎への業務開始を5月25日と記載。配布記事の5月25日更新と整合するため、一時移転を無視せず現大宮庁舎の点を採用する。',
'配布表が総合文化センター事務室・岩山沼尻46-1を明示。P05同名836と対応。役場の立川坂口18-1とは住所・建物を区別している。',
'配布表が役場上下水道課・立川坂口18-1を明示。独立取得した役場庁舎案内もこの住所と新庁舎への交通を案内。P05役場837の原属性も同住所で、旧役場住所の点を採用していない。',
'配布案内は宿直室を役場庁舎1階、平日窓口を同庁舎2階と明示。同じP05役場823を共有できる。中央公民館824は同住所でも対象棟ではない。',
'配布表の土日祝欄は野洲市役所宿日直室・小篠原2100番地1でありP05市役所673に対応。西河原2400の平日窓口とは別施設。宿日直室の室内精度を追加条件にしない。',
'配布案内が草津宿街道交流館・草津3丁目10番4号を明示。P05同名472と対応。代替配布先の市役所や別カードの夢本陣と混同しない。',
'配布案内が交流館休館日の代替先を市役所2階・草津三丁目13番30号と明示。P05市役所466に対応。同住所の市民総合交流センター452・草津アミカホール465は別名称・別点で除外。'
]
anchors=[('甲賀地域市民センター（住所',130),('上下水道料金お客様サービスセンター（彦根市',85),('土日祝 9：30',150),('甲賀市ひと・まち街道交流館 （住所',80),('守山市駅前総合案内所（住所',75),('平日：久御山町役場',115),('平日 8：30',130),('配布場所 東員町役場',120),('配布場所 東員町役場',120),('平 日：京丹後市役所大宮庁舎',170),('総合文化センター 事務室',95),('役場 上下水道課 宇治田原町大字立川',90),('平日：久御山町役場',115),('【土日祝】 野洲市役所宿日直室',100),('配布場所 草津宿街道交流館',90),('なお、毎週月曜',220)]
reviews=[]
for i,u in enumerate(p['updates']):
 fid=u['facilityId'];assert fid in places and fid in assignment;ev=u['evidence'];assert set(ev)==set(fields)
 assert all(isinstance(ev[k],str) and ev[k].strip() for k in fields)
 url=urlparse(ev['sourceUrl']);assert url.scheme in ['http','https'] and url.netloc and url.username is None
 datetime.date.fromisoformat(ev['checkedAt']);assert ev['actorType'] in ['ai','human'];assert sha(ev['snapshotPath'])==ev['snapshotSHA256']
 pref,idx=re.search(r'P05-22_(\d+)_GML.zip.*features\[(\d+)\]',ev['sourceLocator']).groups();idx=int(idx);g=geo[pref];f=g['features'][idx];coords=f['geometry']['coordinates'];assert coords==[u['coordinate']['lng'],u['coordinate']['lat']];assert u['scope']=='building';assert 120<coords[0]<150 and 20<coords[1]<50
 raw=raw_geo[pref]['features'][idx]['geometry']['coordinates'];crs=g['crs'];assert crs['properties']['name']=='urn:ogc:def:crs:EPSG::6668'
 # Locate provenance independently from the supplied excerpt, then inspect actual HTML.
 path=re.search(r'現配布原本: (\S+)',ev['sourceLocator'])[1];s=txt(path);term,n=anchors[i];pos=s.find(term);assert pos>=0,(i,term);quote=s[pos:pos+n]
 refs=[reference(path,'公式配布場所本文: '+term,quote)]
 if i==0:refs.append(newer('1119.htm','甲賀地域市民センター節の住所・甲賀大原地域市民センター電話欄'))
 if i==1:refs.append(newer('29782.html','2. センターの場所および連絡先（彦根市役所1階）'))
 if i==9:
  refs += [newer('6116.html','所在地・2階の経営総務課/大宮市民局'),newer('20260401.pdf','2026-04-24 PRESS RELEASE / 工期・集約化配置に伴う移転一覧、添付庁舎案内の大宮庁舎2F')]
 if i==11:refs.append(newer('518.html','所在地と新庁舎への交通案内'))
 alternatives=[]
 for j,other in enumerate(g['features']):
  if norm(other['properties']['P05_004'])==norm(f['properties']['P05_004']):
   alternatives.append({'featureIndex':j,'name':other['properties']['P05_003'],'address':other['properties']['P05_004'],'coordinates':other['geometry']['coordinates'],'distanceFromSelectedMetres':round(distance(coords,other['geometry']['coordinates']),3),'selected':j==idx})
 reviews.append({'facilityId':fid,'status':'accepted','scope':'building','baselineName':places[fid]['name'],'baselineAddress':places[fid]['address'],'coordinate':u['coordinate'],'reason':notes[i],'coordinateEvidence':ev,'originalRecord':{**members[pref],'featureIndex':idx,'feature':f,'originalCoordinateLexemes':raw,'sourceAxisOrder':['longitude','latitude'],'destinationAxisMapping':{'lat':'coordinates[1]','lng':'coordinates[0]'},'crs':crs,'datum':'JGD2011','unit':'decimal degrees','transformation':'none; catalog B,L notation does not reverse GeoJSON serialized longitude,latitude','sourceZipSHA256':sha(zpath)},'buildingEvidence':refs,'sameAddressRecords':alternatives,'checks':{'facilityIdInFixedLedger':True,'facilityIdInAssignment':True,'coordinateMatchesOriginalExactly':True,'snapshotHashMatches':True,'goEvidenceSevenFields':True,'buildingCorrespondence':'reasonable official name/address/building designation','entranceOrIndoorAccuracyRequired':False,'noGlobalRenovationAbsenceProofRequired':True},'termsAssessment':'P05-open-data-PDL1.0; see shared licenseReview; HTML full redistribution separately unverified','baselineRelationsPreserved':[{'cardId':r['cardId'],'status':r['status'],'condition':r.get('condition')} for r in ledger['relations'] if r['placeId']==fid],'requiredCorrections':[]})
assert len(reviews)==16 and len({x['facilityId'] for x in reviews})==16
c=p['corrections'][0];oldrow=next(x for x in read(c['targetPath'])['unresolved'] if x['facilityId']==c['facilityId']);assert oldrow['reason']==c['old']
for e in c['evidence']:assert set(e)==set(fields) and sha(e['snapshotPath'])==e['snapshotSHA256']
ctxt=txt(c['evidence'][0]['snapshotPath']);floor=txt(c['evidence'][1]['snapshotPath']);assert '在庫が切れています' in ctxt and '本庁舎5階' in ctxt and '分庁舎2 シルバー人材センター' in floor and '下水道施設課' in floor
correction={**c,'status':'accepted','kind':'research-explanation-only','exactOldMatched':True,'independentReason':'配布記事は在庫切れを述べ、問い合わせ先を本庁舎5階とする。庁舎案内は下水道施設課を本庁舎5階、分庁舎2をシルバー人材センターとする。問い合わせ先を再開後の配布窓口と断定せず、旧分庁舎2の関係を維持する旧理由訂正として妥当。','coordinateDecision':'deferred; no coordinate proposed for old annex 2','applyState':'proposal only; target untouched','prohibitedSideEffects':['coordinate replacement','facility rename','address change','distribution status change','relation change']}
legacy='data/evidence/issue5/kinki/README.md';builder='data/evidence/issue5/kinki/build.py';oldledger=read('data/work/issue5-baseline/ledger.json');inherited=next(x for x in oldledger['places'] if x['id']=='facility:kinki-2d25fa4fd7e5424d29b7')['evidence']['sourceLocator'];assert '終了状態の訂正を変えず旧配布施設' in inherited
corrected=next(x for x in read('data/national/issue5/kinki-reviewed.json')['updates'] if x['facilityId']=='facility:kinki-neyagawa-holiday')['evidence']['sourceLocator'];assert '終了状態の訂正を変えず旧配布施設' not in corrected and 'suspended' in corrected
mismatches=[{'documentPath':legacy,'codePath':builder,'documentClaim':'寝屋川はsuspended維持、末尾は文書とコードの食い違いを検出していないとする。','codeBehavior':'build.pyは旧台帳のEvidenceをコピーしてsourceLocatorへ追記するため、旧台帳の「終了状態の訂正を変えず旧配布施設」を残す。','followed':'コードの継承・追記動作を根拠とする。実行・修正はしない。','history':'旧issue5独立レビュー後のdata/national/issue5/kinki-reviewed.jsonでは修正済み。今回16候補には寝屋川を含まず、現候補の欠陥に数えない。'}]
result={'schema':1,'region':'kinki-east','reviewType':'independent-adoption-review','reviewedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'input':{'path':str(INPUT),'sha256':sha(INPUT)},'instructions':{'agents':'User-supplied AGENTS.md instructions read; no AGENTS.md found in repository or ancestor paths checked.','writeScope':[str(OUT),str(R)+'/'],'buildingRepresentativePointSufficient':True},'summary':{'coordinateCandidateCount':16,'accepted':16,'deferred':0,'correctionRequired':0,'oldReasonCorrectionsReviewed':1,'oldReasonCorrectionsAccepted':1,'remaining38FullyInvestigated':False},'acceptedFacilityIds':[r['facilityId'] for r in reviews],'deferredFacilityIds':[],'correctionRequiredFacilityIds':[],'reviews':reviews,'corrections':[correction],'additionalExactOldNewCorrections':[], 'licenseReview':{'catalog':newer('KsjTmplt-P05','このデータの使用許諾条件・データ基準年月日・座標系'),'generalTerms':newer('agreement.html','著作権について・附則・1.1出典・適用除外'),'p05IndividualCondition':'適用する利用規約に基づく（オープンデータ）。P05に一部制限指定はない。','generalRule':'一般規約は2026-03-23施行、権利表記がない限りPDL1.0。一般規約にあるCC BY 4.0一部制限等は個別指定データ向けでP05へ一律適用しない。','requiredAttribution':'国土数値情報（市町村役場等及び公的集会施設データ）、国土交通省、P05-22（2022年）、https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-v3_0.html をもとに施設を選別・対応付け。','coordinateFacts':'P05座標と公式施設名・住所の事実を採用。同定用自治体HTMLにP05のライセンスを拡張しない。','fullHtmlExternalRedistribution':'未確認。原本取得・監査用保存はページ全文や写真・地図の外部再配布許諾を意味しない。座標採否と別の判断。','noPublicationPerformed':True},'validation':{'detailsPath':str(R/'validation.json'),'sourceProvenanceHashesVerified':len(prov),'newSnapshotsVerified':len(new),'goEvidenceFieldsFromCode':fields,'goTestExecuted':False,'goValidationMethod':'Read actual Evidence struct and validateEvidence; independently checked exact keys, types, URL, date, actor, nonempty locator/method and snapshot hashes in Python. No Go tests or build caches written.','fixedBaselineHashes':fixed,'coordinateTransformationApplied':False},'documentationCodeMismatches':mismatches,'limitations':['現地測量・入口/室内窓口精度を保証しない。','P05は2022年4月基準。公式現施設との合理的対応を確認したもので全施設の改修不存在証明ではない。','入力の残38件の全深掘り完了を主張しない。','本レビューは採用判断の保存のみ。元成果・manifest・固定入力・コード・配布状態・旧関係を変更しない。']}
for path,h in protected.items():assert sha(path)==h,path
OUT.parent.mkdir(parents=True,exist_ok=True);write(OUT,result)
write(R/'validation.json',{'checkedAt':result['reviewedAt'],'inputHashes':protected,'protectedInputsUnchangedDuringReviewScript':True,'baselineHashesMatchDeclared':True,'snapshotChecks':checks,'candidateCount':16,'evidenceFieldNames':fields,'exactOldReasonMatches':True,'allCandidateValuesFromZipMatch':True,'allStatuses':'accepted','readmeCodeMismatchCount':len(mismatches),'outputPath':str(OUT),'outputSHA256':sha(OUT)})
print(json.dumps(result['summary'],ensure_ascii=False));print('review SHA256',sha(OUT))
