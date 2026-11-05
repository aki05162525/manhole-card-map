# Issue43 四国の位置調査・第2弾

2026-11-05、基準 `f66b7e994ef250fadee78f396d22fdfc40ba6a83`、独立worktreeで実施。Issue24 snapshotのoriginalRefがIssue7四国を指す15施設をbatch1 baseline・開始時assembleと照合した。既採用による追加除外0。調査前の[selection.json](../../data/national/location-batch2/shikoku/selection.json)に全15件の分類、8選定の理由、7件の今回除外理由を保持する。第1弾integration/followups、Issue20/25/26/27の保留IDと選定IDは重複なし。旧原本・旧調査は保持した。

## 結果と採用候補

選定8、**採用候補を仮統合2・保留6・今回対象外7**。独立再レビュー前であり承認・マージ済みではない。開始時の全国608・地域15は台帳内未位置集合。今回2件のみを仮統合したassembleでは全国606・地域13。生成全体の施設数や公開ピン数と混同しない。

| 施設・ID末尾 | 実照合の結果 | 判断・停止/再開条件 |
| --- | --- | --- |
| 旧吉野川 `1fe04097ed447030ce` | 保存県PDF p11凡例⑧送風機棟の南が⑨管理棟。GSI moon#25/#26の南北配置と、⑨/#26の南中央突出、⑧/#25の北突出、処理施設群との配置を比較。既存公式案内は管理棟で受付と明記 | 管理棟代表点を提案。送風機棟・処理場全体中心を除外 |
| イオン `66c4c4fbd8f914efac` | 保存会社HTMLは正常。公式20261006フロア図p1で1Fインフォメーションを含む連続主棟を確認。AEON STYLE側の幅広端部、郵便局側の折れ、中庭と独立飲食棟の相対配置を2×2タイル結合外形に照合 | 主棟代表点を提案。最初のタイルの別棟#43やGoogle中心を除外 |
| 月見ヶ丘 `c859f2f66b0d2b847c` | 作図y上限3600による自分の切断を解消しmoon-west#27全体を描画。R7 B-01/B-03の方位、扇形、南研修室突出、コテージ列・西駐車場・南小構造物と照合 | 管理棟の同定はできた。公園側の現カード配布がこの建物内か一次資料で未確定。建物との配布関係を確認できれば再開 |
| ウェルピア `966cf6f4a303ce7b1c` | 11部署CSV中、初回2件に加え都市整備課382108_aed_06.csvを実取得。4行目は名称一致、緯度33770121、経度132.717617、住所1791番地1、設置位置「事務所」 | 緯度範囲外、台帳1761との住所差、CRS未宣言、OGとの独立性未確定。小数点を補正採用しない。市の訂正/作成根拠または独立配置図で再開。11CSV全調査済みとはしない |
| 龍河洞 `4273f7af29262d7c74` | 教育旅行案内p9の写真・指示線で観光センターを洞口/博物館/チケット販売所と区別 | 模式図には縮尺/方位/座標がなく数値外形との独立対応は未完了。名称付きGISまたは配置図で再開 |
| 金倉川 `ba24f603e6bac38d9e` | 公社2025資料の索引は発見、実取得は空応答/GIF | 有効な図原本を取得できず停止。金倉川図の原本取得後に管理棟外形を照合。大束川点を流用しない |
| 大束川 `c7eae2022b55200128` | 同公社原本取得失敗。旧県平面図を保持 | 旧図と数値外形の地理対応は今回未完了。既存図または有効な公社原本を使い再開 |
| 別子 `f48988ec217d052e92` | 公式map.pdf p1は本館1階の「窓口」等を記載。「切符売場」とは書かれていない | 配布案内のチケット売り場との対応は推論と分離。数値外形の照合未完了。本館と川/鉄道/駐車場を照合して再開 |

各IDの全文、参照タイル、取得キー、停止/再開条件は[outcomes.json](../../data/national/location-batch2/shikoku/outcomes.json)。写真・平面図を発見しただけで採用したものではない。入口・室内窓口の測量は要求せず、第1弾と同じ建物代表点基準を使った。

[locations.json](../../data/national/location-batch2/shikoku/locations.json)の2候補は次の通り。manifestでIDと行hashを明示し、[location-lifecycle.json](../../data/national/location-batch2/shikoku/location-lifecycle.json)で施設identity・採用行とhashをbindingした。レビューで重大な疑義が残れば取り下げる。

| 施設 | 数値原典 | 緯度・経度（7桁丸め） | 面積概算 |
| --- | --- | --- | --- |
| 旧吉野川管理棟 | moon#26 | 34.1279514, 134.6128622 | 724.30m² |
| イオン主棟 | aeon#53、east#25、south#2、southeast#0 | 34.0437200, 132.9622799 | 31075.97m² |

月見ヶ丘moon-west#27は1386.82m²、34.1258662, 134.6085014を診断用に計算したが、manifestに選択しない。面積はMercator格子に緯度cos²補正した概算で測量値ではない。レビュアー概算約31079m²を原典値として転記せず、原タイルから再計算した。

## 証拠と再現

[retrievals.json](../../data/evidence/location-batch2/shikoku/retrievals.json)にURL・取得開始/完了・実bytes・hash・失敗を保存。[facts.json](../../data/evidence/location-batch2/shikoku/facts.json)に同定の肯定/否定根拠、原本のページ、旧取得証拠のURL/hash/旧取得時刻を記録した。旧証拠の再利用を新取得とは扱わない。一般HTML/PDF/写真はworkに保持し、Gitには事実抽出とhashだけを残す。イオンの追加日建連事例シートには二次利用禁止表示があるため採用証拠・転載・トレース・数値導出から除外し、別途公式フロアPDFを取得した。伊予市CSVは市のCC-BY表示（版未指定）を確認したが、原本はworkのまま。

[vector-inputs.json](../../data/evidence/location-batch2/shikoku/vector-inputs.json)にはGSI試験公開PMTilesの版、8タイルのXYZ/hash、Range取得記録、共通ETag/Last-Modified、CRS/軸順/精度/利用条件がある。README記載2026-07-01版とHTTP Last-Modified 2026-09-17を区別。基本測量成果とは位置付けられない試験Vectorであり、ラスターの条件を推定していない。国土地理院コンテンツ利用規約/PDL1.0の出典・加工表示を採用行にも記載。規約の新取得はTLS失敗のためbatch1の保存原本・旧取得時刻を維持した。

[derive.py](../../data/evidence/location-batch2/shikoku/derive.py)はgzip PBFからBldAを復号し、feature全文/propertiesを照合、隣接タイルを共通格子へ移動し結合する。JGD2011/Web Mercator XYZ、x東/y南、extent4096、測地系変換なし。単一有効Polygon・穴を含む内包検査を行い、重心が内部なら重心、外ならrepresentative_pointを選ぶ。今回3外形とも重心が内部で、逆投影後小数7桁に丸めて再投影した点も内部。計算記録はfacts・vector・retrievalsの依存hashを持ち、その記録hashを採用行とbindingへ連鎖させた。地理的同定はこの計算だけでは証明されず、独立レビューを別に要求する。

初回地域共有wall時間507.001秒は過去計測として保持。再調査は553.707秒。開始/終了・対象範囲はoutcomes.reassessmentTimingに別記した。追加取得から照合・仮統合記録までであり、先行レビュー読解と後続テスト/再レビューは含まない。施設別への重複加算・全国への外挿はしない。

## 検証

新地域テストを先に追加し、2施設がまだ変化していないため失敗するREDを確認後、仮統合でGREENを確認。元8行全体はbefore-rows.jsonに保持し、他施設・全関係は完全不変、2施設のcoordinate/evidence/locationReviewのみが変わることを検査した。

- `mise exec -- python3 -B -m unittest discover -s tools/national -v`：94件成功。
- `mise exec -- go test -count=1 ./...`：終了コード0。tailの終了コードを代用していない。
- `verify.py --raw`：母集団15、選定8、採用候補2/保留6、元pointer・identity、原本・全参照hash、旧行・全台帳差分を検査。実行cwdに依存しない。hash検査は図の解釈/建物同定/現配布状態の保証ではない。
- `uv run --with mapbox-vector-tile==2.2.0 --with shapely==2.2.0 python .../derive.py`：3外形・結合・代表点・丸め後内包の再計算成功。旧diagnostic.py/JSONのP05/OG点診断も保持。
- 現manifest assemble → Go builddata（保存一覧20261021、review-list20261105、as-of2026-11-05）→全国監査とIssue7監査を実施。親rootの特定保存入力だけを自worktreeへコピーし、入力hashを検査。取得日を書き換えていない。
- 生成カード1313・施設1735・関係1825は不変。施設ピン978→980、蓋1309不変。既存全ピン・カード・配布関係が不変で、新ピンは許可2IDだけ。firstPinは36-000-A001、38-202-C001。full/details/pinsの内容とmanifest filehash、pins.detailsSHA256を照合。[generated-validation.json](../../data/evidence/location-batch2/shikoku/generated-validation.json)に記録。
- `web`の`bun run build`で型検査・ビルド成功。自分の127.0.0.1:4293サーバーでfull/split両方式・2カードの施設名、配布場所ボタン、Mapsへ渡す代表点座標を確認し、サーバーは終了した。詳細/Maps検証結果は[browser-validation.json](../../data/evidence/location-batch2/shikoku/browser-validation.json)を参照。

フックはスキップしない。現地、在庫、残件の全外形同定、PLATEAU、外部Google画面の挙動は未確認。UIコード変更なし。共有変更はmanifestの自地域2選択/bindingと、test_assemble.pyの履歴manifest helper/3箇所のみ。844件や固定digestを更新せず、location-batch2配下の選択とbindingを除いた歴史的基準で旧契約・batch1差分を保つ。地域固有テストは実manifestの差分を検査する。

## レビューと訂正事項

Gemini 4 ArgonはAntigravity quotaにより失敗した。履歴を[review.json](../../data/national/location-batch2/shikoku/review.json)に保持する。その後ユーザーがClaude Opus代替を明示許可。初回Opusは重大6件を指摘し、旧headのマージは保留。[初回レビュー全文](../../data/national/location-batch2/shikoku/opus-review-initial.json)を保存した。新規Opus再レビュー待ちで、初回の未承認を承認扱いしない。

今回訂正した不一致は以下。旧原本や履歴を削除して隠していない。

1. 保存イオンHTMLは正常なのに文書/取得記録がメンテナンスと記した。検索ツールの応答との混同を訂正。
2. イオンは単独タイル判断で停止していた。隣接3タイルを追加取得して4分割主棟を結合し、独立公式フロア図と実照合した。
3. 月見ヶ丘は自作図のy上限でfeature27を切ったのに「複数小外形で同定困難」と記した。完全描画で管理棟を同定し、配布建物の関係という別の保留理由へ訂正。
4. 旧吉野川は保存m25/m26と凡例⑧/⑨の実照合を完了していなかった。相対配置と南突出を比較して管理棟を選定。
5. ウェルピアは11CSV中2件だけの確認だった。該当都市整備課CSVを取得し、数値/住所/OG独立性/権利を記録した。市データ全体に不存在とはしない。
6. 別子図の「窓口」を「切符売場」と断定していた。図の直接記載と配布案内からの推論を分けた。
7. 一律停止理由と各行の到達段階が不一致、行別タイル参照不足、verify成功の過大解釈を訂正。verifyの旧説明はroot実行指定だったが実装は自身の位置からrootを解決していた。説明を実装に合わせた。
8. 既存道の駅やすのselection.firstPinCardIdsはnull、優先度snapshotは[]。原データを勝手に同一化せず、どちらも今回firstPin採用候補ではないと扱う。初回の「不一致なし」報告を撤回。
9. 共有docs/national-assembly.mdの履歴テスト説明はIssue26/batch1除外までだが、今回コードはbatch2選択/bindingも除外する。共有文書は親の統合対象としてここに差を明記する。

PR54本文も今回の2候補/6保留と検証・レビュー状況へ更新する。CI監視・マージは親担当。
