"""Generate reviewable patches/additions and a strict, temporary merged ledger. Never edit inputs."""
import json,copy,pathlib,hashlib,shutil
B=pathlib.Path('data/evidence/national/kanto-south-integration');P='data/work/national-input/places.json';R='data/overrides/regions/kanto-south.json'
load=lambda p:json.loads(pathlib.Path(p).read_text())
p=load(P);r=load(R);audit=load('data/national/regions/kanto-south.json');full=load('data/work/national-input/full.json');q=load('/tmp/ks-integration-baseline/quality.json')['sourceHashes']
m={x['url']:x for x in load(B/'manifest.json')};patches=[];dups=[];findings=[]
def ev(e,locator=None):
 e=copy.deepcopy(e);z=m.get(e['sourceUrl'])
 if z and z.get('status')==200:e.update(snapshotPath=z['snapshotPath'],snapshotSHA256=z['sha256'])
 if locator:e['sourceLocator']=locator
 e['verificationMethod']='AIが原典の当該デザイン・窓口・条件を独立再照合。現地確認ではない。'
 return e

def patch(file,collection,old,new,reason,kind='correction'):
 if old!=new:patches.append(dict(sourceFile=file,collection=collection,key={k:old[k] for k in (['id'] if collection=='places' else ['cardId','placeId'])},previous=old,replacement=new,reason=reason,classification=kind,evidence=new['evidence']))

# Shared facilities are byte-for-byte object equal, including coordinate evidence.
for x in r['places']:
 y=next((y for y in p['places'] if y['id']==x['id']),None)
 if y:
  assert x==y;dups.append(dict(kind='facility',id=x['id'],decision='identical-object-deduplication',previousPilot=y,previousRegion=x))
for x in r['relations']:
 y=next((y for y in p['relations'] if (y['cardId'],y['placeId'])==(x['cardId'],x['placeId'])),None)
 if not y:continue
 cid=x['cardId'];chosen=copy.deepcopy(y);reason='原典の同一配布時刻・状態を表す句読点・配列分割・要約差。pilotの窓口別記述を採用。';kind='wording'
 if cid in ['13-224-A001','14-208-A001']:
  reason='地域版は別窓口の曜日・時間を同じhoursへ併記。pilotの当該窓口だけの条件を採用し、平日と休日を混同しない。';kind='semantic'
 if cid=='14-201-A001':reason='pilotの12月30日15時までの施設短縮営業注意を保持。市のカード欄17時と施設の短縮営業は区別して記載。';kind='omission'
 if cid=='14-201-B001':reason='pilotにある1人1枚・アンケートは同じ原典の共通配布条件に明記され、地域要約では欠落。保持。';kind='omission'
 if cid=='14-206-F001':
  chosen=copy.deepcopy(x);reason='カード専用公式ページに夏期7～9月末の平日休館・10～13時を明記。pilotの通年木～日10～16時では夏期を誤案内するため地域値を採用。';kind='semantic'
 if cid=='14-206-D001':
  chosen=copy.deepcopy(x);chosen['status']='ended';reason='カード全体の休止とラスカ旧窓口で2025年12月末に終了した関係を区別。旧窓口関係はended、再開先は未定。';kind='semantic'
 chosen['evidence']=ev(chosen['evidence'])
 patch(P,'relations',y,chosen,reason,kind);patch(R,'relations',x,chosen,reason,kind)
 dups.append(dict(kind='relation',cardId=cid,placeId=x['placeId'],classification=kind,reason=reason,previousPilot=y,previousRegion=x,selected=chosen))

# Rechecked current-source changes; these alone receive a new fingerprint.
for cid in ['12-100-B001','13-206-A001','13-207-A001','13-214-E001']:
 for x in r['relations']:
  if x['cardId']==cid:
   n=copy.deepcopy(x);n['sourceHash']=q[cid];n['evidence']=ev(x['evidence'])
   patch(R,'relations',x,n,'現公式を再取得し当該カード本文を確認。幕張通常窓口再開／府中10月27日再開／昭島11月1日変更／国分寺E在庫切れの各該当記述により現hashを採用。','reverified-current-source')

# Current GKP row has explicit P101 time. Keep bytes from parent's immutable snapshot.
shutil.copyfile('/tmp/gkp-current-design.html',B/'gkp-current-design.html')
gkp=dict(sourceUrl='https://www.gk-p.jp/mhcard/?pref=zenkoku',snapshotPath=str(B/'gkp-current-design.html'),snapshotSHA256=hashlib.sha256((B/'gkp-current-design.html').read_bytes()).hexdigest(),sourceLocator='13-100-P1-01.jpgの行／全国観光PRコーナー／配布時間',checkedAt='2026-11-05',actorType='ai',verificationMethod='親が2026-11-05取得した現一覧の画像URLで当該行を特定し、全国観光PRコーナーと時間を再確認。自分での再GETではない。')
for x in r['relations']:
 if x['cardId']=='13-100-P101':
  n=copy.deepcopy(x);n.update(sourceHash=q[x['cardId']],hours=['9:30～18:30。年末年始・都庁点検日は休業。'],evidence=gkp)
  patch(R,'relations',x,n,'都下水道局ページには独立時間がないが現GKPの当該カード行は配布時間を明記。旧臨時2窓口は行から削除され、恒常窓口のみ再確認。','missing-hours')

# Empty hours can be filled from the current GKP distribution-time column,
# after reading each matching image row, not from unrelated facility opening hours.
empty_hours={
 '12-222-A001':['5月1日～8月31日9:00～18:00、9月1日～4月30日9:00～16:00。入館は閉館30分前まで。月曜（祝日の場合は次の平日）・年末年始休み。'],
 '13-100-B001':['9:30～16:30（入館16:00まで）。月曜（祝休日なら翌日）・12月29日～1月3日休み。夏休みは無休、9月10日・10月1日は開館。'],
 '13-100-L101':['10:30～18:00。火曜・施設点検日休み。'],
 '13-100-R001':['10:00～18:00。1月1日・2日、施設点検日（不定期）休み。'],
 '13-211-B001':['10:00～16:00。月曜（休祝日なら直近の平日）・12月27日～1月5日休み。']}
for x in r['relations']:
 if x['cardId'] not in empty_hours and x['cardId']!='13-100-T001':continue
 if x['cardId']=='13-100-T001':
  h=['9:00～17:00。土日祝・年末年始休み。'] if x['placeId'].endswith('7de2d99857f5a3b327f4') else ['9:00～17:00。月曜（休日・祝日は開館）・年末年始休み。展示替え等の臨時休館あり。']
 else:h=empty_hours[x['cardId']]
 n=copy.deepcopy(x);n.update(hours=h,evidence=dict(gkp,sourceLocator=x['cardId']+'／当該カード画像の行・当該窓口の配布時間列'))
 patch(R,'relations',x,n,'地域根拠では独立時間の記載不足として空だったが、現GKPの当該カード配布時間列を窓口単位で再照合し補完。元の自治体/指定管理者案内の配布場所・状態と整合。','missing-hours')

add={'schema':1,'places':[],'relations':[]};outcomes=[]
def newplace(key,name,address,e):
 id='facility:kanto-south-integration-'+key
 if not any(x['id']==id for x in add['places']):add['places'].append(dict(id=id,legacyIds=[],name=name,address=address,phone='',evidence=e))
 return id
raws=[
'【平日】八千代市上下水道局1階　お客様センター（工事）窓口',
'【土曜日・日曜日・祝日】株式会社八千代市水道サービス（宿直対応）',
'治水課（市役所6階）', '配布日時：月曜日、郷土博物館休館日（祝日、年末年始を除く）午前9時から午後5時',
'袖ケ浦市役所　南庁舎1階　袖ケ浦市観光協会（袖ケ浦市坂戸市場1番地1）',
'なお、休館日（年末年始を除く）は、板橋区くらしと観光課窓口で配布します。',
'（注釈）臨時休業の場合がございます。その際にはテクノプラザかつしか（葛飾区青戸7-2-1）で配布を行います。配布時間帯等は、「リカちゃん」マンホールカードと同一です。',
'注：令和8年10月26日（月曜日）～11月13日（金曜日）は下記の「ヴェルニー公園管理事務所」にて配布します。',
'江戸川区SDGs推進部広報課窓口（江戸川区中央1丁目4番1号　江戸川区役所本庁舎3階1番）',
'三浦海岸駅前観光案内所',
'場所：オーエンス文化会館 第二駐車場（南側）（予定）',
'★11月24日（火曜日）以降も在庫がある限り配布します。']
addresses={4:'千葉県袖ケ浦市坂戸市場1番地1 南庁舎1階',6:'東京都葛飾区青戸7-2-1',7:'神奈川県横須賀市汐入町1-1 ヴェルニー公園内',8:'東京都江戸川区中央1丁目4番1号 本庁舎3階1番',10:'綾瀬市深谷中一丁目3番1号（市民文化センター）第二駐車場南側',11:'神奈川県綾瀬市早川550番地 市役所5階'}
hours={0:'平日8:30～17:00。12月29日～1月3日配布なし。',1:'土日祝8:30～17:00。12月29日～1月3日配布なし。',2:'月～金9:00～17:00。祝日・年末年始除く。',3:'月曜日・郷土博物館休館日9:00～17:00。祝日・年末年始除く。',4:'平日9:00～16:30。',5:'いたばし観光センター休館日（年末年始除く）9:00～17:00。',6:'丸吉玩具店の臨時休業時のみ8:30～18:00。年末年始・年4回のメンテナンス休館日除く。',7:'2026年10月26日～11月13日9:00～16:00。',8:'平日のみ8:30～17:00。',9:'平日・休日9:30～17:00。12月28日～1月3日休み。',10:'2026年11月22日9:00～15:00予定。荒天中止の場合あり。在庫限り。',11:'2026年11月24日以降9:00～16:00予定。在庫がある場合のみ。11月23日は配布なし。'}
for i,x in enumerate(audit['proposals']):
 cid=x['cardId'];e=ev(x['evidence']);e['sourceLocator']+='／'+('トミカ・丸吉玩具店休業時（マカロンではない）' if i==6 else '追加窓口の条件を再確認')
 if i==10:
  z=m['https://www.city.ayase.kanagawa.jp/location/library/genre/publicfacility/17263.html'];pe=dict(e,sourceUrl=z['url'],snapshotPath=z['snapshotPath'],snapshotSHA256=z['sha256'],sourceLocator='施設詳細／所在地。第二駐車場南側の窓口指定は配布案内を参照')
 elif i==11:
  z=m['https://www.city.ayase.kanagawa.jp/soshiki/kanzaikeiyakuka/kanzaitanto/3/4714.html'];pe=dict(e,sourceUrl=z['url'],snapshotPath=z['snapshotPath'],snapshotSHA256=z['sha256'],sourceLocator='所在地／神奈川県綾瀬市早川550番地。5階は配布案内を参照')
 else:pe=e
 if i==6:pid='facility:kanto-south-19fb7af08ecd8af0ff2c'
 else:pid=newplace('urayasu-chisui' if i in [2,3] else str(i+1).zfill(2),x['name'],addresses.get(i,x['address']),pe)
 previous=[]
 if i in [0,1]:previous=[['place:20dd42a34f9be9a03e08','place:9b56cb13cd1e7c1d014e'][i]]
 if i==2:previous=['place:035a6ca5b25c2ca50a21']
 if i==7:previous=['place:6395cd4a64b6b5ba4d71']
 rel=dict(cardId=cid,placeId=pid,sourceHash=q[cid],hours=[hours[i]],condition=hours[i],status='upcoming' if i>=10 else 'active',evidence=e,change=dict(kind='addition',reason='現公式配布案内に明記された追加窓口。旧関係は保持し自動終了しない。'+('元proposalのマカロン条件は別カードの節であり、トミカの丸吉玩具店臨時休業へ訂正。' if i==6 else ''),previousPlaceIds=previous,raw=[raws[i]]))
 if i==7:rel.update(validFrom='2026-10-26',validTo='2026-11-13')
 if i==10:rel.update(validFrom='2026-11-22',validTo='2026-11-22',reviewUntil='2026-11-21')
 if i==11:rel.update(validFrom='2026-11-24',reviewUntil='2026-11-23')
 add['relations'].append(rel);outcomes.append(dict(proposalIndex=i,cardId=cid,decision='adopted-with-correction' if i==6 else 'adopted',placeId=pid,reason=rel['change']['reason'],evidence=e))

# Register legacy rows separately: no automatic termination from the addition.
for idx,legacy in enumerate(['place:20dd42a34f9be9a03e08','place:9b56cb13cd1e7c1d014e']):
 old=next(x for x in full['places'] if x['id']==legacy);e=ev(audit['proposals'][idx]['evidence'],'配布について／上記配布場所でのみ配布しています（旧窓口の非継続判断）')
 pid='facility:kanto-south-integration-legacy-yachiyo-'+str(idx);add['places'].append(dict(id=pid,legacyIds=[legacy],name=old['name'],address=old['address'],phone=old.get('phone',''),evidence=e))
 add['relations'].append(dict(cardId='12-221-A001',placeId=pid,sourceHash=q['12-221-A001'],hours=['現公式はお客様センター（工事）・大和田新田の宿直窓口でのみ配布と明記。旧窓口の終了日・部署継承は未確定。'] if idx==0 else ['萱田町596-19の旧配布先は終了。現公式は大和田新田312-5でのみ配布と明記。旧所在地の最終配布日は未確定。'],status='unknown' if idx==0 else 'ended',evidence=e))
# Urayasu old desk remains independently unknown, because both departments exist.
legacy='place:035a6ca5b25c2ca50a21';old=next(x for x in full['places'] if x['id']==legacy);e=ev(audit['proposals'][2]['evidence'],'第12弾・現配布窓口治水課。道路整備課との継承／終了日を明記していない')
pid='facility:kanto-south-integration-legacy-urayasu';add['places'].append(dict(id=pid,legacyIds=[legacy],name=old['name'],address=old['address'],phone=old.get('phone',''),evidence=e));add['relations'].append(dict(cardId='12-227-A001',placeId=pid,sourceHash=q['12-227-A001'],hours=['現配布案内は治水課。旧道路整備課との窓口継承・終了日は未確認。'],status='unknown',evidence=e))

# Additional concrete misattribution found during independent review.
old=next(x for x in r['relations'] if x['cardId']=='13-100-W001' and x['placeId'].endswith('f6f7e433db24d43ef210'))
e=ev(old['evidence'],'はじめの一歩／配付場所2は一般財団法人足立区観光交流協会。産業振興課への配布時刻の転用不可')
n=copy.deepcopy(old);n.update(status='unknown',hours=['現公式の配布場所2は足立区観光交流協会。旧産業振興課窓口の終了・同一性は未確認。'],evidence=e)
patch(R,'relations',old,n,'観光交流協会と区産業振興課は異なる組織。同住所・同じ階だけでは同じ窓口と認定できず、観光交流協会の時間を旧部署へ転記しない。','wrong-counter')
pid=newplace('adachi-tourism-association','一般財団法人足立区観光交流協会','東京都足立区中央本町1-17-1 足立区役所南館4階',e)
add['relations'].append(dict(cardId=old['cardId'],placeId=pid,sourceHash=old['sourceHash'],hours=['9:00～17:00。土日祝・12月29日～1月3日は閉庁。'],condition='平日',status='active',evidence=e,change=dict(kind='addition',reason='現公式配付場所2の観光交流協会を独立登録。旧産業振興課はunknownで履歴保持。',previousPlaceIds=['place:f6f7e433db24d43ef210'],raw=['２　一般財団法人足立区観光交流協会（足立区中央本町1-17-1　足立区役所南館4階）'])))
# Senju relation gets only its own hours.
old=next(x for x in r['relations'] if x['cardId']=='13-100-W001' and x['placeId'].endswith('77c2b9b41f50c1d2b113'))
n=copy.deepcopy(old);n.update(hours=['9:00～17:00。毎週火曜・12月29～31日は休館。'],condition='',evidence=ev(old['evidence'],'はじめの一歩／配付場所1・配付時間1'))
patch(R,'relations',old,n,'千住街の駅に観光交流協会の休業日を併記せず窓口ごとに分離。','wrong-counter-hours')

# Auditable independent risk screen for all 233, without claiming every paragraph was manually re-read.
for x in r['relations']:
 c=next(c for c in full['cards'] if c['id']==x['cardId']);flags=[]
 if not x['hours']:flags.append('empty-hours')
 if x['status']!='active':flags.append('non-active-status')
 if x.get('reviewUntil') or x.get('validFrom') or x.get('validTo'):flags.append('dated-status')
 if c['issued']>'2026/11/05':flags.append('future-issue')
 if q[x['cardId']]!=x['sourceHash']:flags.append('changed-source')
 findings.append(dict(cardId=x['cardId'],placeId=x['placeId'],flags=flags,sourceEvidence=x['evidence'],scope='全件機械点検（空時間・状態・期限・発行日・現hash）。本文重点読解はREADME参照。'))

def write(path,obj):path=pathlib.Path(path);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
write('data/overrides/proposals/kanto-south.json',add)
write('data/national/patches/kanto-south-integration.json',dict(schema=1,region='kanto-south',checkedAt='2026-11-05',application='exact previous object match required; apply replacements then deduplicate identical objects; not a PlaceLedger',replacements=patches,duplicateDecisions=dups,proposalDecisions=outcomes))
write(B/'review.json',findings)
# Strict temporary merge with compare-before-replace, never last-wins.
inputs={P:copy.deepcopy(p),R:copy.deepcopy(r)}
for x in patches:
 seq=inputs[x['sourceFile']][x['collection']];i=seq.index(x['previous']);seq[i]=x['replacement']
merged={'schema':1,'places':[],'relations':[]}
for col in ['places','relations']:
 seen={}
 for data in [*inputs.values(),add]:
  for x in data[col]:
   key=x['id'] if col=='places' else (x['cardId'],x['placeId'])
   if key in seen:assert seen[key]==x,('unresolved collision',key)
   else:seen[key]=x;merged[col].append(x)
write('/tmp/ks-integration-places.json',merged)
print('patches',len(patches),'duplicates',len(dups),'addition relations',len(add['relations']),'places',len(add['places']))
