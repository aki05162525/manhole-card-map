from research import *
from decisions import C
from attempts import A,R
import zipfile,io
PS=json.loads((ROOT/'targets.json').read_text())
# Complete reuse records without fetching existing source URLs again.
for p in PS:
 u=p['evidence']['sourceUrl']
 if not any(r['url']==u for r in M):
  old=next((r for r in OLD if r['url']==u),None)
  if old:M.append(dict(old,reusedFrom='data/evidence/national/kanto-south/manifest.json'))
# Attach exact official origin of Google embeds (the original bytes are unchanged).
for r in list(M):
 if not r.get('snapshotPath') or 'google.com/maps/embed' in r['url']:continue
 if 'html' not in r.get('contentType','') and not r['snapshotPath'].endswith('.html'):continue
 s=read(r)
 for v in re.findall(r'<iframe[^>]*src="([^"]+)',s):
  v=html.unescape(v)
  rr=next((x for x in M if x['url']==v),None)
  if rr and 'maps/embed' in v:rr['linkedFrom']=r['url']
save()
notes={
 'welcome.city.yokohama.jp/':'HTTP307のチャレンジHTMLで施設本文を取得できず。アクセス制限回避は行わない。',
 '45303e63-54e5-4afb-9d47-b0df759b2622':'全国観光DBの所在地は高島2-16-1中央通路内という旧住所。南幸1-1-1の現行窓口には使用不可。',
 '141305_public_facility.csv':'市公開CSVを名称住所検索。東海道かわさき宿交流館行を確認。きたテラス/ワクワクアクア同定行なし、入江崎公園は別施設。',
 '0000097219.html':'市のかわさききたテラス内観光案内所本文確認。数値目的地点なし。',
 '0000105394.html':'市ワクワクアクア施設詳細・アクセス確認。広報施設建物の数値地点なし。',
 '1002667.html':'市役所本庁舎を示すqあり。第1別館と一致する根拠にはしない。',
 'map_r07.pdf':'市役所の本館・第1別館を区別する配置図。第1別館の数値座標なし。',
 'sagamikke.com/':'第三者地域情報サイトに店舗座標あり。施設管理者原典ではなく不採用。',
 'bono-sagamiono.jp/access/':'公式の埋込リンクを追跡したが、返された施設レコードは3丁目1-2で対象3-2-1と不一致。',
 'kinuten.com/?page_id=2263':'商店街公式サービスセンター詳細を確認。採用できる数値目的地点なし。',
 'kinuten.com/?page_id=13':'商店街全体のアクセス。埋込マーカー衣笠商店街の住所1-70を確認したが事務所建物の特定目的地とは明示されない。2-28のセンターには不一致。',
 '8_map2026_web.pdf':'商店街公式加盟店地図。センター案内の略図を数値座標化しない。',
 'page85_00001.html':'市の四之宮ふれあいセンター施設詳細。地図qは住所文字列だけ。',
 '200204626.csv':'平塚市公共施設CSV検索。四之宮ふれあいセンター同定行なし。',
 '2024030401.html':'三浦市公式は令和8年4月庁舎移転計画に言及。移転実施及び当該カード新窓口の確定案内ではない。',
 'digitalka_joho/325.html':'三浦市公式アクセス。旧配布先第2分館に特定できる数値目的地点なし。',
 '2/4/3068.html':'秦野市公式センター案内図。略図から座標の補間はしない。',
 '142115_public_facility.csv':'秦野市公共施設CSVを照合。対象管理棟を確定する座標を取得できない。',
 '142115_aed.csv':'秦野浄水管理センター管理棟1階玄関ホール行あり。ただし緯度・経度欄は空。',
 'yamato-kankou.com/about-us/access/':'観光協会所在地シリウス2階を確認。embed応答にはviewportのみでマーカーなし。',
 'yamato-bunka.jp/access/':'シリウス運営者accessは略図とGoogle短縮リンク。リンクは別途取得試行。',
 '2009122800060/':'伊勢原市アクアクリーンセンターの交通案内及びPDF略図。数値目的地点を確認できない。',
 '142140_aed.csv':'伊勢原市AED公開CSVの施設名を照合。アクアクリーン/駅窓口同定行を確認できない。',
 '142140_public_wireless_lan.csv':'伊勢原市WiFi公開CSVの施設名を照合。対象2窓口の同定地点なし。',
 '142140_open_data_list.csv':'伊勢原市公開データ目録を照合。追加の対象施設地点データを発見できない。',
 '11925.html':'葉山しおさい公園詳細は概略図。公園配布受付の数値地点なし。',
 '87342410.csv':'町AED一覧で役場、南郷上ノ山公園事務所入口を確認。同住所のしおさい博物館入口は公園配布窓口と同定できず。',
 '45229409.csv':'町避難施設データを照合。公園全体の避難地は公園受付建物の根拠にしない。',
 '144029_evacuation_space.csv':'清川村の避難所CSVはせせらぎ館等の別施設。役場と同番地でも座標流用せず。',
 'P05-22_14_GML.zip':'国交省2022年施設GISの名称住所とPointを照合。役場・施設の公開地点。市役所本館と別館を混同しない。',
}
def result(r):
 if r.get('error'):return '取得失敗: '+r['error']+'。回避再試行はしていない。'
 if r.get('status')!=200:return f"HTTP {r.get('status')}。施設原典として採用せず。"
 for k,v in notes.items():
  if k in r['url']:return v
 if 'maps/embed' in r['url']:return '公式ページに埋め込まれたレスポンス原本の施設レコードとviewportを区別して読解。採否は施設別reason/decisionに記録。'
 return '原本取得(HTTP200)。施設名称・所在地及び目的地情報を照合。採否は施設別decision/reasonに記録。'
def attempts(i,p):
 chosen=[r for r in M if r['url']==p['evidence']['sourceUrl'] or any(k in r['url'] for k in A[i])]
 chosen+=[r for r in M if r.get('linkedFrom') in {x['url'] for x in chosen}]
 if i in C:
  chosen+=[r for r in M if r['url']==C[i]['url']]
 return [dict(url=r['url'],result=result(r),**{k:r[k] for k in ['fetchedAt','status','snapshotPath','sha256','error','reusedFrom','linkedFrom'] if k in r}) for r in {r['url']:r for r in chosen}.values()]
out={'schema':1,'region':'kanto-south','updates':[],'unresolved':[]};audit=[]
for i,p in enumerate(PS):
 ats=attempts(i,p);assert ats,(i,p['id'])
 a={'facilityId':p['id'],'name':p['name'],'address':p['address'],'attempts':ats}
 if i in C:
  c=C[i];r=next(r for r in M if r['url']==c['url']);assert r['status']==200
  e={'sourceUrl':r['url'],'snapshotPath':r['snapshotPath'],'snapshotSHA256':r['sha256'],'sourceLocator':c['locator'],'checkedAt':datetime.datetime.now(datetime.timezone.utc).date().isoformat(),'actorType':'ai','verificationMethod':'AIが公式施設・自治体の名称、所在地、配布窓口を公開地点原典と照合。建物/施設への地点であり、現地確認・人による確認・室内窓口の測量ではない。'+('国交省公開GISのPointを使用。施設を数値地図で位置確認して整備したデータであり、新規住所ジオコードや行政区域中心ではない。' if 'P05-' in r['url'] else '')}
  update={'facilityId':p['id'],'coordinate':{'lat':c['lat'],'lng':c['lng']},'evidence':e,'scope':c['scope']};out['updates'].append(update);a['decision']=update
 else:
  assert i in R
  out['unresolved'].append({'facilityId':p['id'],'attempts':ats,'reason':R[i]});a['reason']=R[i]
 audit.append(a)
pathlib.Path('data/national/location-updates/kanto-south-kanagawa.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
(ROOT/'review.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
# A relocation-plan conflict is a review proposal, not an approved replacement.
miura=[r for r in M if '2024030401.html' in r['url']][0]
prop={'schema':1,'proposals':[{'facilityId':PS[22]['id'],'kind':'relocation-review-required','cardId':'14-210-A001','note':'公式配布案内は旧第2分館を指す一方、公式2024年公表に令和8年4月移転計画あり。実施・新しい配布窓口が未確定。旧facilityの座標や配布関係は変更しない。','sourceUrl':miura['url'],'snapshotPath':miura['snapshotPath'],'snapshotSHA256':miura['sha256'],'actorType':'ai','verificationMethod':'AIによる公式文書間の記載照合。現地確認ではない。'}]}
(ROOT/'proposals.json').write_text(json.dumps(prop,ensure_ascii=False,indent=2)+'\n')
print(len(out['updates']),'updates;',len(out['unresolved']),'unresolved;',len(M),'manifest records')
