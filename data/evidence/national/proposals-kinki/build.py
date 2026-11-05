"""Offline proposal ledger and exact-value patches. Never modifies original fragments."""
import json,pathlib,hashlib,re,html,copy,sys
ROOT=pathlib.Path('data/evidence/national/proposals-kinki')
def read(p):return json.load(open(p))
def write(p,x):
 p=pathlib.Path(p);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
audit=read('data/national/regions/kinki.json'); cards={c['cardId']:c for c in audit['cards']}; base=read('data/overrides/regions/kinki.json'); full=read('data/work/national-input/full.json')
ms={m['url']:m for m in read('data/evidence/national/kinki/manifest.json')+read(ROOT/'manifest.json')}
hashes=read(sys.argv[1] if len(sys.argv)>1 else '/tmp/kinki-proposals-current/quality.json')['sourceHashes']
ledger={'schema':1,'places':[],'relations':[]};patches=[];decisions=[];used={}
def text(u):
 m=ms[u];b=pathlib.Path(m['snapshotPath']).read_bytes();assert hashlib.sha256(b).hexdigest()==m['snapshotSHA256'];assert m['status']==200
 s=b.decode('utf-8');s=re.sub(r'<(script|style)\b[^>]*>.*?</\1>','',s,flags=re.S)
 return re.sub(r'\s+',' ',html.unescape(re.sub('<[^>]+>',' ',s)))
def ev(u,quote):
 assert quote in text(u),(u,quote)
 m=ms[u];used[u]=m
 return dict(sourceUrl=u,snapshotPath=m['snapshotPath'],snapshotSHA256=m['snapshotSHA256'],sourceLocator=quote,checkedAt='2026-11-05',actorType='ai',verificationMethod='AIが保存公式原本の施設・配布条件を照合。現地確認・人確認ではない。座標は未採用。')
def url(c):return cards[c]['proposals'][0]['sourceUrls'][0]
def add(c,slug,name,address,hours,quote,condition='',status='active',facility_url=None,facility_quote=None,previous=None,shared=None,validFrom=None,note=''):
 u=url(c);e=ev(u,quote)
 if shared:p=copy.deepcopy(next(p for p in base['places'] if p['id']==shared))
 else:p=dict(id='facility:kinki-'+slug,legacyIds=[],name=name,address=address,phone='',evidence=ev(facility_url or u,facility_quote or quote))
 if not any(x['id']==p['id'] for x in ledger['places']):ledger['places'].append(p)
 r=dict(cardId=c,placeId=p['id'],sourceHash=hashes[c],hours=hours,status=status,condition=condition,evidence=e,change=dict(kind='addition',reason='公式配布案内に記載された未抽出窓口の追加。旧関係は独立して保持する。'+note,previousPlaceIds=previous if previous is not None else [cards[c]['relations'][0]['legacyPlaceId']],raw=[quote]))
 if validFrom:r['validFrom']=validFrom
 ledger['relations'].append(r);decisions.append(dict(cardId=c,placeId=p['id'],decision='adopted',status=status,remainingReason='目的地座標は別担当。'+note,evidence=e))
add('24-202-C001','yokkaichi-holiday','四日市市上下水道局 夜間休日窓口','三重県四日市市堀木一丁目3-18',['土日祝8:30～17:15。年末年始を除く。'],'※土日・祝日は夜間休日窓口で配布します。',condition='土日祝')
add('25-206-A001','kusatsu-cityhall','草津市役所2階 上下水道総務課','滋賀県草津市草津三丁目13番30号',['毎週月曜（月曜が祝日の場合は翌日）および祝日の翌日（土日を除く）の開庁時間9:00～16:45。12/29～1/3、その他市長が必要と認めた日は休み。'],'市役所2階の上下水道総務課（滋賀県草津市草津三丁目13番30号、電話:077-561-2440）',condition='公式に列挙された交流館休館日のみ。すべての臨時休館日に代替するとは解釈しない。')
add('26-100-A001','kyoto-guard','京都市上下水道局総合庁舎 守衛室','京都府京都市南区上鳥羽鉾立町11-3',['土日祝10:00～17:00。12/29～1/3は配布なし。'],'※土日祝日は京都市上下水道局総合庁舎 守衛室にて配布しております。',condition='土日祝')
add('26-344-A001','','','','9:00～17:00、火曜・12/28～1/4休館'.split('|'),'総合文化センター事務室 宇治田原町大字岩山小字沼尻46-1',shared='facility:kinki-c1f821f1bc9c44d7290e',validFrom='2026-07-31')
add('27-215-A001','neyagawa-holiday','寝屋川市上下水道局庁舎1階 窓口','大阪府寝屋川市本町15番1号',['在庫切れで配布休止。通常の土日祝9:00～17:30（12/29～1/3を除く）。'],'上下水道局庁舎1階 窓口',condition='土日祝。再開未定。',status='suspended')
add('27-222-A001','habikino-visitor','はびきのビジターセンター','大阪府羽曳野市古市1-1-21',['9:00～17:00。木曜（祝日は営業）・12/29～1/3休業。'],'はびきのビジターセンター 営業時間 9：00～17：00',facility_url='https://www.city.habikino.lg.jp/teiju/tanoshimu/12979.html',facility_quote='住所 羽曳野市古市1-1-21',previous=['place:23e5e276a7868c21e7a0'],note='旧古市1丁目1-19窓口の終了日・同一性は未確定。旧関係を終了にしない。')
add('27-227-A001','higashiosaka-lobby','東大阪市役所22階 展望ロビー','大阪府東大阪市荒本北一丁目1番1号',['土日祝9:00～23:00。12/29～1/3は配布なし。'],'東大阪市役所22階 展望ロビー',condition='土日祝')
add('27-228-A001','sennan-annex','泉南市役所別館2階 下水道課窓口','大阪府泉南市樽井一丁目1番1号',['火曜・水曜9:00～17:30。祝日・年末年始の閉庁日を除く。'],'泉南市役所別館2階（泉南市都市整備部下水道課窓口）【営業時間は火曜日、水曜日の9時から17時30分】',condition='火曜・水曜の開庁日',previous=['place:82667b8bd5200610cbd7'],note='旧樽井737窓口の配布終了の独立告知は未発見。旧関係は未確認のまま保持。')
add('27-230-A001','katano-guard','交野市上下水道部1階 警備員室窓口','大阪府交野市私市2丁目24番1号',['土日祝9:00～17:00。12/29～1/3は配布なし。'],'交野市上下水道部（旧水道局）1階 警備員室窓口',condition='土日祝',validFrom='2026-02-02')
add('27-321-A001','toyono-guard','豊能町役場本庁舎1階 警備室窓口','大阪府豊能郡豊能町余野414-1',['閉庁日（土日・国民の祝日・年末年始）9:00～17:30。'],'閉庁日 ：豊能町役場 本庁舎1階 警備室窓口',condition='閉庁日（年末年始を含む）')
add('27-362-A001','tajiri-tourism','田尻町観光協会 観光案内所','大阪府泉南郡田尻町りんくうポート北1番',['町のカード案内9:00～17:00と、運営者の営業時間9:00～15:00（水曜定休）が相違。配布時間は要確認。'],'午前9時から午後5時まで',status='unknown',facility_url='https://tajiri-tourism.com/',facility_quote='田尻町マンホールカードも絶賛配布中！',note='追加施設の配布実施は両公式で確認。時間相違は観光案内所個別ページを追加取得しても解消せず、受取可能状態はunknown。')
add('28-203-A001','akashi-information','あかし案内所','兵庫県明石市大明石町1丁目1-23 ピオレ明石西館',['天文科学館休館日のみ。平日9:00～19:00、土日祝9:00～18:00。12/31・1/1は休業。'],'上記以外の日 ：あかし案内所（定休日は除く）',condition='天文科学館休館日',facility_url='https://www.yokoso-akashi.jp/akashi_information',facility_quote='所在地 兵庫県明石市大明石町1丁目1-23 ピオレ明石西館')
for c in ['28-207-B001','28-207-C001']:
 add(c,'itami-gallery-temporary','伊丹市立観光物産ギャラリー 仮設店舗','兵庫県伊丹市 旧伊丹市演劇ホール喫茶店跡（JR伊丹駅から約200m）',['土日祝10:00～17:00。12/30～1/2休業。' if c.endswith('B001') else '10:00～17:00。12/30～1/2休業。'],'それに伴い、マンホールカードにつきましても仮設店舗にて配布いたします。',condition='土日祝' if c.endswith('B001') else '',previous=['place:50fd7780197e359a9c8e'],validFrom='2026-09-14',note='番地は原典で確定せず所在地説明を保持。仮設店舗の終了日は未告知。旧駅住所・座標を流用しない。')
add('28-216-A001','takasago-cityhall','高砂市役所本庁舎3階12番窓口 上下水道部経営総務室','兵庫県高砂市荒井町千鳥1丁目1番1号',['平日8:30～17:15。12/29～1/3を除く。'],'本庁舎3階12番窓口 上下水道部経営総務室',condition='来庁者に1枚。郵送なし。')
add('28-443-A001','fukusaki-ekimae','福崎町駅前観光交流センター（フクちゃんプラザ）','兵庫県神崎郡福崎町福田302-11',['9:00～19:00。年末年始休館、館内メンテナンスによる臨時休館あり。'],'福崎町駅前観光交流センター 午前9時00分～午後7時00分',facility_url='https://fukusaki-fun.com/ekimae/access/',facility_quote='兵庫県神崎郡福崎町福田 302-11')
add('28-443-A001','fukusaki-tsujikawa','福崎町辻川観光交流センター（サキちゃんプラザ）','兵庫県神崎郡福崎町西田原1470-1',['町カード案内：平日10:00～17:00、土日祝10:00～18:00。運営者案内：11～3月は全日10:00～17:00。冬季休日の配布終了時刻は要確認。水曜・年末年始休館、臨時休館あり。'],'福崎町辻川観光交流センター 平日：午前10時00分～午後5時00分',facility_url='https://fukusaki-fun.com/tsujikawa/',facility_quote='兵庫県神崎郡福崎町西田原 1470-1',status='unknown',note='追加取得で冬季休日の時刻相違を発見。18時まで配布と断定せずunknown。')
add('29-205-A001','imai-machizukuri','今井まちづくりセンター','奈良県橿原市今井町3丁目8番8号',['9:00～16:30。12/29～1/3休館。'],'「今井まちづくりセンター」（今井町3丁目8番8号）にてマンホールカードの配布を継続しております。',validFrom='2026-10-01')
add('29-363-A001','karako-information','唐古・鍵遺跡史跡公園 遺構展示情報館','奈良県磯城郡田原本町唐古50番地の2 唐古・鍵遺跡史跡公園内',['9:00～16:30。月曜（祝日は開園、次の平日休園）・12/28～1/4休園。'],'遺構展示情報館（唐古・鍵遺跡史跡公園内）',facility_url='https://www.karako-kagi.com/',facility_quote='奈良県磯城郡田原本町唐古50番地の2')
# Exact old/new records: parent applies only after review.
def patch(c,field,new,reason,evidence=None):
 for i,r in enumerate(base['relations']):
  if r['cardId']==c:
   old=r.get(field)
   if old!=new:patches.append(dict(file='data/overrides/regions/kinki.json',collection='relations',match={'cardId':c,'placeId':r['placeId']},field=field,old=old,new=new,reason=reason,evidence=evidence or r['evidence']))
for c in ['26-344-A001','26-344-B001','29-205-A001']:
 patch(c,'sourceHash',hashes[c],'2026-11-05現一覧と保存自治体原典の時間・配布場所を個別再照合。指紋のみの承認持越しではない。')
patch('26-100-A001','hours',['平日10:00～17:00。12/29～1/3は配布なし。'],'初回fragmentの8:30～17:15は庁舎営業時間。公式第2弾のカード配布時間へ訂正。',ev(url('26-100-A001'),'午前10時～午後5時'))
patch('27-230-A001','condition','平日','休日の警備員室を追加したため既存1階窓口は平日と明示。')
patch('27-230-A001','hours',['平日9:00～17:00。12/29～1/3は配布なし。'],'既存窓口と休日警備員室の適用曜日を分離。')
patch('24-202-C001','hours',['平日8:30～17:15、年末年始除く。'],'休日窓口を実登録したため未採用proposal表記を除く。')
patch('25-206-A001','hours',['9:00～17:00。月曜（祝日は翌日）・祝日の翌日（土日を除く）・12/28～1/4ほか指定日休館。'],'代替窓口を実登録したため未採用proposal表記を除く。')
assert {d['cardId'] for d in decisions}=={c['cardId'] for c in audit['cards'] if c.get('proposals')}
write('data/overrides/proposals/kinki.json',ledger)
deferred=[]
for c in audit['cards']:
 for old in c['relations']:
  if old.get('distributionState')!='unapproved':continue
  reason=({'27-222-A001':'新ビジターセンターは古市1-1-21で採用。旧古市1-1-19の終了告知は公式検索でも確認できず、旧関係の終了・同一性統合は保留。',
           '27-228-A001':'別館2階の現配布は採用。樽井737の配布終了を明示した公式原本は未発見。旧関係は未確認として保持。'}).get(c['cardId'],'建物見出しと平日・休日の実窓口を再照合。独立した第三窓口ではない。現schemaに原関係の見出し除外指定はなく、一方の窓口への同一性aliasは不正確になるため変更保留。')
  u=old['attempts'][-1]['url'];m=ms[u];used[u]=m
  evidence=dict(sourceUrl=u,snapshotPath=m['snapshotPath'],snapshotSHA256=m['snapshotSHA256'],sourceLocator='配布場所・窓口記載（門真Bはカード全体の在庫切れ告知）',checkedAt='2026-11-05',actorType='ai',verificationMethod='AIが公式原本と旧抽出関係を再照合。終了日を推測しない。')
  deferred.append(dict(cardId=c['cardId'],legacyPlaceId=old['legacyPlaceId'],decision='retain-unreviewed',old=old,new=copy.deepcopy(old),reason=reason,evidence=evidence))
write('data/national/patches/kinki.json',{'schema':1,'region':'kinki','patches':patches,'deferredCorrections':deferred})
for d in decisions:
 if d['cardId']=='27-362-A001':d['additionalEvidence']=[ev('https://tajiri-tourism.com/touristinformationcenter/','営業時間 09:00 - 15:00 定休日：水曜日')]
 if d['placeId']=='facility:kinki-fukusaki-tsujikawa':d['additionalEvidence']=[ev('https://fukusaki-fun.com/tsujikawa/','11-3月 10:00-17:00')]
 if d['cardId']=='28-203-A001':d['additionalEvidence']=[ev('https://www.yokoso-akashi.jp/akashi_information','平日 9:00～19:00 土日祝 9:00～18:00')]
write(ROOT/'decisions.json',{'schema':1,'decisions':decisions})
write(ROOT/'evidence-used.json',list(used.values()))
# Temporary composition is isolated from source fragments and all other workers.
merged=copy.deepcopy(base)
for p in patches:
 r=next(r for r in merged[p['collection']] if all(r[k]==v for k,v in p['match'].items()));assert r.get(p['field'])==p['old'];r[p['field']]=p['new']
for p in ledger['places']:
 same=next((x for x in merged['places'] if x['id']==p['id']),None)
 if same:assert same==p
 else:merged['places'].append(p)
merged['relations']+=ledger['relations']
write('/tmp/kinki-proposals-combined.json',merged)
print(len(ledger['places']),'facility rows;',len(ledger['relations']),'new relations;',len(patches),'patches')
