"""Generate the review README and segregated proposal candidates; offline."""
from research import *
out=json.load(open('data/national/location-updates/north-tohoku.json'))
audit_rows=json.load(open(ROOT/'audit.json'))['facilities']
m={r['url']:r for r in json.load(open(ROOT/'manifest.json'))+json.load(open(ROOT/'cache-manifest.json'))}
proposals=[]
for pre,source,lat,lng,address,note in [
 ('3443','https://www.city.ishinomaki.lg.jp/cont/10452000a/-map/0001/20180918094836.html',38.43044945875771,141.3097372729112,'宮城県石巻市中央二丁目11番12号','公式施設案内と元facilityの11番21が不一致。誤記・住所修正か別施設かは別担当のproposalレビューで判断。map.jsのMarker.positionまで確認。'),
 ('e2df',next(r['url'] for r in m.values() if r.get('snapshotPath','').endswith('/ea39df31d49404a12436.html')),39.478015,141.9533868,'岩手県下閉伊郡山田町山田第2地割111-2','公式 https://yamada-oisuta.jp/ の埋込先initEmbedが道の駅やまだ - おいすた -の現住所と数値を示す。元facilityの第5地割66-1には適用しない。')]:
 row=next(x for x in audit_rows if x['facilityId'].split('-')[-1].startswith(pre));r=m[source]
 proposals.append({'legacyFacilityId':row['facilityId'],'name':row['name'],'legacyAddress':row['address'],'candidateAddress':address,'coordinate':{'lat':lat,'lng':lng},'sourceUrl':source,'snapshotPath':r['snapshotPath'],'snapshotSHA256':r['snapshotSHA256'],'checkedAt':'2026-11-05','actorType':'ai','note':note,'applyToLegacyFacility':False})
(ROOT/'proposal-location-candidates.json').write_text(json.dumps(proposals,ensure_ascii=False,indent=2)+'\n')
lines=['# 東北の未位置施設・座標追補調査（2026-11-05）','',
'対象は原本 `data/overrides/regions/north.json` の採用関係に属し、cardId先頭02〜07を持つ座標なし施設129件。`target-ids.json` に対象IDを固定した。結果は **63件の座標追補、66件の未解決**。全件を `data/national/location-updates/north-tohoku.json` の updates または unresolved に一度だけ記録した。原fragment・原監査・基礎入力は変更していない。','',
'これはAIによる原典照合で、現地確認・人の確認ではない。座標は公式案内の数値q、施設マーカー、公式がリンク／埋込みした地図の名前付き目的地、または公的施設点。室内窓口の精密位置ではない。表示中心（@、ll、embed viewport）、住所だけのジオコード、駐車場・蓋の点は不採用。花巻市役所の2件は「本庁舎・新館」の共通公式施設代表点で、各棟を独立に測定した点ではない。大石田町役場は平成30年公表CSVを現配布住所と照合した点である。','',
'`audit.json` は129件それぞれの施設名・住所・cardId・調査URL・判定を保持する。`decisions.json` は採用数値と原典中の位置、`unresolved-notes.json` は未確定理由。`embed-links.json` は公式ページから外部地図へのリンク経路であり、同じページの市役所など別施設の地図も含むため、リンク存在だけでは採用していない。','',
'## 原典と取得記録','',
'`manifest.json` は追加取得のURL、実取得日時、HTTP結果、最終URL、原本bytesのパス・SHA256。`cache-manifest.json` は元north監査の取得記録を引き継ぎ、このディレクトリへ原本bytesをコピーした記録（reusedFrom付き）。キャッシュ再利用で日時を更新していない。失敗記録には本文がない。短縮リンクの目的地はmanifestのfinalUrlも原典照合に用いる。元manifest・元原本は変更していない。GKPは再取得していない。追加取得はホストごと約1.1秒の間隔を設け、証明書/TLSエラーやHTTP429を迂回していない。','',
'原本の`.html`拡張子でもCSV・JavaScriptの場合がある。原本のContent-TypeとURLはmanifestを参照。`chisanchishou-text.txt` は保存PDFからpdftotextで作った閲覧補助で、原典はPDF bytes。','',
'## 住所差・別proposalへの引継ぎ','',
'`proposal-location-candidates.json` にかわまち交流センターと道の駅やまだの原典座標を旧facilityId付きで分離した。旧facilityへのupdateには入れていない。萬画館は元住所に中瀬・中央が連結されており配布先混在の整理を要する。チェリーランド総合観光案内所、オガーレ、梁川総合支所・案内所、なにゃーとは原典と台帳の番地対応が未解決。これらを推測で統合していない。','',
'## 再現・検証','',
'リポジトリルートで以下を実行する。いずれもネットワーク取得を行わない。原本northの範囲が変化した場合はverifyが失敗するため、親の最終統合前に実行する。','',
'```sh','python data/evidence/national/locations-north-tohoku/finalize.py','python data/evidence/national/locations-north-tohoku/write_report.py','python data/evidence/national/locations-north-tohoku/verify.py','```','',
'検証内容: 129 IDの完全分割・重複なし、全原本SHA256/byte長、採用座標と原典数値の一致、埋込地図の名前付き目的地レコード内の緯度経度ペア、補助原典参照、未解決の全attempt URL。施設名・現住所の意味的照合は各decisionの記述をレビューする。コード・設計ドキュメント間の食い違いは今回見つかっていない。','',
'## 全対象の判定','',
'| facilityId | 施設 | 判定 |','|---|---|---|']
done={x['facilityId']:x for x in out['updates']};un={x['facilityId']:x for x in out['unresolved']}
for r in audit_rows:
 fid=r['facilityId'];v=done.get(fid)
 result=('採用 '+str(v['coordinate']['lat'])+', '+str(v['coordinate']['lng'])) if v else un[fid]['reason']
 lines.append('| '+fid+' | '+r['name'].replace('|','／')+' | '+result.replace('|','／')+' |')
(ROOT/'README.md').write_text('\n'.join(lines)+'\n')
print('README and 2 proposal candidates generated')
