# Issue #8: HTTP サーバーのキャッシュ検証

対象は `web/scripts/serve.mjs`。Issue #8 を `gh issue view 8` で確認し、2026-11-05 に HTTP 統合テストを実施した。実際のブラウザー、Service Worker、全国実データの操作検証はこの記録の対象外である。

## 確認できた問題

修正前にテストを追加し、18件中16件の失敗を確認した。既存の `sw.js` の再検証ヘッダーと PMTiles Range の2件は通過した。

- `sw.js` 以外には一律 `public,max-age=3600` が付いていた。HTML、一括・分割 JSON、背景データ、版番号のない worker も、取得後1時間は更新の問い合わせなしで HTTP キャッシュを再利用できる。テストは実際のレスポンスヘッダーを使う小さなキャッシュクライアントで、同一 URL のファイル更新後も `old` が返る条件を再現する。ブラウザーの通常リロード動作全体を模したものではない。
- `.br` / `.gz` が存在すると、元ファイルとの対応を確認せず返していた。元ファイルが `new`、sidecar が `old` なら、圧縮を要求する実 HTTP クライアントには `old` が返った。sidecar の更新時刻が元ファイルより新しくても再現するため、時刻比較だけでは防げない。
- メモリーキャッシュはパス・mtime・圧縮方式をキーにしていた。同じ長さの内容を差し替え、mtime を明示的に元に戻すと、identity / Brotli / gzip のすべてで `old` が返った。旧キーを削除しないため、更新世代ごとのエントリーも蓄積する構造だった。

これらはサーバーの再現可能な問題であり、利用者の横浜 A001 が表示されなかった原因を特定した証拠ではない。Cookie、セッション、利用者の SW / Cache Storage / HTTP キャッシュの実状態は取得も検証もしていない。ポート変更で表示が変わったことだけから原因を断定しない。

## 変更

版番号のない URL は `Cache-Control: no-cache` とする。HTTP キャッシュへの保存を禁止せず、再利用前のサーバーへの問い合わせを要求する。ETag / Last-Modified による 304 応答は実装しておらず、問い合わせには現在の内容を 200 で返す。

Vite の `assets/名前-ハッシュ.拡張子` 規約に合う JS / CSS / フォント / 画像は `public,max-age=31536000,immutable` とする。これはビルド時に内容変更で URL が変わる規約を前提にした判定であり、URL のハッシュをサーバーが再計算する方式ではない。それ以外は安全側の `no-cache` にする。

PMTiles 以外は毎回元ファイルを読み、そのバイト列でメモリーキャッシュの世代を判定する。同じパスの旧世代を置き換えるので、mtime が保存されていても旧内容を返さない。sidecar は展開結果が元ファイルに一致した場合だけ利用し、不一致・破損・欠落時は現在の内容から圧縮する。一致した結果は元ファイルが変わるまで再利用する。この設計ではリクエストごとのファイル読み込み・比較、およびキャッシュミス時の展開検証が増える。性能計測は未実施。

ループバック `127.0.0.1` への bind と PMTiles のストリーミング / Range 処理を維持した。PMTiles の版番号のない URL も `no-cache` となる。

既に旧ヘッダーで保存された fresh な HTTP キャッシュを、サーバー側だけで遡って無効にはできない。また、SW が Cache Storage から返す経路の更新や、複数ファイルの同時切り替えはこの修正だけでは保証しない。更新途中のファイル書き込みもトランザクションにはしない。

## 検証結果

```sh
cd web
bun run test scripts/serve.test.ts
bunx oxlint --max-warnings=0 scripts/serve.mjs scripts/serve.test.ts
bunx oxfmt --check scripts/serve.mjs scripts/serve.test.ts
```

最終テストは23件すべて通過。上記3つの原因に加え、正しい sidecar の利用後に元ファイルが更新されたケース、破損 sidecar のフォールバック、ルート HTML、404、PMTiles の全文・範囲指定・終端省略・終端切り詰め・416を検証した。

テストは OS の一時ディレクトリーと `PORT=0` を使い、子プロセスの実 bind アドレスを IPC で取得する。各ケース終了後に起動した子プロセスを停止して終了を待ち、一時ファイルを削除する。実データ、public、dist、CI、package 設定を変更せず、既存の4180サーバーも操作しない。

対象ファイルの lint と format 検査は通過。全体の `bun run typecheck` は、検査時点では別担当の `scripts/sw-generator.test.ts:4` が `./sw-generator.mjs` の型宣言を見つけられない TS7016 で失敗した。担当範囲外のファイルは修正していない。

追加したテスト単体の型検査は、`bunx tsc --noEmit --ignoreConfig --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --types node scripts/serve.test.ts` で通過した。

## 文書とコードの照合

閲覧した `docs/verification/06-map-prototype.md` はビルドハッシュ別の SW キャッシュを説明しているが、HTTP キャッシュと sidecar の鮮度判定は記述していない。HTTP 層の追加検証として本記録を残す。今回のサーバー担当範囲では、既存文書に書かれた仕様とコードの直接の食い違いは見つからなかった。既存記録の SW 保存完了は、同一 URL の HTTP 応答が必ず最新ビルドの内容だったことの証明にはならない。
