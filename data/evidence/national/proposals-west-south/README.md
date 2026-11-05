# west-south 配布関係追補（2026-11-05）

対象は chugoku-shikoku / kyushu-okinawa。元の地域fragment・調査記録・pilot・位置追補ファイルは変更していない。コミット、push、PR、branch変更なし。

## 成果

- `data/overrides/proposals/west-south.json`: PlaceLedger schema 1。新施設18、追加関係22（active 20、unknown 2）、新規座標0。日明浄化センターは既存stable IDを参照し、施設を再定義していない。道の駅やす、宗像下水道課、太宰府市役所総合案内はカード間で施設を共有。
- `data/national/patches/west-south.json`: exact old/new 3件。今治Bの現GKP指紋・休止の再承認、福岡県A/Bの県庁窓口の時間不一致によるunknownへの訂正。旧値の一致を必須とし、last-winsでは適用しない。
- `decisions.json`: 元proposals全24件を20件実施・4件保留に分類。未採用の既存関係31件は全件に保留理由を記録。**未採用31関係の解決は未完了**。
- `manifest.json`: 再利用した公式原本の元パス・取得情報・SHA256。HTML/PDFは元bytesをコピー。`gkp-manifest.json`は親の現GKP保存原本から切り出した該当行と親SHA256、最新qualityのsourceHashを記録。
- `fetches.json`: 追加取得の記録。直方はTLS chain、筑後・みやきは503、水俣変更記事はTLS hostname mismatchで原本取得に失敗。検証無効化・アクセス制限回避は行っていない。検索インデックスの本文だけで承認しない。

## 採用上の注意

米子の追加は英語版のみ。児島は駅案内所営業時間外の商工会議所、さらにその営業時間外の産業振興センターという条件を保持。浜田は年末年始のみ、香南B/Cは休日のみ。久留米はシティプラザ休館時のみで日祝の電話受付をカード手渡しに含めない。大野城は企業総務課と年末年始等の警備員室を分離。

浜田12/29・1/2・1/3（市公式18:00、現GKP共通欄17:45）と香南C（市公式17:30、現GKP17:00）は優先できる更新根拠を確保できずunknown。福岡県庁も2025-04-28県公式17:15を現GKP17:45より単純優先せずunknown訂正を提案。未確定時刻を確定事項として扱わない。

太宰府Cの観光案内所は2026-10-01～12-22のみ。旧太宰府館は既存fragmentに独立した休止根拠とreviewUntilがあるため変更せず、終了や復帰を推測しない。Cの通常休館日の市役所代替は移転期間との適用関係が不明で保留。A/Bの市役所代替は採用するが、カード受付時刻は未確定と明記。

熊本は公式一覧PDFの全12デザインと既存関係を再照合した。Aのみ時間外窓口を追加。平日8:30～17:15を土日祝・夜間に流用していない。D/Hの2026-11-05～17休止とreviewUntilは元fragmentのまま。C/G、E/I、F/Jは各デザインに対応する同一施設・曜日条件を維持。Aの時間外窓口の時刻、南さつま・沖縄の代替窓口のカード受付時刻は原典に明記がなく未確定。

残るproposal保留は、芦屋の夏季期間・時刻不明、日出の年末年始窓口の追加公式原本不足、霧島Bの代替センターの階・受付時刻不明、太宰府C通常休館日の移転期間との整合。霧島Cの2階/1階の条件をBへ流用せず、施設総称を別施設として水増ししていない。

東広島Cについては追加の市公式46197を取得し、2026-09-30更新で配布休止・再開未定を確認した（`higashihiroshima-suspension.html`）。カード全体の休止を裏付けるが、元の空名施設を既存案内所に同定する根拠はなく関係は保留。統合時はカード全体の休止情報も確認してほしい。

未採用関係については保存済み原本の再検討に加え、対象自治体・公式観光サイトに限定して追加検索した。吉賀・壱岐・諫早などの古い公式ページと現GKPの矛盾を解消する新原本は確保できていない。長崎旧ページの第三者変換キャッシュや非公式収集記録、古い配布開始資料だけでは承認していない。残件ごとの根拠不足はdecisions.json参照。

## 検証と再現

rootから実行する。verify-integration.pyは元fragmentを変更せず、exactパッチを検査して一時台帳にだけ適用する。

```sh
python data/evidence/national/proposals-west-south/verify-integration.py
mise exec -- go run ./cmd/builddata -places /tmp/west-south-merged.json -review-list /tmp/gkp-current-design.html -as-of 2026-11-05 -out /tmp/west-south-verified
mise exec -- go run ./cmd/builddata -places /tmp/west-south-merged.json -review-list /tmp/gkp-current-design.html -as-of 2026-09-30 -out /tmp/west-south-before
mise exec -- go run ./cmd/builddata -places /tmp/west-south-merged.json -review-list /tmp/gkp-current-design.html -as-of 2026-12-23 -out /tmp/west-south-after
```

3ビルド成功、追加22関係すべてreview=verified、うち2関係の状態unknownを確認。太宰府新窓口は開始前upcoming／期間中active／終了後ended、旧窓口はreviewUntil後unknown。熊本D/HもreviewUntil後unknown。新施設にcoordinateなし。不変入力3ファイルのSHA256はdocs/national-integration.md記載と一致。結果はverification.json。

`mise exec -- go test ./cmd/builddata` は担当外の `TestCheckedInRegionalFragments: conflicting relation 13-214-D001 / facility:kokubunji-hikari` で失敗。全地域globのbuildも同じ競合で停止。担当2地域＋この追補の実ビルドは成功している。親の統合時に競合解消・全体再検証が必要。

今回新たに見つけたドキュメントとコードの不一致はない。データ原典同士の不一致は上記およびdecisions.jsonに列記。
