# オフライン保存と更新

`web/scripts/prepare.mjs` がHTML・assets・MapLibre worker・full/pins/details/manifestのSHA-256から版を作る。`sw-generator.mjs` はno-store取得とhash検査が全件成功した場合だけ保存を完了する。通信・容量・hash不一致では未完成キャッシュを除去し、旧版を維持する。背景・タイル・外部フォントは保証対象外。

通常の新版はwaitingに留まり、利用者の更新操作で有効化後に再読み込みする。clients.claimは使わない。初回も再読み込みを検証済み保存版へ入る境界とする。旧v0 UIはstatus RPCで旧active workerを確認できた場合に限り自動移行する。

protocolキャッシュにactive版とclientごとの版を保存し、旧タブは旧full/split/assetsを使い続ける。worker再起動でも維持する。キャッシュ欠損は別世代で補完せず503。旧キャッシュと終了clientの記録はまだ回収しないため容量は増える。ブラウザーのorigin全体のevictionや手動部分削除は復元保証外。

`startOfflineUpdates` は地図と独立して状態・操作を通知する。status RPCは5秒、登録や有効化待ちは表示上10秒で打ち切る。保存の日付はデータ日付ではなくworkerの版を表示する。

同一originでの旧worker→新版、full/splitの複数タブ、失敗時の旧版維持、オフライン再起動は `web/scripts/offline-browser-check.mjs` で必要に応じて手動検査する。shallow checkoutでは事前に `git fetch --no-tags --depth=1 origin cebbcbc42d6d2cf51a8fb6f47616bb5b58824fd8` で固定旧Gitコミットを取得する。CIでは実行しない。旧比較画面を削除しても、旧worker互換の合成ページはテスト内に保持する。

削除済みの `/legacy.html` へのナビゲーションは、新しいSWでは現行indexを使う。未制御のオンライン訪問はローカルサーバーが `/` へ転送する。開いたままの旧タブのassets・データは引き続きその保存版を使う。
