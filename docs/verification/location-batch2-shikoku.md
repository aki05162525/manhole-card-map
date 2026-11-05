# Issue43 四国の位置調査・第2弾

2026-11-05、`f66b7e994ef250fadee78f396d22fdfc40ba6a83` の独立worktreeで実施。対象はIssue24 snapshotの`originalRef`が`issue7/shikoku.json`を指す15施設。batch1 baselineのIDと全件一致し、現manifestのassembleでも全15件が未位置だった。既採用の追加除外は0。全国608件は今回開始時の**台帳内未位置**であり、生成全体の未位置や公開ピン数ではない。

[selection.json](../../data/national/location-batch2/shikoku/selection.json)を調査前に保存し、15件全体の分類・8件の選定理由・残る7件の除外理由を記録した。8件はすべてfirstPin候補で、うち7件は別棟・複合施設に関する既存保留、1件は大型モール。第1弾integration/followups、Issue20/25/26/27の保留IDと選定IDは重複なし。Issue7四国の元調査・独立レビューは保持し、既存P05の同じ検索を再実行していない。

## 結果

**選定8・採用0・保留8、今回対象外7。** [outcomes.json](../../data/national/location-batch2/shikoku/outcomes.json)に施設ID、今回の到達段階、停止理由、具体的な再開条件を収録した。manifest、binding、元台帳、住所、配布関係、アプリ、共有進捗文書は変更していない。全15件の位置を解決したという報告ではない。

- **旧吉野川浄化センター**：県の事後評価書PDF p11で⑨管理棟を確認。新しい配置図は得たが、全体計画図と現在の管理棟の数値外形を対応付けるところは未検証。
- **龍河洞観光センター**：教育旅行案内PDF p9（印刷p8）の写真・指示線で、洞口・博物館・チケット販売所と区別できる。模式図に縮尺・方位・座標はなく、数値外形との対応は保留。
- **ウェルピア伊予**：新たに市AEDの商工観光課・社会教育課CSVを確認したが名称行なし。他部署を含む全CSVの不存在とは主張しない。旧P05点とOG点はGSIの同じタイル内外形に入るため、約56m差だけから別棟とは断定できない。ただし外形は南北タイル境界をまたぐ。模式的な鳥瞰図だけでは本館と連絡部分の対応を独立確定できず保留。同じ外形内という計算結果と建物同定の承認を分ける。
- **金倉川浄化センター・大束川浄化センター**：公社2025事業概要の検索索引を共通新資料として探索。実取得は0 bytes、直接libsパスはGIFだった。検索索引にある図を原本確認済みとは扱わない。旧大束川図は維持し、金倉川へ点を流用しない。
- **月見ヶ丘海浜公園**：R7管理棟改修図面のp7（B-01配置図）・p9（B-03平面図）を取得し、管理事務所を含む弧状建物を確認。旧Yahoo公園点から取得した周辺2タイルには複数の弧状建物があり、当該管理棟全体との対応は未確定。次は図面の方位・コテージ列・駐車場を南西側外形まで照合する。
- **マイントピア別子本館**：検索索引のキッズパークPDFは404。現公式サイトの別経路から園内マップPDFを取得し、本館・1階切符売場を確認した。川・鉄道・駐車場との関係を含む有用な次段階資料だが、数値外形との照合は未実施。
- **イオンモール今治新都市**：会社側の施設ページはメンテナンス応答。モール側は新ドメインへ転送され、アクセス地図はGoogle pbのまま。探索タイルの複数の大型外形だけでモール本体を選択せず保留。探索用の地図中心を採用座標にはしていない。

全8件で入口・室内窓口の測量を条件にしていない。止めたのは建物代表点と現配布建物の独立対応が確定しない段階である。新図面の発見は再開材料であり、採用承認ではない。

## 原本・条件・再現

[取得記録](../../data/evidence/location-batch2/shikoku/retrievals.json)にはURL、開始/完了時刻、HTTP応答、実bytesのhash、実contentType、失敗を保存した。HTTP 200でも空応答・GIF・メンテナンスページは有効資料に数えない。一般HTML/PDF/画像と未条件確認CSVの原本は`data/work/location-batch2/shikoku/`に保持し、Gitには全文を追加しない。Gitに収録するのは事実抽出・取得hashと条件確認済みのGSIタイル5件。

[GSI記録](../../data/evidence/location-batch2/shikoku/vector-inputs.json)は現行PMTilesのRange取得hash、共通ETag/Last-Modified、XYZ、軸順、CRS・加工・精度、条件を保持する。2026-07-01版というREADME記載と、HTTP Last-Modifiedの2026-09-17を区別した。新取得したREADMEは旧保存版と同hash。試験Vectorは基本測量成果と位置付けられていない。国土地理院コンテンツ利用規約/PDL1.0の出典・加工表示に従い、ラスターの測量法条件を推定しない。規約の新取得はTLS互換性で失敗したため、第1弾の2026-11-05T10:46:50Z取得原本をhash確認して再読し、取得時刻を更新していない。

数値診断は[diagnostic.py](../../data/evidence/location-batch2/shikoku/diagnostic.py)で再現できる。JGD2011とWeb Mercatorタイル格子を使い、測地系変換は行わない。OG点のCRSは未宣言であり、補助診断に限定。建物代表点・重心は生成していないため、丸め後の新採用点内包検査の対象は0。新しい採用候補ができたときは独立同定と丸め後内包検査を行う。

地域共有の実測時間は**507.001秒**。selection保存後から調査結果初稿までのwall時間で、検索・取得待ち・原本読解・外形計算を含む。各施設へ重複配賦せず、全国への外挿をしない。後続の検証・Geminiレビュー・PR作業はこの時間に含まない。

## 検証と未確認範囲

次を実施し成功した。

```sh
mise exec -- python3 -B data/evidence/location-batch2/shikoku/verify.py --raw
mise exec -- uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 \
  python data/evidence/location-batch2/shikoku/diagnostic.py
```

15件の母集団とbaseline、8選定・8保留・7除外、元JSON pointer、施設identity、入力hash、取得原本hash、5タイルhash・共通版、結果参照を検査した。現manifestでassembleを再実行し、開始時台帳との**全施設・全関係の完全一致**と全国608・地域15未位置を確認。診断の2点内包を再実行して記録と照合した。

コミット時には既存pre-commitフックがdata配下変更を検出し、`mise exec -- git commit`から`go test -count=1 ./...`（全国統合Python検証を含む）が実行され成功した。フックはスキップしていない。研究のみの変更のためGoによる配信データ再生成、full/details/pins・世代hash、詳細/Maps・ブラウザー、フロントエンド全体テストは実施していない。位置も配布データも変わっていない。現地、在庫、全施設の最新配布状態、PLATEAU、全8件の外形対応完了は未確認。サーバーは起動していない。

共有コード・共有テスト修正は0。今回新たなドキュメントとコードの不一致は発見していない。Issue7原レビューに記載された過去の不一致は原記録として保持し、今回の発見には数えない。

## 独立レビュー

Gemini 4 Argonを `antigravity` / `isolation: shared` / `role: review` で起動したが、`You have reached your Antigravity quota for this period.` により失敗した。[review.json](../../data/national/location-batch2/shikoku/review.json)に失敗を保存。指摘0件・承認済みという意味ではなく、独立レビューは未実施。代替モデルは使わず、採用0・ドラフトPRで親へ返す。利用枠回復後、新規delegate_taskによるレビューが必要。
