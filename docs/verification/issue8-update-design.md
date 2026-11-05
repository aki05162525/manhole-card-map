# Issue 8: 保存版の更新設計と回帰検証

## 問題と確認範囲

旧 `prepare.mjs` の SW は `cache.addAll(FILES)` で非バージョン付き URL を保存し、インストール後すぐ `skipWaiting()`、有効化時に旧キャッシュを削除して `clients.claim()` していた。HTTP キャッシュに古い JSON が残ると、新しい名前の Cache Storage に古い内容を保存し得る。また旧 HTML を開いたまま、新しい worker が新データを返す。保存状態の問い合わせは地図準備完了後で、更新待機・更新操作の UI はなかった。

これらはコードと回帰テストで確認した欠陥。Issue 8 の特定の 4173 環境について、実際の当時のキャッシュ内容は取得していないため、横浜の表示差の原因を断定しない。実データ・実ブラウザー検証は親担当であり、この記録はその代わりではない。

## 保存と配信

- `prepare.mjs` は各対象ファイルの SHA-256 を計算し、パスとハッシュを含む manifest から版名を生成する。manifest は生成された SW 内に埋め込む。
- install は `cache: "no-store"` で取得し、HTTP 成功と各レスポンスの展開後バイト列の SHA-256 を照合する。リダイレクトも拒否する。全件保存した後だけ完了マーカーを付ける。途中の通信・ハッシュ・容量エラーでは未完成の新版キャッシュを削除し、旧版は変更しない。
- サーバー配備中に新旧ファイルが混ざっても、ビルド時の manifest と不一致ならインストールを失敗させる。HTML・assets・MapLibre worker・full/pins/details/manifest が同じ保存単位になる。
- 対象ファイルは cache-only。キャッシュの欠損をネットワークの別世代で穴埋めせず、503 を返す。クエリー付き full/split リクエストも同じ世代のファイルに正規化する。
- 背景、タイル、外部フォントは従来どおり保証対象外。localStorage の `map-view` や利用者の状態を消す処理はない。

## 有効化と複数タブ

通常、新版は waiting に留まる。`activate` メッセージで `skipWaiting()` し、操作したタブは worker の activated を確認して再読み込みする。初回インストールは通常の SW ライフサイクルで有効化する。`clients.claim()` は使わず、未制御の初回ページには再読み込み操作を案内する。

旧 v0 UI には activate を送る操作がない。永遠に旧 HTML を返し続けないよう、プロトコルの active 記録がなく、実際の旧 active worker が status RPC に回答した場合のみ、検証完了後に自動 skipWaiting する。この移行でも旧キャッシュを削除せず、次回通常再読み込みで新版 UI へ到達する。旧 UI を開き続けるタブへの新しい通知 UI の後付けは行わない。

`manhole-offline-protocol-v1` キャッシュに active の版と client ID ごとの版を永続化する。有効化時、既存クライアントに前版の pin を付ける（既存 pin は保持）。v0 移行時は実際の active worker に MessageChannel で版を問い合わせ、前版として保存する。キャッシュ作成順からは推定しない。5秒以内に回答がない、または回答が不正な場合は新規インストールを失敗させ、旧版を維持する。ページのナビゲーションは新版 HTML を返し、resultingClientId に新版を記録する。既存タブはそのまま旧 full/split/assets を読む。worker の停止・再起動でも pin は維持される。新しい worker クライアントを作るリクエストの resultingClientId にも親の版を引き継ぐ。

旧キャッシュと終了済み client の pin はこの実装では回収しない。複数世代が長期間残り容量が増える制限がある。安全な回収は別途設計する。容量不足なら新版保存が失敗して旧版を保持する。ただしブラウザーによる origin 全体の eviction は防げない。Cache Storage を手動で部分削除した場合も復元を保証しない。

初回のまだ SW に制御されていないオンラインページ自体は、配備中のネットワーク応答を読み得る。保存完了後の明示的な再読み込みを、検証済みの版で開く境界とする。元の v0 キャッシュが既に混在していた場合、その内容を遡って修復することはできない。

## クライアント API

`startOfflineUpdates(onState, options?)` は `{ text, action?, actionLabel? }` を通知し、解除関数を返す。React は mount の effect、legacy は起動前に接続する。どちらも `role="status"` / `aria-live="polite"` と通常の button を使う。地図やデータ取得の失敗が更新確認を妨げない。

`register('/sw.js', { updateViaCache: 'none' })`、updatefound/statechange/controllerchange、ウィンドウの focus で更新を確認する。status RPC は5秒で打ち切り、両ポートを閉じる。初期登録・install待ち・有効化待ちにも10秒の表示上のタイムアウトを設け、無期限の「処理中」表示を避ける。更新失敗時は旧版継続を案内する。

SW のメッセージは以下。

- `{ type: 'status' }` + MessagePort → `{ ready, version, activeVersion, protocol: 1 }`。version は問い合わせ元タブの保存版。旧キャッシュの ready 判定は新ファイル一覧による保守的な判定で、旧 assets 名の相違時は false になり得る。
- `{ type: 'activate' }` → skipWaiting。クライアントは statechange の activated 後に reload。

表示は取得済みデータの日付を保存完了の証拠として流用せず、worker が回答した保存版を示す。別タブが更新した場合、残ったタブは旧版継続と再読み込み操作を表示する。

## RED → GREEN と実行方法

`sw-generator.test.ts` の VM は生成された実際の worker コードを実行する。最初に旧生成コードを関数化して適用し、以下5ケースが assertion で失敗した。

1. HTTP キャッシュが default（期待 no-store）。
2. 通信失敗後に未完成キャッシュが残る。
3. ハッシュ不一致でも保存が成功する。
4. 旧タブの full/split が新版を返す。
5. キャッシュ欠損をネットワークで埋めて200を返す（期待503）。

新版で上記が通り、追加で旧 UI 移行・通常更新の waiting・status のタブ別版・worker 再起動後の pin を検証。クライアントのテストは未実装 module の RED 後、status timeout、初回未制御の明示 reload、waiting の明示 activate、インストール失敗通知と解除を検証する。ブラウザーのライフサイクル全体を VM で代替したとは扱わない。

```sh
mise exec -- bun run --cwd web test
mise exec -- bun run --cwd web typecheck
mise exec -- bun run --cwd web lint
```

この担当では dist/dist-fixture をビルドせず、4180 の稼働中成果物を変更していない。

## 親担当のブラウザー再現手順

1. 同一 origin に旧 v0 ビルドを配信し、full と split の2タブで保存完了まで待つ。map-view を変更する。
2. 新ビルドへ配信を切り替える。旧 cache と新 cache の内容、SW の install/active、version を記録する。通常 reload で新 UI に到達し、map-view を保持することを確認する。
3. プロトコル対応版から次版へ更新する。waiting 中は旧タブの full/pins/details/HTML が旧世代で揃うこと、ボタン操作後は操作タブだけ新版になり、他タブは旧世代を維持することを確認する。再読み込み後は他タブも新版になる。
4. worker を停止・再起動してから旧タブの split details、遅延ロード assets を要求し、同じ旧版を取得できることを確認する。
5. 更新中のネットワーク切断、ファイル404、1ファイルだけ旧バイト列の配備を試す。新 worker が有効化せず、旧版でオフライン再起動できることを確認する。
6. SW を持たない初回ページでも保存完了と再読み込み操作が出ること、地図失敗時でも更新通知が出ることを確認する。
7. 実カードの横浜A001、桜木町D001、複数窓口、休止/終了の導線は親側の実データ検証に記録する。

## 既存ドキュメントとの相違

`docs/verification/06-map-prototype.md:33` と `docs/verification/08-mapcn.md:40` の「起動完了後 / map-ready 後に SW 保存」は過去の測定時点の記録。この変更後は地図と独立して登録・更新確認を開始するので、過去の起動時間・通信量の測定条件をそのまま適用しない。過去記録の本文は改変していない。

2026-11-05 の担当完了時点: Vitest は15ファイル・89テスト成功（同時作業の server テストを含む）。この担当の追加は worker 6件、client 4件。typecheck、担当ファイルの oxlint、oxfmt --check は成功。ブラウザー・ビルドは未実行。
