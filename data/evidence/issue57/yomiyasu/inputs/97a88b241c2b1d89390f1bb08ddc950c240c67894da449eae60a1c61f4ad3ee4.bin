# 位置調査第2弾の最終集計

評価日・集計日：2026-11-05。開始は `f66b7e994ef250fadee78f396d22fdfc40ba6a83`、地域PR45〜56統合後の最終データコミットは `11b7e4ee271a3622f794e09e33d3fd6730be3e2b`。本書はその台帳と保存済み調査・独立レビュー記録を照合したもので、施設情報を新しく取得・確認した記録ではない。

対象はassemble出力の1,586施設ID・1,670配布関係。開始時の未位置608施設から96施設を選定し、20施設IDを採用、76施設を保留した。未選定512施設を含む最終未位置は588施設。施設IDを建物数やカード数へ読み替えない。諏訪と徳之島は各2窓口の明示同棟groupを持つが、IDと配布関係は別のまま保持する。

## 地域別の採否と独立レビュー

各地域名のリンク先に原調査の範囲・出典・精度・停止再開条件がある。選定は `data/national/location-batch2/<地域>/selection.json`、採否は同ディレクトリの `outcomes.json` の8行を基準とし、現manifestの採用差分と一致を検査した。表のレビューは原記録の最終判断であり、本集計で新しい独立レビューを実施したものではない。初回の利用枠エラーを承認や指摘0として数えない。

| 地域 | PR | 選定 | 採用 | 保留 | 独立レビューの最終記録・範囲 |
| --- | --- | ---: | ---: | ---: | --- |
| [北海道](location-batch2-hokkaido.md) | [56](https://github.com/aki05162525/manhole-card-map/pull/56) | 8 | 1 | 7 | [Opus](../../data/national/location-batch2/hokkaido/review.json)：1候補承認。中1・低5件対応、レビュアーは再レビュー不要と指定。 |
| [東北](location-batch2-tohoku.md) | [48](https://github.com/aki05162525/manhole-card-map/pull/48) | 8 | 2 | 6 | [Gemini Flash](../../data/national/location-batch2/tohoku/gemini-final-review.json)：Opus指摘修正後の2点承認。花巻の反証・形状差は保持。 |
| [北関東](location-batch2-north-kanto.md) | [51](https://github.com/aki05162525/manhole-card-map/pull/51) | 8 | 2 | 6 | [Gemini Flash](../../data/national/location-batch2/north-kanto/review-response.json)：2点承認、6保留支持、blocker 0。旧失敗履歴と独立に記録。 |
| [南関東](location-batch2-south-kanto.md) | [47](https://github.com/aki05162525/manhole-card-map/pull/47) | 8 | 0 | 8 | [Gemini Argon](../../data/national/location-batch2/south-kanto/review.json)：研究と保留を承認、重大0。位置採用の承認ではない。 |
| [甲信](location-batch2-koshin.md) | [46](https://github.com/aki05162525/manhole-card-map/pull/46) | 8 | 4 | 4 | [Opus再レビュー](../../data/national/location-batch2/koshin/review-response.json)：4ID採用可、初回指摘解消、軽微対応記録あり。 |
| [北陸](location-batch2-hokuriku.md) | [53](https://github.com/aki05162525/manhole-card-map/pull/53) | 8 | 0 | 8 | [Gemini Flash](../../data/national/location-batch2/hokuriku/review-gemini-flash.json)：研究と8保留を支持、旧PR本文更新が条件で対応済み。数値検討3件を採用とは扱わない。 |
| [東海](location-batch2-tokai.md) | [52](https://github.com/aki05162525/manhole-card-map/pull/52) | 8 | 0 | 8 | [Gemini Argon](../../data/national/location-batch2/tokai/review.json)：研究のみ承認、重大0、任意2件対応。 |
| [近畿東](location-batch2-kinki-east.md) | [49](https://github.com/aki05162525/manhole-card-map/pull/49) | 8 | 2 | 6 | [Gemini Flash](../../data/national/location-batch2/kinki-east/gemini-flash-review.json)：Opus指摘後の2件承認・6保留支持。 |
| [近畿西](location-batch2-kinki-west.md) | [45](https://github.com/aki05162525/manhole-card-map/pull/45) | 8 | 2 | 6 | [Opus再レビュー](../../data/national/location-batch2/kinki-west/opus-review-response.json)：2建物承認。main競合・PR本文・軽微指摘に対応、feature78の誤記は別訂正記録を保持。 |
| [中国](location-batch2-chugoku.md) | [55](https://github.com/aki05162525/manhole-card-map/pull/55) | 8 | 0 | 8 | [Gemini Argon](../../data/national/location-batch2/chugoku/review.json)：条件付き承認。公開日/更新日などを担当者が修正。修正後の独立再レビューなし。 |
| [四国](location-batch2-shikoku.md) | [54](https://github.com/aki05162525/manhole-card-map/pull/54) | 8 | 2 | 6 | [Gemini Flash](../../data/national/location-batch2/shikoku/gemini-final-review.json)：Opus指摘修正後の2施設承認、6保留支持。 |
| [九州沖縄](location-batch2-kyushu-okinawa.md) | [50](https://github.com/aki05162525/manhole-card-map/pull/50) | 8 | 5 | 3 | [Gemini Flash](../../data/national/location-batch2/kyushu-okinawa/review.json)：5施設ID/4建物承認。重大0・軽微2件対応。 |
| 合計 | 12 PR統合済み | 96 | 20 | 76 | 保留は未解決として保持。 |

地域の `nationalUnlocatedAfter` 等は各PRの統合基準で測った途中経過である。例えば九州沖縄の590、四国の593を最終全国値へ転記しない。地域共有の計測秒数も初回・追加調査・検証の範囲が異なり、施設ごとの加算や全国所要時間への外挿は行わない。元の値と原本は変更していない。

## 現台帳の検査と再現

リポジトリrootで実行する。開始manifestと最終manifestをGitから読み、保存入力を現assembleで再構築する。開始manifestが参照する入力は開始コミットとbytes一致を確認した。全国raw、Web取得、生成fullを必要としない。

```sh
python3 -B tools/national/assemble.py \
  --out /tmp/batch2-final-ledger.json \
  --audit-out /tmp/batch2-final-audit.json
python3 -B -m unittest discover -s tools/national -p test_assemble.py -v
```

次の検査は入力・コードを変更せず、地域採否と採用20ID・名称を出力する。開始・最終コミットのGit履歴と、その時点の入力を必要とする。後日の入力更新時は固定コミットの入力を使う。これは現在のmanifest全体を監査するコマンドではない。

Issue57で文書内の検査コードを専用CLIへ移した。旧処理はGit履歴に保持し、処理本体のAST一致、合成入力での出力一致、開始manifestの保存原本hash不変をテストする。以下の確認結果と検証範囲は第2弾集計時の記録である。

```sh
python3 -B tools/national/check_batch2_summary.py
```

確認結果：施設IDの追加・削除・重複なし。選定96IDと採用20IDは地域をまたいでも重複なし。20施設だけのcoordinate/evidence/locationReviewが変化し、名称・住所・電話・営業時間等と全関係は不変。開始時の既存座標施設は全フィールド不変。選定保留76IDは位置未採用のまま。現manifestは位置追補864行（ID重複なし）、exactパッチ12ファイル113操作、位置ライフサイクル9ファイル24binding（ID重複なし）・2group・0event。第1弾の844行・1ファイル4bindingは当時の履歴値である。

本集計ではassemble CLI、上記差分検査、`test_assemble.py` の17テスト成功、追加したローカルリンクの存在、Git差分を検証した。文書のみの変更なのでアプリ全体テスト、全国rawからのGo生成、full/details/pinsの世代検査、ブラウザー、Maps遷移、現地・在庫再確認は再実施していない。各地域文書の生成・UI検証結果はその地域の当時の結果であり、最終統合コミットに対する今回の検証へ合算しない。**生成全体の未位置件数と公開ピン数は今回未集計**。台帳の588から生成値を推計しない。

## 文書と実コードの照合

- `docs/national-assembly.md` の844件・1ファイル4bindingを第1弾時点と明記し、現864件・9ファイル24binding・2groupを追記した。同文書の履歴digest説明はIssue26/30だけの除外だったが、実際の `test_assemble.py:batch1_manifest` は第2弾全地域のlocations/locationLifecycleを除外する。使用するのは選択件数・履歴digest・第1弾差分の3テストであり、地域文書にある「4歴史テスト」とも数え方が異なる。現コードに合わせて共有説明を訂正した。
- `docs/location-priorities.md` の引継ぎ先は第1弾までだったため、第2弾と最終未位置588の参照を追加した。CLI例はIssue20保留のみを渡す既存仕様のまま。第2弾を自動で取り込む機能や更新済み優先度snapshotがあるとは説明しない。
- 旧 [中国四国位置README](../../data/evidence/national/locations-chugoku-shikoku/README.md) は統合用・形式の食い違いなしとするが、原追補 `data/national/location-updates/chugoku-shikoku.json` の101行は絶対snapshotPathのまま。現 `assemble.repo_path` はリポジトリ内の絶対パスも拒否する。原追補は保持され、採用はmanifestで選ぶ相対パス化済みコピーを通る。旧validateの成功を現assembleへ直接入力可能という意味にはしない。
- 旧 [Issue5西南README](../../data/evidence/issue5/west-south/README.md) の食い違いなしという記録に対し、同ディレクトリの `build.py` が生成する旧Evidenceには `fetchedAt` が残る。旧 [Issue5北関東README](../../data/evidence/issue5/north-kanto/README.md) の「今回読んだ範囲では発見していない」に対しても、旧 `assemble.py` は同フィールドを付ける。現Goの `cmd/builddata/ledger.go` はEvidenceの7フィールドと `DisallowUnknownFields` を使うため拒否する。現Pythonの `evidence` は余剰キーを落とさないので、Python成功だけではGo適合を保証しない。原調査スクリプトは今回未修正。現採用のEvidenceは7項目・相対パスであることを最終台帳全行で確認した。取得日時を別の調査メタデータに保持することはこの不一致に含めない。

既存地域記録の初回失敗・仮統合・当時の判断は削除せず、上表の最終レビューへ接続した。上記以外のアプリ実装・全ドキュメントの網羅照合や、非配布のwork原本の再取得・全数再照合はしていない。

## Issue32更新用の完了条件と残る範囲

親Issue32の更新には上の12地域/PR/採否表を使える。完了したのは、各地域8IDの限定調査、採否・停止再開条件の記録、採用20IDの独立承認とmanifest/binding反映、地域PR45〜56のmain統合、既存採用・全関係保持の最終台帳検査である。中国の修正後独立再レビューなしという限界も併記する。

全国残件解消は未完了（選定保留76＋今回未選定512＝588）。現施設への到達・当日在庫・全関係のWeb再確認、最終統合状態の生成物/UI全検証も本集計の完了条件には含めていない。残件索引、成果形式の共通化、次の5〜10施設の試行はIssue57へ分離する。本作業ではIssue32を操作せず、Issue57を閉じない。
