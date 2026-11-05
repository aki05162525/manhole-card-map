# Issue 8 final review

2026-11-05。対象: `fix/issue-8-offline-updates` の未コミット変更。レビュー時 HEAD は `89eca2405194d5a29f65029ad282640411dd77e9`。コードの変更、ビルド、dist/public の変更、4180 の操作、子エージェント作成は行っていない。実 UI の連続切り替えによる空白は別担当の調査対象であり、本レビューでは調査していない。

## 結論

**P2 を1件確認。旧 worker の更新失敗履歴がある場合の移行を修正してから承認したい。** 通常の更新・移行シナリオは成功するが、失敗した旧版キャッシュが残ると、使用中の旧タブをその空キャッシュへ固定してしまう。P1 は確認していない。通知タイムアウトには P3 の実装・説明の差もある。

## 確認した不具合

### P2: v0 の失敗キャッシュを使用中の世代として採用する

場所: `web/scripts/sw-generator.mjs:56–68`、特に `caches.keys().filter(...).at(-1)`。

v0 は install の最初に `caches.open(CACHE)` する。続く `addAll` が失敗しても、作成した空キャッシュを消さない。新方式への移行では `/active` がまだないため、最後に作成された `prototype-*` を使用中の旧版と推定している。しかし、そのキャッシュが active worker のものだという保証はない。

実 Chromium で、固定コミットの本物の v0 worker を使って次を再現した。

1. v0 の oldA を保存・有効化し、通常画面と legacy の2タブを開く。
2. v0 の oldB を配信し、`/data/pins.json` を HTTP 503 にして更新する。oldB は redundant になるが、oldB の空キャッシュは残る。使用中の worker と両タブの HTML/JS は oldA のまま。
3. 現行方式の B を正常配信して更新する。v0 移行用の自動 activation が走る。
4. 両タブの pin が oldA ではなく失敗した oldB に設定される。status は `version=prototype-issue8-oldB-0ed582ee36bc486b, activeVersion=prototype-issue8-B-4cdb136602188116, ready=false`。
5. 旧タブから管理対象ファイルを取得すると HTTP 503。既存回帰試験の全ファイル照合は `/index.html: HTTP 503` で失敗した。full/split/assets も同じ空キャッシュを参照する。正しい oldA キャッシュ自体は残っている。

影響: 更新が一度失敗した利用者について、その後の正常な移行が既存タブの追加読み込みを壊す。「他タブは再読み込みまで現在の版を使う」という保証に反する。通常のナビゲーションは B を選ぶためリロードで復旧可能。永続的なユーザーデータ消去は確認していない。

再現には `offline-browser-check.mjs` をメモリー上で読み、migration セクションの `openInitial(origin, oldA, "migration")` の直後に次だけを挿入して実行した。ソースファイルは編集していない。既存の `beginUpdate(page, B)` が fault を解除する。

```js
await beginUpdate(page, oldB, { kind: "http", path: "/data/pins.json" });
await wait(page, () => window.installResult === "redundant");
assert.equal(await page.evaluate(v => caches.has(v), oldB.version), true);
```

修正方向: キャッシュ作成順を active 世代の証拠にしない。移行前に実際の旧 active worker の版を取得・保存するなど、使用中の世代を特定する。少なくともこの失敗履歴をブラウザー回帰に追加する。空キャッシュの除外だけを任意の複数キャッシュに対する完全な解決とは扱わない。

### P3: install が止まると「保存しています」がアプリ側ではタイムアウトしない

場所: `web/src/offline-update.ts:82–86, 121–135`。

10秒タイマーは `register()` の resolve 時に解除される。その時点で `registration.installing` が残っていても、install 完了を待つタイマーは設定されない。状態変更がない間は保存中表示が続く。初回にも更新時にも当てはまり、既存表示の閲覧は可能なので P2 にはしない。

実モジュールを Node のインライン試験で呼び、`register()` が installing worker を持つ登録を返すようにした。setTimeout/clearTimeout を記録し、最後の通知が「確認・保存」、残るタイマーが0であることを assertion で確認した。ブラウザー自身が後で通信を打ち切る可能性と、アプリが10秒で通知する保証は別である。

## 通過した検証と確認範囲

- 本レビューで `bun run test` を再実行: 15ファイル、89件成功。続けて `bun run typecheck` 成功。
- 本レビューで `node scripts/offline-browser-check.mjs` を再実行: 全シナリオ成功。Node 24.22.1、Chromium 156.0.8078.4。固定 baseline は `cebbcbc42d6d2cf51a8fb6f47616bb5b58824fd8`。
- generator SHA-256: `f08385a67f8759ccb3981871946af21790d916f8c76f3ea231ba6dc878728cc2`。client SHA-256: `6406a85fc53206dce1ee45869a3bea34078dafa54ca5e794ee067d52c3753e7f`。
- 追加したメモリー上の移行試験は上記 P2 を再現。通常試験の成功と区別する。
- fixture browser-check の成功は依頼元からの既存結果として受領。本レビューでは再実行・再ビルドしない。実 UI、地図、実際の収集状態の保存機能まで合成プロトコル試験で証明したとは扱わない。

install は no-store、応答成功、展開後 SHA-256 を確認してから保存し、全件後に完了マーカーを置く。通常の新版失敗ではその版だけを削除する。保存完了前には activation しないので、現行方式の通常経路では途中世代の公開を確認しなかった。管理対象の欠損を別世代のネットワーク応答で補わず503にする点も一貫している。

初回の未制御ページを claim せず、明示的リロードを保存版への境界にする設計を確認した。初回のネットワーク読み込みそのものは配備切り替えに対して原子的ではないが、設計文書が明記する制限であり、保存済み世代の不整合と混同しない。

通常の複数タブ更新、waiting 中の reload、更新ボタン、他タブの旧版継続、後続 reload、オフラインでのブラウザープロセス再起動は実ブラウザー試験で成功。worker 再起動後の pin 保持は VM 試験にもある。localStorage を変更・消去するコードは今回の変更にない。ブラウザー試験の map-view/収集/フィルターは合成キーの内容保持であり、未保存の React メモリー状態を reload 後も保持する試験ではない。

HTTP 側は stable URL に no-cache、規約に合う hashed assets に immutable を付与する。sidecar の展開結果と現在の source の比較、同一 size/mtime での差し替え、壊れた sidecar、PMTiles の既存 Range 動作をテストで確認。source を毎回読むコストや同期圧縮の遅延は増えるが、測定なしに性能不具合とは判定しない。

CI は shallow checkout 後に固定旧コミットを明示 fetch し、ブラウザー導入後に回帰を実行する。旧テンプレートがなければ失敗するため、main の更新で負の対照が現行実装へ変わる問題は避けられている。回帰の記録は stdout であり、既存 artifact の PNG は fixture UI 検査のものである。

## 既知の制限と未確認の懸念

- 旧世代キャッシュと終了した client の pin は回収しない。利用期間・配備回数に応じて増え、容量不足で更新できなくなる可能性は実在する設計上の制限。旧版を残す目的が明確で文書化済みのため、本レビューでは追加の P1/P2 ブロッカーとしない。継続運用前に、安全な回収と quota/eviction 試験を別途必要とする。origin 全体の eviction による状態喪失まで防止する保証はない。
- サーバーのメモリーキャッシュは同じパスの旧 source を置換する。無制限な mtime 世代保持は解消。一方、配備のたびに変わる hashed asset のパスは Map に残り、パス総数の上限・削除はない。長寿命サーバーの蓄積リスクであり、今回メモリー枯渇は再現していない。
- status の両ポートと5秒タイマーは終了時に閉じる。install listener/cleanup は画面を破棄するまで保持され、失敗更新を多数繰り返す長時間利用では増える。通常利用での障害は未確認。
- activation と同時の新規タブ作成、worker クライアント作成、二つのタブからほぼ同時に更新操作するケースは専用の競合試験がない。コード上の懸念だけで世代混在を確定しない。上記 P2 はこれらのタイミングに依存せず再現する。
- ディスク容量不足、途中での OS 強制終了、部分的な手動キャッシュ削除、非 Chromium ブラウザーは今回未検証。完了マーカーがある世代は install で再照合しないため、手動部分削除からの修復を保証しないという文書の制限を維持する。

## 見つけた文書と現行コード・検証結果の相違

1. `06-map-prototype.md:33` と `08-mapcn.md:40` の「起動完了後 / map-ready 後に SW 保存」は過去の条件。現在は React mount / legacy 起動前から独立に開始する。過去の起動時間や通信量は現在の条件へ直接適用できない。
2. `06-map-prototype.md:28` の「UI フレームワークは使わない」は過去の構成。現行標準画面は React。
3. 同文書の pnpm 10.33.2、pnpm-lock、pnpm コマンドは歴史的記録。現行 packageManager/CI は Bun 1.4.4 と bun.lock。この移行は同文書にも注記済み。
4. `issue8-update-design.md` の「初期登録・有効化待ちにも10秒」「無期限の処理中を避ける」は範囲が広すぎる。実装は初期 register と明示 activate 操作にはタイマーを持つが、register resolve 後の install 待ちにはない（P3）。
5. 同設計の「v0 移行時は元のキャッシュを採用」「既存タブは旧データを読む」は、失敗した v0 キャッシュが残る場合には成立しない（P2）。`issue8-browser-regression.md` の通常移行成功という記録自体は再現できるが、失敗履歴を含む移行の保証には拡張できない。
6. `issue8-server-cache.md` にある TS7016 による全体型検査失敗は担当時点の記録。現在は `sw-generator.d.mts` が存在し、本レビューで全体型検査は成功。
7. ブラウザー回帰文書・ログの「git main の旧生成コード」は現在は固定コミットの旧コードを指す。実装と CI は可変 main を参照していない。固定 SHA の説明は正しいが、この呼び方は今後の main と区別すべき。

履歴文書を現在の仕様より優先せず、実コードを基準に評価した。これらの文書は編集せず、このレビュー文書だけを追加した。

## 親による指摘対応（レビュー後）

P2: 旧 active worker に status RPC で実際の版を問い合わせ、移行前版を永続化する方式へ修正。失敗oldBキャッシュを残す実Chromium回帰を追加し、修正前の503と修正後のoldA保持を確認。P3: register完了後のinstallにも10秒の通知タイマーと終了時の解除を追加し、単体テストを追加した。移行・タイムアウトの設計文書を修正。「git main」という回帰の呼称も固定baselineへ変更。TS7016は現在解消済み。これは親の修正・再検証記録であり、独立レビューの再実施を意味しない。
