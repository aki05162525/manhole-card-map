"""Build isolated supplements. Never writes the source regional or shared input files."""
import copy, hashlib, json, pathlib
ROOT=pathlib.Path('data/evidence/national/proposals-kanto-north')
def read(p):return json.loads(pathlib.Path(p).read_text())
def write(p,d):pathlib.Path(p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
regional=read('data/overrides/regions/kanto-north.json'); audit=read('data/national/regions/kanto-north.json'); full=read('data/work/national-input/full.json')
cards={c['cardId']:c for c in audit['cards']}; facilities={p['id']:p for p in regional['places']}; rawplaces={p['id']:p for p in full['places']}
hashes=read('/tmp/kanto-north-proposals-current/quality.json')['sourceHashes']
ledger={'schema':1,'places':[],'relations':[]}; patches={'schema':1,'region':'kanto-north','checkedAt':'2026-11-05','patches':[],'proposalDecisions':[],'pendingRelationDecisions':[],'currentSourceReviews':[]}
inspections=[]
def ev(cid,raw,src=None):
 if src is None:src=cards[cid]['proposals'][0]['evidence']
 e=copy.deepcopy(src);e['sourceLocator']=cid+' / '+raw;e['verificationMethod']='AIが保存公式原典の対象カード・実窓口・曜日・配布条件を再読照合。現地確認・人による確認ではない。';inspections.append(copy.deepcopy(e));return e

def metadata_evidence(url,locator):
 m=read(ROOT/(hashlib.sha256(url.encode()).hexdigest()[:20]+'.json'))
 return {'sourceUrl':url,'snapshotPath':m['snapshotPath'],'snapshotSHA256':m['snapshotSHA256'],'sourceLocator':locator,'checkedAt':'2026-11-05','actorType':'ai','verificationMethod':'AIが公式本文を照合。現地確認ではない。'}

def facility(id,name,address,e,legacy=None,phone=''):
 p={'id':id,'legacyIds':legacy or [],'name':name,'address':address,'phone':phone,'evidence':e};ledger['places'].append(p);return id

def rel(cid,pid,hours,condition,e,previous=None,reason=None,raw=None):
 r={'cardId':cid,'placeId':pid,'sourceHash':hashes[cid],'hours':hours,'condition':condition,'status':'active','evidence':e}
 if previous is not None:r['change']={'kind':'addition','reason':reason,'previousPlaceIds':previous,'raw':raw or e['sourceLocator'].split(' / ')[1:]}
 ledger['relations'].append(r);return r

def patch(section,old,new,reason,e):
 patches['patches'].append({'targetFile':'data/overrides/regions/kanto-north.json','section':section,'old':copy.deepcopy(old),'new':copy.deepcopy(new),'reason':reason,'evidence':e})

def decision(cid,state,reason):patches['proposalDecisions'].append({'cardId':cid,'state':state,'reason':reason,'evidence':[x for x in inspections if x['sourceLocator'].startswith(cid)]})
# 1. Existing A-card municipal counter, newly evidenced B relation. Do not invent B hours from A.
cid='08-208-B001';raw='定休日 月曜日(月曜が祝日の場合は翌日)、1月1日から1月3日まで / ※定休日のみ龍ケ崎市役所下水道課にて配布しています。';e=ev(cid,raw)
rel(cid,'facility:kanto-north-ae50151eefa7485f5bed',['観光物産センター定休日のみ（市役所での配布時刻は公式第23弾欄に記載なし。訪問前に要確認）'],'観光物産センター定休日のみ。市役所閉庁日と重なる年始等は配布可否要確認',e,['place:fb8539f44aa2bc8487c0'],'市公式第23弾欄で定休日の代替配布を明記。既存Aの実窓口を共用。',[raw])
decision(cid,'adopted-with-limitations','追加関係を採用。第10弾の9～17時は第23弾へ流用しない。年始の代替可否・時間は未確定として条件に明記。')
# 2. Split mixed legacy guard/citizen entry, keeping the old identity on the guard counter.
cid='08-215-A001';e=ev(cid,'【土曜日・日曜日・祝祭日・年末年始（日曜開庁日以外）】庁舎１階 守衛室 / 【日曜開庁日】（第２、第４日曜 年末年始を除く）庁舎１階 市民課窓口 / 配布時間９：００〜１７：００')
pid=facility('facility:kanto-north-29bd0325065029394d6b','北茨城市役所1階 守衛室','茨城県北茨城市磯原町磯原1630番地',e,['place:29bd0325065029394d6b'],'0293-43-1111')
rel(cid,pid,['9:00～17:00'],'土日祝・年末年始（日曜開庁日を除く）',e)
pid=facility('facility:kanto-north-kitaibaraki-shiminka','北茨城市役所1階 市民課窓口','茨城県北茨城市磯原町磯原1630番地',e,phone='0293-43-1111')
rel(cid,pid,['9:00～17:00'],'第2・第4日曜日の日曜開庁日（年末年始を除く）',e,['place:29bd0325065029394d6b'],'休日混在抽出から日曜開庁日の実窓口を分離。守衛室の終了を意味しない。')
decision(cid,'adopted','旧legacyは守衛室へ対応させ曜日を限定、市民課をaddition。2実窓口に分離。')
# 3. New named Sakuragawa counter. Old sewerage counter remains unapproved, not ended.
cid='08-231-A001';raw='【平日】桜川市水道お客様センター（桜川市役所真壁庁舎2階） / 住所：茨城県桜川市真壁町飯塚911番地 / 9：00～16：00';e=ev(cid,raw)
pid=facility('facility:kanto-north-sakuragawa-makabe-water','桜川市水道お客様センター（真壁庁舎2階）','茨城県桜川市真壁町飯塚911番地',e)
rel(cid,pid,['平日9:00～16:00'],'平日',e,['place:198f070515a946f64966'],'現行公式が示す水道お客様センターを追加。旧下水道課の配布終了は未確認。',[raw])
decision(cid,'adopted-with-limitations','新窓口は採用。旧下水道課の終了日・終了告知は確認できず旧関係は未承認で維持。')
# 4. A heading is not a third facility: alias to the existing weekday counter, condition override applies to both raw relations.
cid='09-201-A001';e=ev(cid,'配布場所：宇都宮市上下水道局（平日：2階経営企画課、土日・祝日：1階警備員室） / 配布時間：午前8時30分から午後5時15分（年末年始を除く平日、土日・祝日）')
old=facilities['facility:kanto-north-67107257814c51043efa'];new=copy.deepcopy(old);new['legacyIds'].append('place:6de4876b701fc38bd3a1');new['name']='宇都宮市上下水道局2階 経営企画課';new['evidence']=e
patch('places',old,new,'建物見出しを独立配布窓口として抽出していた誤り。平日実窓口のaliasへ統合。休日窓口は別施設のまま。',e)
old=next(r for r in regional['relations'] if r['cardId']==cid and r['placeId']==new['id']);new=copy.deepcopy(old);new['condition']='平日（年末年始を除く）';new['evidence']=e
patch('relations',old,new,'見出し由来の空conditionにも平日窓口の条件を明示適用。生の抽出行は履歴として維持。',e)
decision(cid,'adopted','施設を増やさず既存平日窓口へalias統合。Go出力の原文関係行は2行残るが同一card+facility。')
# 5. Numata fourth floor.
cid='10-206-A001';raw='※水曜日は、テラス沼田（沼田市下之町888番地）4階上下水道経営課、5階観光交流課（午前8時30分から午後5時15分）で配布しております。';e=ev(cid,raw)
pid=facility('facility:kanto-north-numata-water-4f','テラス沼田4階 上下水道経営課','群馬県沼田市下之町888番地',e)
rel(cid,pid,['水曜日8:30～17:15','年末年始等の休業は沼田市観光協会の案内を確認'],'水曜日',e,['place:105ca48451844bf76784'],'公式の水曜代替窓口2か所のうち未抽出だった4階窓口を追加。',[raw])
decision(cid,'adopted','4階上下水道経営課を追加、既存5階窓口は維持。')
# 6. Shibukawa conditional alternative: no opening hours masquerading as distribution hours.
cid='10-208-A001';raw='＊定期清掃時は、渋川市役所上下水道局下水道課にて配布します。（渋川市役所第二庁舎の方になりますので、お越しになる際はご注意ください。）';e=ev(cid,raw+' / 問い合わせ先 下水道課：群馬県渋川市石原6番地1')
pid=facility('facility:kanto-north-shibukawa-sewerage','渋川市役所第二庁舎 上下水道局下水道課','群馬県渋川市石原6番地1',e,phone='0279-25-7143')
rel(cid,pid,['中央公民館の定期清掃時のみ（代替先の配布時刻は公式記事に記載なし。要確認）'],'中央公民館の定期清掃時のみ',e,['place:91edb2f2494934178388'],'清掃時の代替配布を公式が明記。通常の中央公民館の配布時間を流用しない。',[raw])
decision(cid,'adopted-with-limitations','代替配布関係のみ採用。第二庁舎の配布時刻は未確定。')
# 7. Ora B: reuse both existing A facilities. Mixed alias goes to weekday facility.
cid='10-525-B001';raw='注：休館日（月曜・火曜（祝日を除く））は都市計画課（役場庁舎2階）にて配布。注：年末年始は休日受付窓口（役場庁舎1階東側）にて配布。 / 午前8時30分から午後5時15分まで。';e=ev(cid,raw)
old=facilities['facility:kanto-north-35386468b06ec27f741e'];new=copy.deepcopy(old);new['legacyIds'].append('place:123de16085c3e8fd58bd')
patch('places',old,new,'Bの混在行を既存2階都市計画課へalias追加。1階休日受付は既存A施設を共用しB関係を明示追加。',e)
rel(cid,new['id'],['8:30～17:15'],'月曜・火曜（祝日・年末年始を除く）',e)
rel(cid,'facility:kanto-north-074d9a4df836af82bb16',['8:30～17:15'],'年末年始',e,['place:123de16085c3e8fd58bd'],'混在抽出から年末年始の1階休日受付を分離。既存Aの実窓口を再利用。',[raw])
decision(cid,'adopted','既存Aの2施設を共用。Bを平日の月火と年末年始の2関係へ分離。施設増加なし。')
# 8. Shiraoka temporary city hall. Read the actual image; do not change the contradictory Ajisai time.
cid='11-246-A001';c=cards[cid];a=next(a for a in c['attempts'] if a['url'].endswith('HP_MHC.jpg'))
src={'sourceUrl':a['url'],'snapshotPath':a['snapshotPath'],'snapshotSHA256':a['snapshotSHA256'],'checkedAt':'2026-11-05','actorType':'ai'}
e=ev(cid,'配布表下段：白岡市役所仮設本庁舎 商工観光課 / 午前9時から午後4時30分まで / 月曜日○、他曜日×',src)
addressEv=metadata_evidence('https://www.city.shiraoka.lg.jp/soshiki/seikatsukeizaibu/shokokankoka/8/703.html','仮設本庁舎 商工観光課内 / 商工観光課消費労政担当 〒349-0292 埼玉県白岡市千駄野432番地');inspections.append(addressEv)
pid=facility('facility:kanto-north-shiraoka-temporary-shoko','白岡市役所仮設本庁舎 商工観光課','埼玉県白岡市千駄野432番地',addressEv,phone='0480-92-1111')
rel(cid,pid,['月曜日9:00～16:30（祝日・年末年始を除く）','味彩センターの臨時休業時も代替配布（土日祝等の閉庁日を除く）'],'月曜日。味彩センター臨時休業時は開庁日に限り代替',e,['place:ac28e5c2b5b86ea16b94'],'市公式配布表に仮設本庁舎の窓口を明記。別公式部署案内で所在地を照合。旧窓口の配布終了は未確認。',['白岡市役所仮設本庁舎 商工観光課 午前9時から午後4時30分まで'])
decision(cid,'adopted-with-limitations','仮設本庁舎を採用。旧庁舎の配布終了は断定しない。味彩センターの午後9:30という矛盾は未解決。')
# 9. Kawajima weekday counter.
cid='11-346-A001';raw='配布時間 【平日】午前9時から午後5時 / ※川島町役場上下水道課（川島町役場1階）でも配布しております。 / ※年末年始（12月29日～1月3日）は配布しません。';e=ev(cid,raw)
pid=facility('facility:kanto-north-kawajima-water','川島町役場1階 上下水道課','埼玉県比企郡川島町大字下八ツ林870番地1',e)
rel(cid,pid,['平日9:00～17:00（12月29日～1月3日を除く）'],'平日（年末年始を除く）',e,['place:4244d9dc97ba1a68e1de'],'さまちか事務所と並行して配布する役場1階窓口を明示追加。',[raw])
decision(cid,'adopted','さまちか・役場日直と別の実窓口を追加。')
# Individually reviewed changed hashes: only these seven cards, never a bulk approval rollover.
reasons={
 '09-211-A001':'現GKPで休止・10/23再開予定文が消失。市10/23午前9時再配布告知、観光協会窓口9～15時・第1第3火曜休を再読。',
 '11-208-A001':'現GKPの参照URL変更先を保存市原典と照合。第1弾の平日/土日祝年末年始窓口、8:30～18時、各在庫ありを確認。',
 '11-208-B001':'現GKPで9～16:30に変更、市第8弾の平日別館/土日祝年末年始1階と一致。',
 '11-208-C001':'現GKPはリンクのみ変更、時間10～17:30・水木休は市と不一致。市第16弾の10～17時・木曜祝日年末年始休、在庫ありを再採用。',
 '11-208-D001':'現GKP参照URL変更。市第16弾YOT-TOKOの9～17時、住所松郷143-3、在庫ありを再読。',
 '11-242-B001':'現GKPの現在一時中止と、市10/26から在庫切れ休止・再開未定が一致。suspendedを再採用。',
 '11-245-B001':'現GKPの一時中止表示が消失。市4400の在庫あり・ステライースト9～17時・第3月曜休（祝日は翌日）を再読。役場代替は市記載の第3月曜だけを採用、振替火曜へ拡張しない。'}
for cid,why in reasons.items():
 for old in [r for r in regional['relations'] if r['cardId']==cid]:
  e=ev(cid,old['evidence']['sourceLocator']+' / '+why,old['evidence']);new=copy.deepcopy(old);new['sourceHash']=hashes[cid];new['evidence']=e
  if cid=='11-245-B001' and 'afe67' in old['placeId']:
   new['hours']=['毎月第3月曜日9:00～17:00（祝日翌火曜日の代替配布は公式本文に明記なし。要確認）'];new['condition']='毎月第3月曜日（ステラ・イースト休館日）'
  if cid in ('11-208-A001','11-208-B001') and '土日祝' in new['hours'][0]:new['condition']='土日祝・年末年始'
  patch('relations',old,new,why,e)
 patches['currentSourceReviews'].append({'cardId':cid,'oldSourceHash':cards[cid]['sourceHash'],'newSourceHash':hashes[cid],'reason':why,'evidence':[x for x in inspections if x['sourceLocator'].startswith(cid)]})
# Explicit disposition of every initially unapproved relation; no blanket completion reason.
remaining={
 'place:29bd0325065029394d6b':('resolved','守衛室へのlegacy対応と日曜市民課のadditionで曜日を分離。'),
 'place:198f070515a946f64966':('pending','現行市配布ページは水道お客様センターを指定。下水道課という旧窓口の配布終了や改称を明示する独立告知は確認できず、旧関係は未承認のまま。新センターだけ追加。'),
 'place:6de4876b701fc38bd3a1':('resolved','市原典の括弧内は平日経営企画課・休日警備員室。独立窓口のない建物見出しを既存経営企画課のaliasに統合。'),
 'place:7f804a59300f56c710b7':('pending','市原典1474333379830は初回HTTP/HTTPSともTLS insufficient security。セキュリティ緩和や別経路での取得回避は実施しない。市観光公式旧韮塚製糸場ページは施設開場時間のみでカード条件なし。検索で見つかった観光公式7160はLOGet!CARD別商品かつ原本404。県21100は流域下水道カードの案内で富岡市カードの配布根拠ではない。検索索引の市配布時刻だけでは承認しない。'),
 'place:123de16085c3e8fd58bd':('resolved','町第2弾記事の月火2階と年末年始1階を分離。両者とも既存A施設を共用。'),
 'place:4661877fca07c64296b8':('pending','市14043の404原本とカテゴリ本文を再読。県kitamoto.htmlは発行ありのみで配布先・在庫は市へ照会と明記。北本市観光協会machikan.comのマンホール検索は表示できるコンテンツなし。2025年の一時終了は検索索引以外の現原本を取得できずsuspendedの確定根拠不足。'),
 'place:767f5909e50bd88d3d3b':('pending','市1206/4701/3419はいずれも同一HP_MHC.jpgを参照。画像は午後9時30分から午後3時30分という矛盾。施設2018年記事?p=2271の検索索引は9:30～17時だが、取得原本は施設トップと同じSHA256で本文なし。古い営業時間から2026年の配布時刻を推測せず未承認。'),
 'place:ac28e5c2b5b86ea16b94':('pending','市703・9089で仮設本庁舎内の商工観光課と所在地は確認でき、新関係は採用。旧GKP窓口が旧本庁舎・暫定窓口のどちらを指すか、当該旧カード窓口の配布終了日は独立根拠なし。終了・削除せず未承認で残す。')}
extra_urls={
 '10-210-A001':['https://www.tomioka-silk.jp/_tomioka-silk-mill/tomioka-silk/news/detail/id%3D7160','https://www.pref.gunma.jp/page/21100.html'],
 '11-233-A001':['https://www.machikan.com/?s=%E3%83%9E%E3%83%B3%E3%83%9B%E3%83%BC%E3%83%AB','https://www.pref.saitama.lg.jp/c1501/manhole/kitamoto.html'],
 '11-246-A001':['https://www.city.shiraoka.lg.jp/miryoku_hasshin/miru_asobu_taberu/2/4701.html','https://www.city.shiraoka.lg.jp/kurashi_tetsuzuki/jogesuido/1/3419.html','https://www.shiraoka-ajisai.center/?p=2271','https://www.city.shiraoka.lg.jp/soshiki/seikatsukeizaibu/shokokankoka/8/703.html','https://www.city.shiraoka.lg.jp/soshiki/keieikikakubu/kikakuseisakuka/shicyousya/9089.html']}
for cid,c in cards.items():
 for r in c['relations']:
  if r['legacyPlaceId'] not in remaining:continue
  state,reason=remaining[r['legacyPlaceId']]
  extra=[read(ROOT/(hashlib.sha256(u.encode()).hexdigest()[:20]+'.json')) for u in extra_urls.get(cid,[])]
  patches['pendingRelationDecisions'].append({'cardId':cid,'legacyPlaceId':r['legacyPlaceId'],'state':state,'reason':reason,'attempts':r['attempts']+extra})
assert len(patches['proposalDecisions'])==9 and len(patches['pendingRelationDecisions'])==8
patches['sourceReview']={'path':'data/evidence/national/list-source/gkp-20261105.html','sha256':hashlib.sha256(pathlib.Path('data/evidence/national/list-source/gkp-20261105.html').read_bytes()).hexdigest(),'retrievedAt':'2026-11-05','retrievedAtPrecision':'date-only; seconds not recorded by original fetch','hashOutput':'/tmp/kanto-north-proposals-current/quality.json'}

write('data/overrides/proposals/kanto-north.json',ledger)
write('data/national/patches/kanto-north.json',patches)
write(ROOT/'inspections.json',inspections)
print('places',len(ledger['places']),'relations',len(ledger['relations']),'additions',sum('change' in r for r in ledger['relations']),'patches',len(patches['patches']))
