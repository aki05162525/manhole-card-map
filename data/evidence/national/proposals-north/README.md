# north 追加調査・採用候補（2026-11-05）

AIによる公式原本照合。現地・人確認ではない。元fragment・元監査・pilot・他地域・Go/UI・不変入力は変更していない。コミット・branch・push・PRなし。

## 実際の追加

`data/overrides/proposals/north.json` はPlaceLedger schema 1。28施設レコード・31関係の追加fragment。
- 明示的な新関係24件（初回proposal由来22件、追加調査の砂川当直室と女川ぷらっと2件）。
- 既存抽出関係の初採用7件（active 3、unknown 4）。unknownは十和田・三春2窓口・涌谷で、住所と施設を照合しても現在条件・在庫まで確定した件数ではない。
- 初回23カードのproposalは20カード採用、3カード保留。南富良野2窓口、西郷2窓口を含む。全proposalの分類は下表とdecisions.json。
- 新規座標0。石巻かわまち・天塩2階建設課は既存facility IDを再利用。多賀城A/Bは同じ観光案内所IDを共有。
- 原文引用・旧legacy参照・sourceHashを各追加関係に保存。現GKP HTMLを再GETしていない。今回採用対象の現指紋だけqualityから読む。北地域の対象指紋は旧入力と同じ。

## 親の統合手順

1. `data/national/patches/north.json` の `file=data/overrides/regions/north.json` の16件をレビュー。各collection/matchで一意に行を特定し、oldExistsとoldの完全一致を検査してfieldをnewへ置換する。元fragmentを直接変更しない今回の再現では一時コピーにだけ適用する。
2. 訂正済みnorthと他地域に `data/overrides/proposals/north.json` をマージ。訂正前northと一時合成northを両方読み込まない。石巻・天塩の共有facility参照があるため、この追加fragmentは元northと一緒に使う。
3. 残る5件のpatchは生成元関係の誤抽出・重複削除候補（北広島4行、会津若松1行）。`old`はfull.jsonの完全な元行、`new:null`。CLI台帳では削除を表現できないため今回の実ビルドでは未適用。親が抽出コード側でレビューする。特に北広島は同一placeIdが2行あるためmatchだけで一括削除せずold全文・出現数で扱う。
4. 位置担当は今回新設した窓口IDも参照する。既存の平日建物代表を別窓口へ誤aliasしない。座標なしの関係は正常に採用できる。

```sh
mise exec -- go run ./cmd/builddata -places data/work/national-input/places.json -review-list /tmp/gkp-current-design.html -as-of 2026-11-05 -out /tmp/north-proposal-current
python data/evidence/national/proposals-north/build.py
mise exec -- go run ./cmd/builddata -places data/work/national-input/places.json -place-fragments /tmp/north-proposals-combined.json -review-list /tmp/gkp-current-design.html -as-of 2026-11-05 -out /tmp/north-proposals-build -audit-out /tmp/north-proposals-audit -merged-places /tmp/north-proposals-merged.json
mise exec -- go run ./cmd/builddata -places data/work/national-input/places.json -place-fragments /tmp/north-proposals-combined.json -review-list /tmp/gkp-current-design.html -as-of 2026-11-10 -out /tmp/north-proposals-nov10
mise exec -- go run ./cmd/builddata -places data/work/national-input/places.json -place-fragments /tmp/north-proposals-combined.json -review-list /tmp/gkp-current-design.html -as-of 2026-12-01 -out /tmp/north-proposals-dec01
python data/evidence/national/proposals-north/verify.py
```

実Go結果は1313カード、1701施設、1749関係。基礎入力1725関係から新関係24件増、既存関係は削除していない。根拠hash・HTTP結果・引用文字列・施設参照・旧関係保持・全23proposal分類・初回未採用30行の理由記録・不変入力SHA256を検証済み。3基準日のGo結果から天塩臨時窓口がupcoming→active→endedとなり、カード全体はendedにならないこと、福島Bは12/1にneeds-reviewへ戻ることを確認した。詳細はvalidation.json。

## 特にレビューする点

- 石巻B：かわまち1階で10/24再開。validFrom=2026-10-24、reviewUntil=2027-03-31。工事終了「4月上旬」を日付に捏造していない。萬画館の既存suspendedは保持。
- 天塩C：11/9～13の2階建設課を追加。9～17時は臨時変更告知直前の原文で、その配置の曖昧さもconditionに残す。温泉は既存reviewUntil=11/8で失効させ、11/14の再開は推測しない。
- 福島B：今月分終了のsuspended / reviewUntil=11/30を維持。恒久終了や自動再開にしない。
- 花巻：初回の関係根拠は配布詳細のないindex.htmlだった。保存済み1012397.htmlで全地域の窓口と時刻を再照合し、6関係のevidenceを訂正する案を作成。
- 古平：既存関係のconditionが空だったため平日に限定する訂正案を作成。休日管理室は別の実窓口。
- 多賀城：公式観光案内所住所は中央2-7-1。元の2-1-7との相違は施設案内原本で訂正。モノクロ代替の時間はカラー版から流用せず未記載。
- 奈井江・桑折：役場代替配布の存在は採用、代替専用時間は空配列にして未掲載と明記。
- 砂川・女川：現在の住所の関係を追加。旧住所の終了日や物理的な同一性を推測せず旧関係を保持。

## 保留と取得失敗

豊富B/Dは役場という建物までの案内しかなく、Aの5番窓口・守衛室の担当を流用しない。サン・ファン館は県ページ導入文と詳細表が不整合で、県広報2022年12月号には津波伝承館へ移す告知がある。現行再開の根拠がなく追加保留。

紋別は別の公式休日変更告知も503、浦河は別公式新着ページも503。遠軽の追加施設一覧はHTTP200だが公開停止画面であり成功根拠ではない。能代の休館・出張展示ページは検索で見つかったが原本3URLが404で未採用。三春www2は証明書ホスト不一致で停止し、検証無効化せず別の公式町広報PDFを使用した。

manifest.jsonは新規取得のみ。元north/manifest.jsonをキャッシュとして再利用する。collect.pyは同一ホスト約1.1秒、逐次実行すること。初回に2プロセスが競合したため2レコードの取得開始時刻が失われた。HTTP200と原本hashはツール実行結果から復元し、保存時刻mtimeをsavedAtとして記録、取得開始時刻と偽っていない。PDFのtxtはpdftotext派生資料であり根拠hashはPDF原本を指す。

## 初回proposal分類

|カード|分類|理由・関係|
|---|---|---|
|01-203-A002|採用|土日祝・年末年始（12/29～1/3）|
|01-215-A001|採用|土日祝|
|01-230-A001|採用|土日祝。12/29～1/3除外|
|01-406-A001|採用|土日祝|
|01-424-A001|採用|みなクル休館日（毎週月曜日）。役場での配布時刻は個別記載なし|
|01-462-A001|採用|月曜～金曜。年末年始除外 / 月曜～金曜。年末年始除外|
|01-487-C001|採用|温泉施設メンテナンス期間の臨時窓口。原文の9:00～17:00は臨時案内直前の記載|
|01-516-B001|保留|公式は冬期休館日「役場」とだけ記載。Aカードの5番窓口をBにも適用する根拠なし。建物単位の重複IDを作らず保留|
|01-516-D001|保留|公式は冬季15～17時「役場」とのみ記載。室内窓口と冬季適用月の特定不足。A窓口へ推測aliasしない|
|01-635-B001|採用|閉館時間等変更あり。訪問前に施設へ確認|
|03-205-B001|採用|土日祝。12/29～1/3除外|
|03-205-C001|採用|土日祝。12/29～1/3除外|
|04-000-A001|保留|現県ページの導入文のみサン・ファン館が残る。県広報2022年12月号は11/1から津波伝承館への変更を明記。再開根拠がなく追加保留|
|04-202-B001|採用|萬画館工事中の臨時窓口。2027年4月上旬までの予定、進捗で変更。再確認期限は3/31|
|04-209-A001|採用|埋蔵文化財調査センター休館日の代替。案内所は12/28～1/5・臨時休館日休み。モノクロ版の代替配布時刻は明記なし|
|04-404-A001|採用|七ヶ浜国際村休館日。年末年始の事業所対応は明記なし|
|04-406-B001|採用|12/28～1/4・臨時休館日除外|
|05-201-A001|採用|土日祝・年末年始。業務により待機の場合あり|
|05-212-A001|採用|はなび・アム休館日のみ（月曜、祝日なら翌平日。臨時休館あり）|
|07-214-A001|採用|土日祝・年末年始。西側ATM裏の入口|
|07-301-A001|採用|旧伊達郡役所休館日の代替。町役場窓口単独の配布時刻・年末年始対応は明記なし|
|07-421-A001|採用|曜日別担当は公式本文に記載なし。旧休日窓口との同一性未確定|
|07-461-A001|採用|毎月第3火曜日（祝日除く）のみ / まるごと西郷館の年末年始休館中のみ。対応日は毎年変わるため要問合せ|

## 初回未採用30入力行の追補

7関係を初採用。残る23行（誤抽出・重複や新窓口で代替した旧関係を含む）の理由も保持する。

|カード|旧関係|結果|理由|
|---|---|---|---|
|01-219-A001|place:8ba98b2323d727d0a52c|source-unresolved|追加探索で休日変更告知content=3243を発見したが原本もHTTP503。検索抜粋は承認不使用。|
|01-226-A001|place:7b0aa5c8f64a73bd6f1e|source-unresolved|現住所の役場当直室を別関係として追加済み。旧庁舎の終了日を推測せず保持。|
|01-234-A001|place:10a13ada0d33b3d6482d|source-unresolved|時刻文字列を施設名と誤抽出。実施設ではない。|
|01-234-A001|place:ac7e763f23b8726063bc|source-unresolved|時刻文字列を施設名と誤抽出。実施設ではない。|
|01-234-A001|place:10a13ada0d33b3d6482d|source-unresolved|時刻文字列を施設名と誤抽出。実施設ではない。|
|01-234-A001|place:2e3e65acd34d1bb673af|source-unresolved|時刻文字列を施設名と誤抽出。実施設ではない。|
|01-462-A001|place:fa545038f081d7c10fa0|source-unresolved|追加検索で浄化センターは503-2/505-5/507-1の複数筆、みなくるは708（枝番なし）の資料を発見。窓口と入力番地の対応を確定できず保留。役場2窓口は別途追加済み。|
|01-462-A001|place:6af442877832ebe57dc4|source-unresolved|追加検索で浄化センターは503-2/505-5/507-1の複数筆、みなくるは708（枝番なし）の資料を発見。窓口と入力番地の対応を確定できず保留。役場2窓口は別途追加済み。|
|01-518-A001|place:dc4171153375d1a6dce6|source-unresolved|町公民館ページはどんと名称と教育委員会の沓形字富士見町2-2を掲載。ただし施設所在地の明記かお問い合わせ住所かの切分け未確定。|
|01-520-A001|place:37e65965ad8bfcbb96a3|source-unresolved|ホロカルはJR駅構内との公式記載を再確認したが地番なし。産業地域振興センターは2019年施設表検索に栄町5-3があるが原本未照合につき未採用。|
|01-520-A001|place:7b1c2a80c7020423d1f7|source-unresolved|ホロカルはJR駅構内との公式記載を再確認したが地番なし。産業地域振興センターは2019年施設表検索に栄町5-3があるが原本未照合につき未採用。|
|01-555-A001|place:70ebe55d7ac1a170bd80|source-unresolved|別公式の社会教育施設一覧id=979もHTTP200の公開停止本文。施設運営者の住所は岩見通南1丁目止まりで番地未確定。|
|01-607-A001|place:e463367eb80a52ce64df|source-unresolved|追加の公式新着ページもHTTP503。元の配布URL失敗を成功に変更しない。|
|01-607-A001|place:8d03cd13139462564daa|source-unresolved|追加の公式新着ページもHTTP503。元の配布URL失敗を成功に変更しない。|
|01-634-A001|place:9562a63e91f31be873ac|source-unresolved|現公式の道の駅裏プレハブは確認。イベント会場東町3-2-7を配布プレハブへ流用せず、旧東町1-9との関係を保留。|
|01-635-B001|place:b4129cad77893682eebf|source-unresolved|公式ショップレジを別関係として追加済み。旧総合案内所の終了を推測しない。|
|02-201-A001|place:f46ab0fab535cf852a33|existing-relation-adopted|土日祝含む。施設事情で時間変更あり。2024/11/13再開|
|02-206-A001|place:87bb76a16d97c7b4aee9|existing-relation-adopted|窓口と住所は確認。配布専用時間未記載、在庫基準日は2021年10月1日のため現在状態は未確定|
|03-210-A001|place:12451148ff8394e10388|source-unresolved|追加公式検索も主屋200-7。管理棟200-8の住所根拠ではないため旧住所を置換しない。|
|04-209-B001|place:80218ca08ff89e947bae|existing-relation-adopted|カラー版。12/28～1/5・臨時休館日除外。旧入力の2-1-7は公式施設案内の2-7-1に訂正|
|04-406-B001|place:71d1a4773fafb552bfcc|source-unresolved|公式総合案内を別関係として追加済み。旧上下水道課窓口の終了を推測しない。|
|04-501-A001|place:9d6b7b9b440c17738339|existing-relation-adopted|施設住所は2024年町公式案内で確認。配布根拠は2016年初回4000枚告知のみ、現在在庫・配布継続未確定|
|04-581-A001|place:bd0ec342835657ceff50|source-unresolved|現住所の別関係を追加済み。旧仮換地表示との対応が未確定のため旧関係は未承認のまま保持。|
|05-202-A001|place:812ab7cc062bf722682b|source-unresolved|工事休館と出張展示の公式告知を追加発見したが保存要求は3URLとも404。展示の移転をカード配布の移転と推定しない。|
|07-202-A001|place:652171d4c3784b670cc1|source-unresolved|建物総称の重複抽出。総合案内・警備員室の2窓口を個別に採用。|
|07-209-A001|place:0604942ab6386d9d3e55|source-unresolved|2019年市広報を追加取得。千客万来館住所55-1の根拠候補は得たが本文配付場所が画像で、現在の専用時間・条件を未確定のまま保持。|
|07-421-A001|place:58e3466a3ec4c3092751|source-unresolved|公式総合案内を別関係として追加済み。旧休日窓口の曜日担当・終了は不明。|
|07-422-B001|place:7db8e601fb17d17714aa|existing-relation-adopted|ゆがわまいちゃん（第14弾）。インフォメーションセンターで1人1枚|
|07-521-A001|place:19e9c73e2a8c8ffc9846|existing-relation-adopted|配布施設は現掲載ページで確認、住所は2018年町広報の施設記載と照合。曜日分担・配布時間未確定|
|07-521-A001|place:6b3394cd8f84aae2ffd7|existing-relation-adopted|配布施設と住所確認。曜日分担・配布専用時間は公式本文に記載なし|

設計文書とGo実装の間の新たな食い違いは見つけていない。上記は初回台帳の根拠参照・条件と公式原本の不一致であり、コード変更ではない。

原本サイズの注意：三春の住所根拠に用いた町広報PDF `e4c9d029a9ba2e1ada38.pdf` は 37439676 bytes。原本bytesのhash照合を維持するため圧縮・抜粋PDFへ置換していない。追加検索だけで未採用の候補URLはadditional-investigation.jsonへ記録した。
