#!/usr/bin/env python3
"""Explicit AI decisions; cached official evidence, no geocoding or network."""
import json,pathlib,copy,hashlib,sys
ROOT=pathlib.Path('data/evidence/national/proposals-north')
def read(p):return json.load(open(p))
def save(p,v):pathlib.Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
A={c['cardId']:c for c in read('data/national/regions/north.json')['cards']}
L=read('data/overrides/regions/north.json'); full=read('data/work/national-input/full.json'); P={p['id']:p for p in full['places']}
M={r['url']:r for r in read('data/evidence/national/north/manifest.json')+read(ROOT/'manifest.json')}
Q=read('/tmp/north-proposal-current/quality.json')['sourceHashes']
ledger={'schema':1,'places':[],'relations':[]};patches=[];decisions=[]
def ev(url,locator):
 r=M[url];assert r['status']==200
 return dict(sourceUrl=url,snapshotPath=r['snapshotPath'],snapshotSHA256=r['snapshotSHA256'],sourceLocator=locator,checkedAt='2026-11-05',actorType='ai',verificationMethod='AIが保存済み公式原本の施設名・住所・配布条件を個別照合。現地・人確認ではない。')
def evid(cid):return copy.deepcopy(A[cid]['proposals'][0]['evidence'])
def add(cid,key,name,address,condition,hours,raw,e=None,existing=None,**dates):
 e=e or evid(cid);e['sourceLocator']=name+' / 配布場所・時間・休館条件';e['verificationMethod']='AIが保存済み公式本文の配布場所・条件・対象カードを照合。現地・人確認ではない。'
 pid=existing or 'facility:north-proposal-'+key
 if not existing:ledger['places'].append(dict(id=pid,legacyIds=[],name=name,address=address,phone='',evidence=e))
 r=dict(cardId=cid,placeId=pid,sourceHash=Q[cid],hours=hours,condition=condition,status='active',evidence=e,change=dict(kind='addition',reason='公式に記載された別窓口・臨時窓口を追加。旧関係は自動削除しない。',previousPlaceIds=list(dict.fromkeys(x['legacyPlaceId'] for x in A[cid]['relations'])),raw=raw),**dates)
 ledger['relations'].append(r);decisions.append(dict(cardId=cid,placeId=pid,state='adopted',reason=condition,evidence=e))
 return pid
add('01-203-A002','otaru-duty','小樽市水道局本庁舎1階当直室','北海道小樽市花園2丁目11番15号','土日祝・年末年始（12/29～1/3）',['9:00～17:00'],['休日（土・日曜日、祝日および年末年始）','⇒1階当直室'])
add('01-215-A001','bibai-duty','美唄市役所当直室','北海道美唄市西3条南1丁目1番1号','土日祝',['8:45～17:15'],['土日祝日の配布場所','美唄市役所 当直室'],validFrom='2026-09-07')
add('01-230-A001','noboribetsu-duty','登別市役所本庁舎1階宿直室','北海道登別市中央町6丁目11番地','土日祝。12/29～1/3除外',['9:00～17:00'],['［土・日曜日、祝日］市役所本庁舎１階　　宿直室'])
add('01-406-A001','furubira-duty','古平町複合施設かなえーる1階管理室','北海道古平郡古平町大字浜町50番地','土日祝',['8:45～17:30'],['土日祝日：管理室（１階左側通路奥）'],validFrom='2022-05-06')
add('01-424-A001','naie-office','奈井江町役場建設環境課都市環境係','北海道空知郡奈井江町字奈井江11番地','みなクル休館日（毎週月曜日）。役場での配布時刻は個別記載なし',[],['役場 建設環境課都市環境係の窓口にて配布。'])
for key,name in [('construction','建設課上下水道係'),('planning','企画課商工観光係')]:
 add('01-462-A001','minamifurano-'+key,'南富良野町役場'+name,'北海道空知郡南富良野町字幾寅867番地','月曜～金曜。年末年始除外',['9:00～17:00'],['南富良野町役場'+name,'9：00～17：00'])
add('01-487-C001','teshio-office','天塩町役場建設課(2F)','北海道天塩郡天塩町新栄通8丁目1466-113','温泉施設メンテナンス期間の臨時窓口。原文の9:00～17:00は臨時案内直前の記載',['9:00～17:00'],['【配布時間】9:00～17:00','てしお温泉「夕映」の施設メンテナンスのため、令和8年11月9日（月）～13日（金）の期間は配布場所を《天塩町役場 2階 建設課（ガンダムマンホールカードと同じ）》に変更しますので、お求めの際はご注意ください。'],existing='facility:north-fc46386371945051a55a',validFrom='2026-11-09',validTo='2026-11-13')
add('01-635-B001','shintoku-shop','新得駅前地域交流センターとくとく1Fショップレジ','北海道上川郡新得町本通南1丁目21番地22','閉館時間等変更あり。訪問前に施設へ確認',['9:00～19:00'],['新得駅前地域交流センターとくとく　1Fショップレジ','午前9時00分から午後7時00分'])
hana='https://www.city.hanamaki.iwate.jp/kurashi/suidou/1019833/1001196/1012397.html'
for cid,key,ward,addr in [('03-205-B001','ishidoriya','石鳥谷','岩手県花巻市石鳥谷町八幡第4地割161番地'),('03-205-C001','ohasama','大迫','岩手県花巻市大迫町大迫第2地割51番地4')]:
 add(cid,key+'-duty','花巻市'+ward+'総合支所1階警備員室',addr,'土日祝。12/29～1/3除外',['9:00～17:00'],['【土曜 日曜 祝日】午前9時から午後5時まで','毎年12月29日から1月3日は年末年始につき配布は行いません'],e=ev(hana,ward+'地域マンホールカード'))
add('04-202-B001','ishinomaki-kawamachi','石巻市かわまち交流センター1階','宮城県石巻市中央二丁目11番21','萬画館工事中の臨時窓口。2027年4月上旬までの予定、進捗で変更。再確認期限は3/31',['9:00～17:00'],['新しい配布場所は、石巻市中央二丁目11番21　石巻市かわまち交流センター　1階','★ロボコンマンホールカードが再入荷しましたので令和8年10月24日（土曜日）から配布を再開します。'],existing='facility:north-3443a4a6d08de5680f46',validFrom='2026-10-24',reviewUntil='2027-03-31')
tag=add('04-209-A001','tagajo-info','史都多賀城観光案内所（JR仙石線多賀城駅内）','宮城県多賀城市中央2丁目7番1号','埋蔵文化財調査センター休館日の代替。案内所は12/28～1/5・臨時休館日休み。モノクロ版の代替配布時刻は明記なし',[],['また、多賀城市埋蔵文化財センターが休館日の場合、史都多賀城観光案内所での配布となります'])
ledger['places'][-1]['evidence']=ev('https://www.tagakan.jp/detail.html?content=141','史都多賀城観光案内所 / 住所・開所時間')
add('04-404-A001','shichigahama-water','七ヶ浜町上下水道事業所','宮城県宮城郡七ヶ浜町東宮浜字丑谷辺5-1','七ヶ浜国際村休館日。年末年始の事業所対応は明記なし',['8:30～17:15'],['七ヶ浜国際村休館日の配布場所等は次のとおりです。','・配布場所　七ヶ浜町上下水道事業所（宮城県宮城郡七ヶ浜町東宮浜字丑谷辺5-1）'])
add('04-406-B001','rifu-information','利府町役場町民交流館ペア・パル利府総合案内','宮城県宮城郡利府町利府字新並松4番地','12/28～1/4・臨時休館日除外',['平日8:30～17:15','土日祝9:00～17:15'],['利府町役場町民交流館「ペア・パル利府」（総合案内）'])
add('05-201-A001','akita-guard','秋田市上下水道局守衛室','秋田県秋田市川尻みよし町14-8','土日祝・年末年始。業務により待機の場合あり',['8:30～17:15'],['（土曜、日曜、祝日、年末年始は守衛室で配布します）'])
add('05-212-A001','daisen-grandport','大仙市観光情報センターグランポール（大曲駅2階）','秋田県大仙市大曲通町6-5','はなび・アム休館日のみ（月曜、祝日なら翌平日。臨時休館あり）',['9:00～19:00'],['※はなび・アムの休館日のみ、大仙市観光情報センター　グランポール（大曲駅二階）で配布を行います。'])
add('07-214-A001','motomiya-guard','本宮市役所警備員室','福島県本宮市本宮字万世212番地','土日祝・年末年始。西側ATM裏の入口',['8:30～17:15'],['〇土・日・祝日は警備員室で配布します。（年末年始含む）'])
add('07-301-A001','koori-office','桑折町役場2階建設水道課','福島県伊達郡桑折町大字谷地字道下22番地7','旧伊達郡役所休館日の代替。町役場窓口単独の配布時刻・年末年始対応は明記なし',[],['また、休館日においては、桑折町役場の2階、建設水道課で配布しておいります。'])
add('07-421-A001','aizubange-info','会津坂下町役場正面玄関前ホール総合案内窓口','福島県河沼郡会津坂下町字市中三番甲3662番地','曜日別担当は公式本文に記載なし。旧休日窓口との同一性未確定',['8:30～17:15'],['■配布場所：会津坂下町役場　　正面玄関前ホール 総合案内窓口・建設課上下水道班'])
for key,name,cond,h in [('customer','上下水道お客様センター','毎月第3火曜日（祝日除く）のみ','8:30～17:15'),('guard','警備室','まるごと西郷館の年末年始休館中のみ。対応日は毎年変わるため要問合せ','9:00～18:00')]:
 add('07-461-A001','nishigo-'+key,'西郷村総合庁舎1階'+name,'福島県西白河郡西郷村大字熊倉字折口原40番地',cond,[h],['西郷村総合庁舎1階 '+name,'配布時間：'+('8時30分～17時15分' if key=='customer' else '9時～18時')])
suna='http://www.city.sunagawa.hokkaido.jp/seikatsu_kurashi/suidou_gesuidou/2018-0719-1627-50.html'
add('01-226-A001','sunagawa-duty','砂川市役所当直室（現庁舎）','北海道砂川市西7条北2丁目1-1','すないる休館日。現庁舎窓口を追加し旧住所の関係は保持',['8:30～19:00'],['休館日：砂川市役所当直室','８時30分～19時00分'],e=ev(suna,'配布場所・配布時間 / 市役所所在地'))
# Exact patches apply to a temporary copy only. Missing keys use explicit oldExists.
def patch(collection,match,field,new,reason,e):
 rows=[x for x in L[collection] if all(x.get(k)==v for k,v in match.items())];assert len(rows)==1
 old=rows[0];patches.append(dict(file='data/overrides/regions/north.json',collection=collection,match=match,field=field,oldExists=field in old,old=copy.deepcopy(old.get(field)),new=new,reason=reason,evidence=e))
# Name/condition clarifies existing weekday counter rather than inventing a second period ID.
for cid,name,cond in [('01-203-A002','小樽市水道局本庁舎2階サービス課','平日。祝日・年末年始除外'),('01-215-A001','美唄市役所上下水道課窓口','平日'),('01-406-A001','古平町複合施設かなえーる2階建設水道課','平日'),('03-205-B001','花巻市石鳥谷総合支所1階地域振興課建設係','平日。12/29～1/3除外'),('03-205-C001','花巻市大迫総合支所2階地域振興課建設係','平日。12/29～1/3除外')]:
 r=next(r for r in L['relations'] if r['cardId']==cid);e=ev(hana,'配布場所・配布時間') if cid.startswith('03') else evid(cid)
 patch('places',{'id':r['placeId']},'name',name,'休日窓口追加に合わせ、既存の平日窓口を特定する',e)
 patch('relations',{'cardId':cid,'placeId':r['placeId']},'condition',cond,'曜日別窓口を原文どおり限定',e)
# All Hanamaki rows incorrectly cite an index without details; repair evidence only.
for r in L['relations']:
 if r['cardId'].startswith('03-205-'):
  patch('relations',{'cardId':r['cardId'],'placeId':r['placeId']},'evidence',ev(hana,'各地域の配布場所・配布時間'),'初回は詳細のないindexを参照。保存済み詳細原本1012397へ訂正',ev(hana,'各地域の配布場所・配布時間'))
# These reviews are already correct; preserve, do not terminate the whole card.
for cid,reason in [('07-201-B001','11月分終了はsuspended、reviewUntil=2026-11-30を維持。翌月再開の保証なし'),('01-487-C001','温泉はreviewUntil=2026-11-08を維持。11/9～13の役場関係と別管理'),('04-202-B001','萬画館の既存suspended・reviewUntil=2027-03-31を維持。臨時先を追加')]:
 decisions.append(dict(cardId=cid,state='existing-preserved',reason=reason))
for cid,reason in [('01-516-B001','公式は冬期休館日「役場」とだけ記載。Aカードの5番窓口をBにも適用する根拠なし。建物単位の重複IDを作らず保留'),('01-516-D001','公式は冬季15～17時「役場」とのみ記載。室内窓口と冬季適用月の特定不足。A窓口へ推測aliasしない'),('04-000-A001','現県ページの導入文のみサン・ファン館が残る。県広報2022年12月号は11/1から津波伝承館への変更を明記。再開根拠がなく追加保留')]:
 decisions.append(dict(cardId=cid,state='held',reason=reason,evidence=evid(cid)))
# Every initially unresolved source relation gets an explicit disposition.
for cid,c in A.items():
 for r in c['relations']:
  if not r.get('facilityId'):
   decisions.append(dict(cardId=cid,legacyPlaceId=r['legacyPlaceId'],state='source-unresolved',reason=r['remainingReason']))
for cid in ['01-234-A001','07-202-A001']:
 for r in full['relations']:
  if r['cardId']==cid and any(z.get('legacyPlaceId')==r['placeId'] and not z.get('facilityId') for z in A[cid]['relations']):
   patches.append(dict(file='generated full.json only; parser correction requires parent review',collection='relations',match={'cardId':cid,'placeId':r['placeId']},old=r,new=None,reason='時間見出しの誤抽出' if cid.startswith('01') else '建物総称の重複。実際の総合案内・警備員室は維持',evidence=A[cid]['attempts']))
# Previously unadopted existing relations; complete address evidence individually.
def adopt_old(cid,legacy,address,addr_url,dist_url,hours,condition,status='active',pid=None):
 p=P[legacy];e=ev(dist_url,'マンホールカード / 対象デザイン・配布窓口・条件')
 if pid:
  lp=next(x for x in ledger['places'] if x['id']==pid);lp['legacyIds'].append(legacy)
 else:
  pid='facility:north-'+legacy.split(':')[1]
  ledger['places'].append(dict(id=pid,legacyIds=[legacy],name=p['name'],address=address,phone='',evidence=ev(addr_url,p['name']+' / 施設所在地')))
 ledger['relations'].append(dict(cardId=cid,placeId=pid,sourceHash=Q[cid],hours=hours,condition=condition,status=status,evidence=e))
 for d in decisions:
  if d.get('cardId')==cid and d.get('legacyPlaceId')==legacy:
   d.update(state='existing-relation-adopted',reason=condition,facilityId=pid,evidence=e,addressEvidence=ev(addr_url,p['name']+' / 施設所在地'))
 return pid
adopt_old('02-201-A001','place:f46ab0fab535cf852a33','青森県青森市大字浅虫字螢谷341-19','https://www.city.aomori.aomori.jp/shisetsu/1005707/1005717.html','https://www.city.aomori.aomori.jp/suido/gesuidou/1001920.html',['4～11月9:00～19:00','12～3月9:00～18:00'],'土日祝含む。施設事情で時間変更あり。2024/11/13再開')
adopt_old('02-206-A001','place:87bb76a16d97c7b4aee9','青森県十和田市稲生町15番3号','https://www.city.towada.lg.jp/kanko/spot/kankoubussan.html','https://www.city.towada.lg.jp/kurashi/seikatsu/suidou/manholecard.html',[],'窓口と住所は確認。配布専用時間未記載、在庫基準日は2021年10月1日のため現在状態は未確定','unknown')
adopt_old('04-209-B001','place:80218ca08ff89e947bae','宮城県多賀城市中央2丁目7番1号','https://www.tagakan.jp/detail.html?content=141','https://www.city.tagajo.miyagi.jp/ryokin/kurashi/suido/gesuido/card.html',['10:00～16:00'],'カラー版。12/28～1/5・臨時休館日除外。旧入力の2-1-7は公式施設案内の2-7-1に訂正',pid=tag)
adopt_old('07-422-B001','place:7db8e601fb17d17714aa','福島県河沼郡湯川村大字佐野目字五丁ノ目78番地1','https://www.vill.yugawa.fukushima.jp/site/gyousei-top/info-about2.html','https://www.vill.yugawa.fukushima.jp/site/kurashi-top/yugawa-manhole.html',['4～11月9:00～19:00','12～3月9:00～18:00'],'ゆがわまいちゃん（第14弾）。インフォメーションセンターで1人1枚')
adopt_old('07-521-A001','place:6b3394cd8f84aae2ffd7','福島県田村郡三春町字北町10','https://www.town.miharu.fukushima.jp/soshiki/7/entry_1.html','https://www.town.miharu.fukushima.jp/soshiki/10/manho-ruka-do.html',[],'配布施設と住所確認。曜日分担・配布専用時間は公式本文に記載なし','unknown')
adopt_old('07-521-A001','place:19e9c73e2a8c8ffc9846','福島県田村郡三春町字中町4','https://www.town.miharu.fukushima.jp/uploaded/attachment/15102.pdf','https://www.town.miharu.fukushima.jp/soshiki/10/manho-ruka-do.html',[],'配布施設は現掲載ページで確認、住所は2018年町広報の施設記載と照合。曜日分担・配布時間未確定','unknown')
adopt_old('04-501-A001','place:9d6b7b9b440c17738339','宮城県遠田郡涌谷町涌谷字黄金山1番地3','https://www.town.wakuya.miyagi.jp/kurashi/kyoiku/bunka-sports/documents/r06_toudaijiten.html','https://www.town.wakuya.miyagi.jp/topics/h28manhole.html',[],'施設住所は2024年町公式案内で確認。配布根拠は2016年初回4000枚告知のみ、現在在庫・配布継続未確定','unknown')
# Address changes whose old/new physical identity is not independently settled stay separate.
onagawa=add('04-581-A001','onagawa-platto','女川町たびの情報館ぷらっと（現住所）','宮城県牡鹿郡女川町女川二丁目16番地5','年中無休。旧仮換地住所との同一性を確定せず、旧関係を保持',['9:00～15:00'],['女川町たびの情報館ぷらっとで配布しています。','配布時間…9：00 ～ 15：00（年中無休）'],e=ev('https://www.town.onagawa.miyagi.jp/mhcard.html','配布について'))
ledger['places'][-1]['evidence']=ev('https://www.town.onagawa.miyagi.jp/05_13_04_05.html','指定暑熱避難施設一覧5番 / 女川町たびの情報館ぷらっと・住所')
for d in decisions:
 if d.get('state')=='source-unresolved':
  cid=d['cardId']
  notes={
   '01-219-A001':'追加探索で休日変更告知content=3243を発見したが原本もHTTP503。検索抜粋は承認不使用。',
   '01-607-A001':'追加の公式新着ページもHTTP503。元の配布URL失敗を成功に変更しない。',
   '01-555-A001':'別公式の社会教育施設一覧id=979もHTTP200の公開停止本文。施設運営者の住所は岩見通南1丁目止まりで番地未確定。',
   '01-462-A001':'追加検索で浄化センターは503-2/505-5/507-1の複数筆、みなくるは708（枝番なし）の資料を発見。窓口と入力番地の対応を確定できず保留。役場2窓口は別途追加済み。',
   '01-518-A001':'町公民館ページはどんと名称と教育委員会の沓形字富士見町2-2を掲載。ただし施設所在地の明記かお問い合わせ住所かの切分け未確定。',
   '01-520-A001':'ホロカルはJR駅構内との公式記載を再確認したが地番なし。産業地域振興センターは2019年施設表検索に栄町5-3があるが原本未照合につき未採用。',
   '01-634-A001':'現公式の道の駅裏プレハブは確認。イベント会場東町3-2-7を配布プレハブへ流用せず、旧東町1-9との関係を保留。',
   '03-210-A001':'追加公式検索も主屋200-7。管理棟200-8の住所根拠ではないため旧住所を置換しない。',
   '05-202-A001':'工事休館と出張展示の公式告知を追加発見したが保存要求は3URLとも404。展示の移転をカード配布の移転と推定しない。',
   '07-209-A001':'2019年市広報を追加取得。千客万来館住所55-1の根拠候補は得たが本文配付場所が画像で、現在の専用時間・条件を未確定のまま保持。',
   '04-581-A001':'現住所の別関係を追加済み。旧仮換地表示との対応が未確定のため旧関係は未承認のまま保持。',
   '01-226-A001':'現住所の役場当直室を別関係として追加済み。旧庁舎の終了日を推測せず保持。',
   '01-635-B001':'公式ショップレジを別関係として追加済み。旧総合案内所の終了を推測しない。',
   '04-406-B001':'公式総合案内を別関係として追加済み。旧上下水道課窓口の終了を推測しない。',
   '07-421-A001':'公式総合案内を別関係として追加済み。旧休日窓口の曜日担当・終了は不明。'}
  if cid in notes:d['additionalFinding']=notes[cid]
# Support the hold with original provincial publication; not an assumed permanent closure.
for d in decisions:
 if d.get('cardId')=='04-000-A001' and d.get('state')=='held':d['additionalEvidence']=ev('https://www.pref.miyagi.jp/documents/9621/no20_r041228.pdf','2022年12月28日 第20号 / 津波伝承館への配布施設変更')

save('data/overrides/proposals/north.json',ledger);save('data/national/patches/north.json',dict(schema=1,region='north',patches=patches));save(ROOT/'decisions.json',decisions)
# Build temporary copy with safe exact patches. Do not apply generated-source deletion proposals.
tmp=copy.deepcopy(L)
for p in patches:
 if p['file']!='data/overrides/regions/north.json':continue
 row=next(x for x in tmp[p['collection']] if all(x.get(k)==v for k,v in p['match'].items()))
 assert (p['field'] in row)==p['oldExists'] and row.get(p['field'])==p['old']
 row[p['field']]=p['new']
for k in ['places','relations']:tmp[k]+=ledger[k]
save('/tmp/north-proposals-combined.json',tmp)
print('additional facilities',len(ledger['places']),'relations',len(ledger['relations']),'patches',len(patches))
