# Issue #8: Service Worker のブラウザー回帰検証

2026-11-05 に [Issue #8](https://github.com/aki05162525/manhole-card-map/issues/8) と現行コードを確認し、`web/scripts/offline-browser-check.mjs` を実装・実行した。合成データを使う実 Chromium の自動統合テストであり、全国実データの地図操作・目視検証とは別の記録である。

## 実行

```sh
cd web
bun install --frozen-lockfile
bunx playwright install chromium
node scripts/offline-browser-check.mjs
```

Node、Bun、Playwright、Chromium、Git の baseline ref が必要。fixture ビルドも通常ビルドも不要。依存やブラウザーがなければ失敗し、スキップしない。CI もこのコマンドを実行し、旧 worker の固定コミットを depth=1 で明示取得する。

旧 worker は固定コミット `cebbcbc42d6d2cf51a8fb6f47616bb5b58824fd8` の `web/scripts/prepare.mjs` から生成テンプレートを抽出して評価する。旧アルゴリズムの写しはテストに持たない。将来 main が更新された場合や shallow checkout では、旧テンプレートを含む ref を取得し、次のように固定できる。テンプレートが存在しない場合も明示的に失敗する。

```sh
OFFLINE_BASELINE_REF=cebbcbc42d6d2cf51a8fb6f47616bb5b58824fd8 node scripts/offline-browser-check.mjs
```

現行 worker は `generateServiceWorker(version, manifest)` の実出力をそのまま配信する。現行の `src/offline-update.ts` を Bun で一時ディレクトリーへ bundle し、状態テキストとボタンを表示する小さなテスト画面から呼び出す。旧版サイトは登録だけを行い、新方式の更新ボタン処理は起動しない。状態問い合わせ関数は実装のものを共用する。

サーバーはテスト専用の Node HTTP サーバーで、`127.0.0.1` の OS 割り当てポートに bind する。一つのシナリオの A→B は同じ origin のまま配信内容を差し替える。全 URL に `no-cache` を付け、インストール途中の停止、HTTP 503、本文破損を注入する。`serve.mjs` の圧縮・sidecar・HTTP キャッシュ検証は [別記録](issue8-server-cache.md) を参照する。このテストではそのサーバーを実行しない。

一時ディレクトリーに bundle と Chromium の persistent profile を置き、`finally` でブラウザー・HTTP 接続・サーバーを閉じてディレクトリーを削除する。`public`、`dist`、`dist-fixture` は読み書きしない。

## 検証する内容

全7管理ファイル（index / legacy HTML、JS、full / details / pins / manifest JSON）の正確なバイト列を SHA-256 にする。split の `detailsSHA256` とデータ manifest も実バイト列から生成する。取得結果を全ファイルの期待ハッシュと比較し、DOM と実行中 JS の版、worker の版と ready 状態も確認する。URL に版番号や cache-busting query は付けない。

- **A→B の保存途中**：最後の manifest 応答を保留し、その間も既存の2タブが A の HTML、JS、full/split を取得できることを確認する。
- **待機と更新操作**：保存後の B が待機中なら通常リロードは A を維持する。実 `startOfflineUpdates` が表示する「更新して再読み込み」を押すと、押したタブは B へ移る。もう一方は A を維持し、そのタブの通常リロードで B へ移る。
- **不完全な配信**：C の pins 本文を manifest と不一致にするケース、D の pins を HTTP 503 にするケースを別々に実行する。install が redundant になり、失敗版の部分キャッシュが削除されること、保存済み B が両タブで利用できること、失敗通知とオフラインでのリロードを検証する。
- **オフライン再起動**：Chromium を profile ごと閉じ、同じ profile で新しいブラウザープロセスを起動する。通信を Playwright とサーバー双方で遮断してから `/` と `/legacy.html` を開き、B の全管理ファイルを確認する。
- **旧 worker の対照実験**：固定コミットの旧生成コードで oldA→oldB を実行する。oldB への activation 完了後も DOM と実行中 JS は oldA のまま、同じ URL の取得結果と worker status は oldB になること、oldA キャッシュが削除されることを確認する。この不整合の再現が負の対照であり、旧実装が安全だという意味の PASS ではない。
- **旧 worker からの移行**：固定コミットの oldA→現行 B を実行する。自動 activation 完了後も2タブは oldA の全管理ファイルを使い、oldA キャッシュが残ることを確認する。通常リロードしたタブだけ B に移り、残ったタブは自分がリロードするまで oldA を使う。
- **保存状態**：実アプリのキー `map-view` と、テスト用の回収記録・フィルターの sentinel を入れ、各段階とブラウザー再起動後に localStorage 全体が完全一致することを確認する。uncaught page exception も最終判定で失敗とする。

## 実行結果と版

最終版を2回連続で実行し、いずれも終了コード0、全ケース PASS。対象スクリプトの oxlint と oxfmt check も通過した。

- Node: `v24.22.1`
- Bun: `1.4.4`
- Playwright: `1.64.1`
- Chromium: `156.0.8078.4`
- 作業 HEAD: `89eca2405194d5a29f65029ad282640411dd77e9`（未コミットのコア変更を含むため、HEAD だけでは検証対象を表さない）
- 旧生成コードの main: `cebbcbc42d6d2cf51a8fb6f47616bb5b58824fd8`
- `sw-generator.mjs` SHA-256: `f08385a67f8759ccb3981871946af21790d916f8c76f3ea231ba6dc878728cc2`
- `offline-update.ts` SHA-256: `6406a85fc53206dce1ee45869a3bea34078dafa54ca5e794ee067d52c3753e7f`
- 現行 A: `prototype-issue8-A-c978c4a5a3a694bf`
- 現行 B: `prototype-issue8-B-4cdb136602188116`
- 失敗注入 C: `prototype-issue8-C-16aab7059ef6922a`
- 失敗注入 D: `prototype-issue8-D-e30b012e0b10ee29`
- 旧 oldA: `prototype-issue8-oldA-5ae28ead6af71ec2`
- 旧 oldB: `prototype-issue8-oldB-0ed582ee36bc486b`

各実行で同じ種類の版情報と結果を stdout に出す。旧→現行の移行直後には `status.version = oldA`、`activeVersion = B`、`ready = true` となり、metadata に既存2クライアントの oldA への対応と `/active = B` が残ることを確認した。origin のポートと client ID は毎回変わる。

開発途中、旧サイトにも新方式の更新クライアントを載せ、activation 完了前を含めて判定していた試験では不整合の失敗が出た。最終テストは旧サイトの登録だけの起動と、新 worker の activation 完了待ちを使う。初期試験の失敗は最終構成の不具合を確定する証拠として扱っていない。最終構成で未解決の失敗はない。

## 限界と文書の照合

この結果は、利用者の4173で横浜 A001 が見えなかった原因の断定にはならない。利用者の実際の Cache Storage / HTTP cache は取得していない。全国実データの横浜 A001、桜木町 D001、複数窓口、休止・終了、検索→詳細→ピン→蓋→Maps、スマートフォン、実画面の React / legacy 配線は未検証。実データの interactive preview は親担当が別途行う。

この小さなサイトは更新プロトコルの検査に特化している。全データの正確なバイト列を検証するが、アプリの full/split ローダーや地図描画、回収記録機能自体は実行しない。Chromium のみで、ディスク容量不足、OS 強制終了、保存領域の eviction、長期間の旧キャッシュ回収も対象外である。

閲覧した文書と現行コードで見つけた差は次の通り。既存の歴史的記録は変更していない。

- `docs/verification/06-map-prototype.md` の「UI フレームワークは使わない」は当時の記録で、現行標準画面は React を使う。
- 同文書の「Service Worker の保存は起動完了後に始め」は旧方式。現行 `offline-update.ts` は地図・データの準備と独立して開始するよう実装され、app / legacy 側から呼ばれる。
- 同文書の pnpm と `pnpm-lock.yaml` は過去の構成で、現行は Bun と `bun.lock`。この差は同文書自身にも移行済みと注記されている。

`web/README.md` のオフライン保存範囲と今回の検証範囲に矛盾はない。ただし、この自動テストの成功だけで README にある地図・一覧・詳細の操作検証まで実施したとはしない。

## 親統合時の追補

独立レビューで、v0 oldB の失敗インストールが残す空キャッシュを前版と誤認する問題を再現した。回帰に oldA→失敗oldB→現行B を追加し、修正前は index.html が503となった。実際の active worker への status RPC から版を取得する修正後は全シナリオが成功。失敗キャッシュの存在自体を使用中の版の証拠としない。上記ハッシュ・版一覧は独立担当完了時点の記録で、統合修正後の値は実行stdoutに出力する。
