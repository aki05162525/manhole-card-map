# Explicit AI review decisions, keyed by immutable card ID. No automatic acceptance.
D={}
def add(ids,url,locator,hours=None,**kw):
 for cid in ids.split(): D[cid]={'url':url,'locator':locator,**kw}; D[cid].update({'hours':hours} if hours is not None else {})
add('21-202-A001','http://www.city.ogaki.lg.jp/0000041755.html','配布場所・時間／在庫状況',['9:00～17:00','12月29日～1月3日及び展示替えは休館'])
u='https://www.city.takayama.lg.jp/kurashi/1000022/1000122/1001131/1022809.html'
for letter,label in zip('ABCDEFGHI',['こばのみつばつつじ','おこじょ','風土季の郷 飛騨国府','荘川桜','臥龍桜','岩つつじ','すずらん','乗鞍岳と雷鳥','カワセミ']):add('21-203-'+letter+'001',u,label+'／配布場所・配布時間／在庫状況')
D['21-203-A001']['proposal']='公式に中橋観光案内所（9:00～18:00）の追加配布先あり。入力に対応関係がなく未登録。'
for k in ['C','D','H']:D['21-203-'+k+'001']['condition']='平日：基盤産業課窓口／休日：当直室窓口。施設建物を表す元の支所単位を維持。室内窓口の分割は未実装。'
D['21-203-E001']['condition']='一之宮支所 基盤産業課窓口（休日の別窓口は公式記載なし）'
D['21-203-G001']['byIndex']=[{'hours':['10:00～16:00','水曜日（祝祭日の場合は翌日）は配布なし'],'condition':'道の駅ひだ朝日村の営業日'},{'hours':['8:30～17:15'],'condition':'水曜日（祝祭日の場合は翌日）：朝日支所基盤産業課窓口'}]
add('21-204-A001','https://www.city.tajimi.lg.jp/kurashi_tetsuduzuki/jougesuido/1005578/1009966.html','在庫状況／配布場所／配布日時')
add('21-205-A001','https://www.city.seki.lg.jp/0000012751.html','マンホールカード配布情報／配布場所・時間')
add('21-206-B001','https://www.city.nakatsugawa.lg.jp/kanko/bunka/taishi/39776.html','マンホールカードの配布のご案内／在庫状況',['9:00～21:30','年末年始・施設点検日は休み'],condition='ひと・まちテラス1階総合案内窓口。施設へのカード問合せは控え、観光課へ。')
u='https://www.city.ena.lg.jp/kurashi_tetsuzuki/jogesuido/gesuido_gappeijokaso/12047.html'
add('21-210-A001',u,'中山道大井宿（第21弾）／配布情報')
add('21-210-B001',u,'女城主の里（第24弾）／配布情報')
add('21-211-A001','https://www.city.minokamo.lg.jp/soshiki/17/1948.html','配布場所・配布時間／配布場所へのアクセス',byIndex=[{'hours':['平日9:00～17:00','年末年始は配布なし']},{'hours':['土日祝9:00～16:00','年末年始は配布なし']}],proposal='市役所分庁舎上下水道課（太田町1900、平日9:00～17:00）が公式に追加。入力に対応関係がなく未登録。')
add('21-213-A001','https://www.city.kakamigahara.lg.jp/event/1005356/1010019/1017805.html','配布場所／配布時間／休館日／在庫状況',['10:00～17:00','第一火曜日（休日は翌平日）・12月28日～1月2日休館。8月第一火曜日は開館。臨時休館あり'])
add('21-216-A001','https://www.city.mizuho.lg.jp/12757.htm','通常カードの平日／土日祝の配布場所・時間（限定合格祈願版の終了とは別）',byIndex=[{'hours':['平日9:00～16:30','年末年始は配布休止']},{'hours':['土日祝9:00～21:00','年末年始は配布休止']}])
u='https://www.city.hida.gifu.jp/soshiki/15/manhorucard.html'
add('21-217-A001',u,'古川町のマンホールカード／配布場所・時間')
add('21-217-B001',u,'神岡町のマンホールカード／配布時間',['9:00～17:00（公式ページに「現在は16:00までの営業」の併記あり。訪問前確認が必要）','水曜日・年末年始休館'],note='配布時間17時とコロナ禍注記16時が併存。時刻を一方に断定せず原文の矛盾を保持。')
add('21-221-A001','https://www.city.kaizu.lg.jp/kurashi/0000003072.html','配布場所・日程／配布時間／在庫状況',byIndex=[{'hours':['平日9:00～16:30'],'condition':'平日のみ'},{'hours':['9:00～17:00','休館日・年末年始は配布なし'],'condition':'平日・土日・祝日'}],note='さぼう遊学館は平日にも配布。基礎データの土日祝限定条件を訂正。')
add('21-404-A001','https://www.town.gifu-ikeda.lg.jp/0000001112.html','池田町のマンホールカード配布について',['9:00～16:30','土日祝・年末年始は平日の配布時間内に電話予約が必要'])
add('21-404-B001','https://www.town.gifu-ikeda.lg.jp/0000001223.html','池田町のマンホールカード配布について',['9:00～16:30','土日祝・年末年始は平日の配布時間内に電話予約が必要'])
add('21-505-A001','https://hayabusamuseum.town.yaotsu.lg.jp/','2026年8月14日 マンホールカード配布情報',['9:30～16:30','月曜休館（祝日は翌日）。年末年始12月28日～1月5日休み（町配布ページ参照）'],note='町ページ8月4日10～16時と施設ページ8月14日9:30～16:30が相違。より新しい施設の明示配布案内を採用。',extraUrls=['https://www.town.yaotsu.lg.jp/7629.htm'])
u='https://www.city.shizuoka.lg.jp/s2432/s001092.html'
add('22-100-A001 22-100-B001',u,'カード別配布場所／配布時間')
u='https://www.city.hamamatsu.shizuoka.jp/suidow-s/kouhou/manholecard.html'
add('22-130-A001',u,'家康くん・直虎ちゃん／観光インフォメーションセンター')
add('22-130-B001',u,'家康くん／犀ヶ崖資料館',['配布時間は市の配布ページに記載なし。GKP案内9:00～17:00は未独立確認','月曜日（祝日は翌日）、祝日の翌日、12月29日～1月3日は配布なし'])
u='https://www.city.numazu.shizuoka.jp/kurashi/sumai/suido/shokai/sewage_line/mhcard.htm'
add('22-203-A001',u,'第1号（富士山とはまゆう）／配布時間・場所',byIndex=[{'hours':['平日8:30～17:15','12月29日～1月3日休み'],'condition':'平日'},{'hours':['平日8:30～17:15','12月29日～1月3日休み'],'condition':'平日'},{'hours':['土日祝8:30～17:15','12月29日～1月3日休み'],'condition':'土日祝'}])
add('22-203-B001',u,'第2号（ラブライブ！サンシャイン!!）／配布場所・時間',['10:00～18:00'])
u='https://www.city.atami.lg.jp/kurashi/suido/1000884/1011837/1016443.html'
add('22-205-A001',u,'貫一お宮／平日第二庁舎・休日第一庁舎／配布時間')
add('22-205-B001',u,'梅と芸妓／配布場所・配布時間',['9:00～17:00','12月29日～1月3日は10:00～15:00','2026年11月18日・19日、2027年1月1日は協会休業につき配布なし（協会公式トップ告知参照）'],extraUrls=['https://ataminews.gr.jp/'])
u='http://www.city.fujinomiya.lg.jp/citizen/copy_of_visuf8000000xs1w.html'
add('22-207-A001',u,'逆さ富士／配布場所・配布時間')
add('22-207-B001',u,'さくやちゃん／配布場所・配布時間')
add('22-207-C001',u,'にじます／配布場所・配布時間',proposal='寄って宮の臨時休業時に富士宮市役所で臨時配布。入力に代替関係なし。市役所のどの窓口か未特定。')
add('22-208-A001','https://www.city.ito.shizuoka.jp/gyosei/soshikikarasagasu/gesuidoka/kurashi_tetsuzuki/1/1/7611.html','配布場所・時間／配布場所の地図',byIndex=[{'hours':['9:00～20:30','毎月第3火曜日（祝祭日は翌日）は休館']},{'hours':['9:00～17:00'],'condition':'東海館休館日（毎月第3火曜日、祝祭日は翌日）のみ'}])
u='https://www.city.fuji.shizuoka.jp/1545150000/p007434.html'
add('22-210-A001',u,'赤富士と駿河湾の白波デザイン（A001）',byIndex=[{'hours':['平日8:30～17:15'],'condition':'平日。窓口アンケートへの回答必須'},{'hours':['土日祝9:00～16:00','12月29日～1月3日休み'],'condition':'土日祝（振替休日含む）'}])
add('22-210-C001',u,'かぐや姫デザイン（消火栓）C001／配布場所・時間・受取条件',['10:00～17:00','モールインフォメーション不在時は渡せない場合あり'],condition='本人ごとに窓口WEBアンケート回答必須。通信可能なスマートフォン等を持参。問合せは富士市上下水道営業課0545-67-2829へ（施設には不可）。')
add('22-210-B001','http://gakunan-haisuiro.jp/link(html)/manhole/manhole.html','配布場所／配布時間／配布方法',byIndex=[{'hours':['平日8:30～17:15','12月29日～1月3日休み']},{'hours':['土日祝9:00～16:00','12月29日～1月3日休み']}])
add('22-211-A001','http://www.city.iwata.shizuoka.jp/kurashi_tetsuzuki/jougesuidou/gedsuidou/1004578.html','配布場所・配布時間／休館日の配布',['9:00～18:00','月曜日（祝日は翌日）・12月29日～1月3日休館'],proposal='休館日は福田支所2階上下水道総務課（磐田市福田400）9:00～16:30、年末年始除く。元入力に関係なし。')
add('22-212-A001','https://www.city.yaizu.lg.jp/life/water-sewage/sewage/other-info/manhole-card.html','配布再開／配布場所・配布時間',['8:45～17:00','年末年始除く'])
add('22-213-A001','http://www.city.kakegawa.shizuoka.jp/life/gesuidou/jyokasonituite_2_2.html','配布について／配布場所・時間',['9:00～16:30（年中無休）'])
add('22-214-A001','http://www.city.fujieda.shizuoka.jp/soshiki/kankyosuido/gesuido/oshirase/1531352696524.html','配布場所／配布時間／在庫配布状況')
add('22-215-A001','https://www.city.gotemba.lg.jp/kurashi/b-6/b-6-1/7287.html','冒頭：令和8年度分の配布枚数は終了。再開は令和9年度予定',status='suspended',reviewUntil='2027-03-31',note='今年度配布枚数終了。恒久終了でなく休止。翌年度再開は予定であり、年度末の確認期限後はunknownへ戻す。')
add('22-219-A001','https://www.city.shimoda.shizuoka.jp/category/020200gesuidou/155727.html','配布について／マンホールカードの残数')
add('22-220-A001','https://www.city.susono.shizuoka.jp/soshiki/11/3/1/21155.html','臨時休止などの情報／配布時間・場所／在庫状況',condition='2026年11月14日・15日は職員不在により終日配布休止。通常は季節別時間。',reviewUntil='2026-11-13',note='未来の臨時休止を条件へ保持。11月14日以降は期限超過としてunknownに戻し、activeを維持しない。')
u='https://www.city.kosai.shizuoka.jp/soshikiichiran/gesuidoka/12799.html'
add('22-221-A001',u,'新居関所マンホールカード／配布について・在庫状況')
add('22-221-B001',u,'うなぽんマンホールカード／配布について・在庫状況')
add('22-225-A001','https://www.city.izunokuni.shizuoka.jp/jyougesui/mhcard.html','配布方法／配布場所・配布時間・在庫状況')
add('22-304-A001','http://www.town.minamiizu.shizuoka.jp/docs/2016113000026/','マンホールカードの配布詳細',['9:00～17:00','12月31日～1月3日は当施設での配布なし'],proposal='12月31日～1月3日は石廊崎オーシャンパーク（石廊崎546-5）9:00～16:00へ。元入力に関係なし。')
u='https://www.town.nagaizumi.lg.jp/soshiki/jyougesui/1_2/11067.html'
add('22-342-A001',u,'マンホールカード配布状況／窓口開庁時間変更に伴う短縮',['9:00～16:30'],note='9～17時から9～16:30へ短縮。休日の日直室の個別明記は市公式では確認できずGKP窓口同定を補助に使用。')
add('22-342-B001',u,'新カラーマンホールカード配布状況')
add('22-344-A001','https://www.fuji-oyama.jp/page/1248.html','配布場所／配布時間',['9:00～17:00','年末年始は配布なし'])
add('22-424-A001','http://www.town.yoshida.shizuoka.jp/6491.htm','マンホールカードの配付場所・時間／在庫状況',proposal='しらすのまどぐち定休日は吉田町役場2階上下水道課（年末年始除く）へ。元入力に代替関係なし。')
add('22-461-A001','https://www.town.morimachi.shizuoka.jp/gyosei/kurashi_tetsuzuki/jogesuido/gesuido/4924.html','配布場所／配布時間',['8:35～17:00','12月29日～1月3日は配布なし'])
add('23-100-A001 23-100-B001','https://www.water.city.nagoya.jp/category/manhole/141508.html','名古屋市上下水道局におけるマンホールカードの配布／デザイン別表')
for k in 'ABCDEF':add('23-202-'+k+'001','https://okazaki-kanko.jp/feature/manhole/manholecard','カード別配布窓口・配布時間・定休日')
# Detailed per-source review notes not constituting approval.
N={
'21-361-A001':'町公式は上下水道課と垂井駅北口の観光案内所（9～14時、月曜休・祝日は翌火曜）を記載。GKPの終日・休日宿日直室を独立確認できず保留。新観光案内所の対応関係も入力にない。',
'22-206-A001':'旧市ページ24140.htmlは404。市内検索結果でも現行カード配布案内に到達せず、観光案内所の配布時間・現況・目的地座標は未確定。',
}
add('21-206-A001','https://www.city.nakatsugawa.lg.jp/life/wc/1/3551.html','おいでん祭（風流踊り）／配布情報')
add('21-219-A001 21-219-B001 21-219-C001 21-219-D001','https://www.city.gujo.gifu.jp/admin/info/post-1158.html','あまご／やまつつじ／GJ8マン／桜並木と長良川に泳ぐ鮎のカード別配布場所・時間・在庫')
D['21-205-A001']['byIndex']=[{'hours':['平日開庁時間内（配布案内に具体時刻の独立明記なし）'],'condition':'平日開庁時間内・北庁舎2階下水道課'},{'hours':['平日開庁時間外、土日祝、年末年始（配布案内に具体時刻の独立明記なし）'],'condition':'平日開庁時間外、土日祝、年末年始・北庁舎1階守衛室'}]
D['22-208-A001']['note']='施設公式に最終入館20時・1月1日休館の記載がある一方、市のカード配布案内は20:30まで・第3火曜休館のみ。カード時間は市の明示案内を保持し、夜間・元日の取扱いは要問い合わせ。'
D['22-208-A001']['extraUrls']=['https://itospa.com/feature/tokaikan/']
D['22-342-A001']['byIndex']=[{}, {'skip':True,'reason':'役場で9:00～16:30へ短縮を確認したが、町公式に休日の日直室配布の明記がない。窓口開庁時間変更の適用範囲を確認できず休日関係は保留。'}]
N.update({
'23-201-A001':'市案内は403。公式観光協会の旧三河港カード終了告知が検索で見つかったが、市の検索結果には2025年12月リニューアル配布あり。A001と新カードの印刷ID同一性と現行在庫の原本確認が必要。',
'23-201-B001':'市案内は403。検索結果に市役所閉庁日（元日以外）は観光案内所で配布との記載。既存じょうほうひろば関係と未登録代替関係の原本確認が必要。',
'23-201-C001':'市案内は403。施設の現行配布条件とリニューアルカードのID対応を原本で確認できない。',
'23-205-C001':'市案内は403。検索結果ではクラシカフェが窓口、年末年始12/29～1/3（GKP12/31～）と相違。原本未取得のため訂正は保留。',
'23-209-A001':'市案内は403。検索結果には平日9～16時、市役所宿直の追加案内がありGKPの美術館と関係が一致しない可能性。窓口別現況の原本確認が必要。',
'23-229-A001':'市案内は403。公式検索結果は9:00～17:00、入力GKP8:30～17:00と不一致。原本が取得できず時間の訂正・配布関係採用は保留。',
'23-361-A001':'町案内は403。公式検索結果7635.htmは2026年4月22日在庫なし・再配布時期未定。原本取得不可のため休止を台帳採用できず、activeに承認しない。',
'23-424-A001':'旧町案内は403。公式検索結果3047.htmは在庫なし・再開未定。公民館の祝日翌日休館もGKPと差分。原本取得不可につき休止訂正を保留。',
'23-238-A001':'市配布案内は403。検索結果で2026年1月6日文化の家へ復帰を確認（臨時リニモテラス終了は過去）。施設トップだけでは配布時刻の独立確認不可。',
'23-342-A001':'町案内は403。公式検索結果に休日予約受取は1階宿直室と明記。入力は建設課1関係のみ。休日窓口を建設課へ誤対応せず原本確認を保留。',
'23-234-A001':'旧市ページは403。検索で新URL/kurashi/suido/1002050/1002059.htmlを確認。2025年11月29～30日の総合体育館は過去の臨時移転であり現在の移転としない。原本・現在の目的地座標未確認。',
'23-227-A001':'市配布案内は403。公式検索結果でエコハウスの盆・GW休業も記載。現行時間・例外日を原本で確認できず採用保留。',
'23-501-A001':'町配布案内は403。検索で見つかった古い案内図PDFは9～17時、基礎GKPは9～16時。2026年7月短縮の原本未取得につき保留。'
})
# Name/address corrections supported by the reviewed municipal facility/card pages.
P={
'place:377a9125bc963427ccae':{'address':'静岡県浜松市中央区鹿谷町25-10'},
'place:81c5c44b2b18c5be8f72':{'address':'静岡県静岡市葵区七間町15-1 上下水道局庁舎1階'},
'place:3ae4954df5521d92e778':{'address':'静岡県沼津市御幸町16-1 水道部庁舎1階'},
'place:b93c428182c323c9093b':{'address':'静岡県熱海市中央町1-1 熱海市役所第一庁舎1階'},
'place:da2c46732042f07a4ce1':{'name':'あじさいエコパーク（蜂屋川クリーンセンター）'},
'place:51ec8a66f05dedab114b':{'address':'岐阜県郡上市八幡町城南町188-54'},
'place:ac91b1a9ed9a8365efe6':{'name':'中津川市ひと・まちテラス1階 総合案内窓口'}
}
# Coordinates are explicit map destinations, individually matched to facility/address.
C={}
def coord(ids,url,lat,lng,label):
 for pid in ids.split():C['place:'+pid]={'url':url,'lat':lat,'lng':lng,'locator':label}
b='https://www.city.takayama.lg.jp/shisetsu/1004139/1000027/'
coord('afef7940a50a4b46b9f3',b+'1001413.html',36.2113368,137.21493940000005,'施設案内 国府支所／所在地880-1／地図を表示する q')
coord('b71259080cfcb6fc37c9',b+'1001408.html',36.03270550000001,136.95621800000004,'施設案内 荘川支所／所在地新渕430-1／地図を表示する q')
coord('a06f703e25492c968c36',b+'1001409.html',36.08336,137.23936979999996,'施設案内 一之宮支所／所在地3100／地図を表示する q')
coord('cd2bc5f252d7f3212ad2 31d2d4cf44cd774ab67d',b+'1001410.html',36.0484488,137.27522290000002,'施設案内 久々野支所／所在地無数河580-1／地図を表示する q')
coord('fde9b94b8dfbd22c7499',b+'1001406.html',36.1702251,137.3099247,'施設案内 丹生川支所／所在地坊方2000／地図を表示する q')
coord('66a0ec8fb8767a43d43a 089d047d9f0ce871adc7',b+'1001407.html',36.1286413,137.18676919999996,'施設案内 清見支所／所在地三日町305／地図を表示する q')
coord('b1a8034431096652d1e4','https://www.city.takayama.lg.jp/shisetsu/1004141/1004416/1004417.html',36.0888864,137.34705039999994,'施設案内 朝日支所／所在地万石800／地図を表示する q')
coord('dd679ceab32d01f0470f','https://itospa.com/feature/tokaikan/',34.9716499,139.09707219999996,'東海館基本情報／東松原町12-10／埋込地図 place q')
coord('377a9125bc963427ccae','https://www.city.hamamatsu.shizuoka.jp/maps/c-saigagake.html',34.719410,137.718708,'犀ヶ崖資料館施設情報／鹿谷町25-10／地図を開く q')
coord('d3d90a695397655a9f91','https://okazaki-kanko.jp/news/4278',34.95893179999999,137.1662133,'ルネふた配布場所 籠田観光案内所／康生通東2-47／埋込地図 place q')
coord('990be32c648e4d8bae69','https://okazaki-kanko.jp/news/5394',34.9144788,137.2172286,'紫ルネ配布場所 道の駅藤川宿／埋込地図 place q。住所はfeature/manhole/manholecardで照合。')
add('23-000-A001','https://eppy.jp/mhcard/','マンホールカード在庫状況／概要／配付時間・場所',['9:30～16:30','月曜日（祝日は翌平日）・12月29日～1月3日休館'])
add('23-202-G001','https://okazaki-kanko.jp/feature/manhole/manholecard','徳川四天王・家康公／りぶら市民活動センター2階／配布時間・定休日',['9:00～12:00、13:00～18:00、19:00～21:00','水曜日（祝日は開館）・12月29日～1月3日休館'])
add('23-232-A001','https://www.aisaikankou.jp/wgs/blog/fp/43/','よくある質問／マンホールカードはどこでもらえますか／住所フッター',['配布時間は観光協会FAQに記載なし（GKPの9:00～17:00は未独立確認）'],condition='観光案内所内で配布。事前に窓口アンケートへの回答が必要。',note='窓口と配布実施は公式FAQで確認。曜日・時間・在庫の詳細は市公式が403のため独立確認できない。')
D['22-205-B001']['reviewUntil']='2026-11-17'
coord('b831c16823b4aa3bed7c','https://www.city.takayama.lg.jp/shisetsu/1004139/1000028/1003902.html',36.284497,137.574447,'施設案内 新穂高センター／奥飛騨温泉郷神坂710番地9／地図を表示する q')
coord('003049ae86c838ff02fe','https://hayabusamuseum.town.yaotsu.lg.jp/',35.472389,137.166117,'JSON-LD GeoCoordinates／同じ施設オブジェクトのname・PostalAddress（八百津1088番地2）')
coord('5fe78965351993358d59','https://nakatsugawa.town/tokusankan/',35.501217,137.50384099999997,'にぎわい特産館／栄町1-1／ez-map_tokusan用google.maps.Markerのposition:new google.maps.LatLng。map centerは不採用。')
N['23-211-C001']='市原本は403。施設公式の記事?p=8900にグリーン棟2階夢現屋が配布場所と明記されるが、記事はスタンプラリーの案内で現行の配布時間・曜日・在庫が確認できない。所在地は施設ページで補助照合。'
D['23-202-G001'].update(locator='下水道事業100周年記念デザイン「岡崎城とルネガール」／りぶら市民活動センター／配布時間・休館日',hours=['9:00～12:00、13:00～18:00、19:00～21:00（時間は前後する可能性あり）','毎週水曜日・12月29日～1月3日休館'])
D['23-202-F001']['hours']=['9:00～17:00','12月31日～1月3日休み']
add('22-206-A001','https://www.city.mishima.shizuoka.jp/page/5716.html','令和8年8月5日配布再開／配布状況／配布場所・時間',['9:00～16:00'],condition='三島観光案内所の受付職員へ。問合せは市下水道課055-983-2662。')
N.pop('22-206-A001',None)
