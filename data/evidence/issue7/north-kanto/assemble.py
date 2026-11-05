from research import *
from textutil import lines
records=sum([read(BASE/f) for f in ['fetch-records.json','additional-fetch-records.json','targeted-fetch-records.json']],[])
p05=read(BASE/'p05-search.json');decisions=read(BASE/'decisions.json');now=datetime.datetime.now(datetime.timezone.utc).isoformat();checked=now[:10]
def cat(s):
 if any(w in s for w in ['競合','約196','約200','589.2']):return 'coordinate-conflict'
 if any(w in s for w in ['新庁舎','移転','別棟','別館','分館','複数棟','本館','B棟','新館','宿泊棟','仮設']):return 'relocation-or-multiple-buildings'
 if any(w in s for w in ['住所整備','住所修正','一致せず','住所は','住所の同一']):return 'identity-or-address-mismatch'
 if any(w in s for w in ['公園全体','敷地','センター全体','管理棟','施設全体','守衛室の建物']):return 'building-not-identified'
 if '旧原本の再分類のみ' in s:return 'previously-not-reinvestigated'
 if any(w in s for w in ['室内','窓口の明示','新庁舎内','休日窓口']):return 'excessive-indoor-precision-or-missing-building-point'
 return 'insufficient-primary-coordinate-source'
def attempt(r):
 out={k:r[k] for k in ['sourceUrl','snapshotPath','snapshotSHA256','fetchedAt','status','error'] if k in r}
 out['kind']='new-web-fetch'
 if r.get('status')==200:
  b=pathlib.Path(r['snapshotPath']).read_bytes();ss=b.decode('utf-8',errors='replace');ls=lines(b)
  out['result']='実取得原本を保存。下記はHTMLの数値構造の走査であり建物同定の自動承認ではない。'
  out['title']=ls[0][:200] if ls else None
  out['coordinateSignals']={name:bool(re.search(pat,ss)) for name,pat in {'marker':'Marker|markerInfos|markers','viewport':'[?&]ll=|!1m3!1d|"center"','numericQ':r'[?&]q=\d+\.\d+','destination':'!3d|destination=','geoProperty':'latitude|longitude'}.items()}
 else:out['result']='取得失敗。再試行・制限回避なし。'
 return out
updates=[];unresolved=[];audit=[]
for i in ids:
 selected=next((v for s,v in decisions.items() if i.endswith(s)),None)
 rs=[r for r in records if i in r['facilityIds']]
 # supplement shared building pages explicitly, without modifying acquisition metadata
 if 'shibukawa-sewerage' in i:rs += [r for r in records if 'p003056' in r['sourceUrl']]
 if 'caa883' in i:rs += [r for r in records if '1772432999' in r['sourceUrl']]
 att=[attempt(r) for r in rs]
 ms=p05['matches'][i]
 att.append({'kind':'new-p05-original-search','sourceUrl':'https://nlftp.mlit.go.jp/ksj/gml/data/P05/P05-22/P05-22_GML.zip','snapshotPath':p05['zipPath'],'snapshotSHA256':p05['zipSHA256'],'searchResult': [{'sourceLocator':m['locator'],'name':m['feature']['properties']['P05_003'],'address':m['feature']['properties']['P05_004']} for m in ms],'result':'全国ZIPから08–11の全レコードを再検索。名称包含の広い候補抽出であり同名他市・別庁舎・別棟を含む。候補ゼロもデータ網羅性を意味しない。'})
 a={'facilityId':i,'name':places[i]['name'],'address':places[i]['address'],'previousReasonCategory':cat(old[i]['reason']),'previousReason':old[i]['reason'],'attempts':att,'previousReviewReferences':old[i].get('priorReviewReferences',[]),'oldEvidenceReferences':inv[i]['evidence']}
 if selected:
  name,note=selected;matches=[m for m in ms if m['feature']['properties']['P05_003']==name]
  # remove broad search's same-name wrong municipality
  if '4a157' in i:matches=[m for m in matches if m['feature']['properties']['P05_001']=='11238']
  if '91ed' in i:matches=[m for m in matches if m['feature']['properties']['P05_001']=='10208']
  assert len(matches)==1,(i,matches)
  m=matches[0];lng,lat=m['feature']['geometry']['coordinates']
  ev={'sourceUrl':'https://nlftp.mlit.go.jp/ksj/gml/data/P05/P05-22/P05-22_GML.zip','snapshotPath':p05['zipPath'],'snapshotSHA256':p05['zipSHA256'],'sourceLocator':m['locator'],'checkedAt':checked,'actorType':'ai','verificationMethod':note+' P05のJGD2011経緯度数値を保持。建物代表点であり室内・入口の測量ではない。追加原本・照合はdata/evidence/issue7/north-kanto/investigation.jsonの同facilityId。親独立レビュー前の候補。'}
  updates.append({'facilityId':i,'coordinate':{'lat':lat,'lng':lng},'scope':'building','evidence':ev});a.update(decision='candidate',decisionReason=note,selectedP05=m)
 elif '8f14586e294c59e7ff50' in i:
  r=next(r for r in rs if '055984' in r['sourceUrl']);ev={k:r[k] for k in ['sourceUrl','snapshotPath','snapshotSHA256']};ev.update(sourceLocator="initParam_Map.lat=35.8364752846319, lon=139.80710998177528; enjoycore/js/map/map.js: initMap -> LatLng(o.lat,o.lon) -> Marker({position:e})",checkedAt=checked,actorType='ai',verificationMethod='市公式の草加宿芭蕉庵専用施設ページと同市配布記事の施設名を照合。専用ページは神明二丁目5番1号、旧ledgerは二丁目145番地1のため住所訂正を別提案。建物名の同定は一致するため住所表記訂正の採否とは分離して建物Markerを候補とする。Google本体から抽出していない。')
  updates.append({'facilityId':i,'coordinate':{'lat':35.8364752846319,'lng':139.80710998177528},'scope':'building','evidence':ev});a.update(decision='candidate',decisionReason=ev['verificationMethod'])
 else:
  category=cat(old[i]['reason']);detail='今回：公式ページの追加取得・数値構造走査とP05再検索を実施したが、建物点の確定に至らない。旧保留理由（旧時点の調査記述であり今回の取得結果ではない）：'+old[i]['reason']
  if category=='previously-not-reinvestigated':category='insufficient-primary-coordinate-source'
  if 'd35c60' in i:detail='町の配布記事・イベント記事を再取得し店舗所在地を照合。今回も店舗公式詳細は読込タイムアウト。P05に対応する建物候補なし。旧理由の「再取得しない」は旧調査時の記録であり今回は実際に新規取得を試みた。駅前の蓋座標は不使用。'
  if '45e8eab7ba6d2bdde8e5' in i:
   category='relocation-or-multiple-buildings';detail='新規取得した市本庁舎案内では警備室は議会棟1階。P05市役所本体と守衛室の2点を検出したが、守衛室点が現議会棟に対応するかの配置図照合が未了。問い合わせ先の上下水道事務所qは不使用。'
  if any(s in i for s in ['067336','da24aa']):category='relocation-or-multiple-buildings';detail='新規取得した配布2記事は壬生甲3841-1の新庁舎を指定。HTML地図設定はcenterのみでmarkerInfosが空。P05は通町12-22の旧役場なので採用不可。'
  if '278336' in i:category='building-not-identified';detail='P05久保記念観光文化交流館は荒町1105-1で一致するが、現配布ページは配布終了告知で建物内の配布場所を削除。複数施設からなる交流館内の対象建物同定を追加確認できていない。配布状態は変更しない。'
  if 'shiraoka' in i:category='relocation-or-multiple-buildings';detail='新規取得公式記事は仮設本庁舎への移転を明示。P05は同住所の旧市役所で、現仮設建物と対応しない。'
  if 'e9b95' in i:category='insufficient-primary-coordinate-source';detail='P05加須市役所は三俣2-1-1で一致し、市アクセスも同番地。旧県施設情報の下三俣290との差は今回のP05採用障害ではない。ただし新規取得したデザイン蓋記事は配布窓口の現行同定に不足し、観光協会事務局が本庁舎2階に存続する原本の追加確認が未了。'
  if 'e9c407' in i:category='identity-or-address-mismatch';detail='新規配布記事でサプラ2階市民窓口ステーションを確認。P05の所在地文字列は「龍ケ崎市小柴5-1-22Ｆ」。5-1-2と2Fの連結と考えられるが専用施設所在地原本の照合が未了。代表点候補は保存し、未調査を同定済みとしない。'
  nexturls=[r['sourceUrl'] for r in rs if r.get('status')==200]
  unresolved.append({'facilityId':i,'reasonCategory':category,'reason':detail,'nextSource':{'url':nexturls[-1] if nexturls else places[i]['evidence']['sourceUrl'],'required':'当該建物名・番地に対応する公開GIS地点または配置図と建物外形。既知の移転・別棟・座標競合は上記個別障害を解消する原典。室内窓口精度は不要。'},'investigationStatus':'new-web-fetch-and-p05-search; building-not-resolved','attempts':att});a.update(decision='unresolved',decisionReason=detail)
 audit.append(a)
soka=next(u for u in updates if '8f145' in u['facilityId']);idx=next(j for j,p in enumerate(ledger['places']) if p['id']==soka['facilityId'])
corrections=[{'facilityId':soka['facilityId'],'targetFile':'data/work/issue7-baseline/ledger.json','path':f'/places/{idx}/address','old':ledger['places'][idx]['address'],'new':'埼玉県草加市神明二丁目5番1号','reason':'市公式の専用施設案内住所。適用しない提案。配布関係・状態は変更しない。','evidence':soka['evidence']}]
save('investigation.json',audit)
out={'schema':1,'updates':updates,'unresolved':unresolved,'corrections':corrections}
pathlib.Path('data/national/issue7/north-kanto.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('candidates',len(updates),'unresolved',len(unresolved),'corrections',len(corrections))
