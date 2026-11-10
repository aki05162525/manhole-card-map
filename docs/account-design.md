# アカウント・記録・フレンドの設計

ログイン、カードの回収の記録、フレンドへの公開を足すための要件と非機能要件。実装前の設計で、性能・費用の数値は計測していない推奨値か仮定。外部仕様は2026-11-10に公式資料で確かめた。

## 機能要件（決定済み）

- 認証はパスキー（WebAuthn）のみ。1アカウントに複数登録でき、改名・削除できる。使い捨ての回復コードを10個発行・再発行でき、使ったコードは無効になる。回復コードで入ったら新しいパスキーを登録させる。メールなどの個人情報は持たない。パスキーと回復コードを両方失ったら復旧できない。
- ログインしなくても地図・検索・詳細はこれまでどおり使える。
- 記録はカードを回収したことだけ。日付とメモを付け、修正・取り消しできる。蓋の訪問・写真は扱わない。
- 地図で回収済みと未回収を区別し、「すべて／回収済み／未回収」で絞り込める。
- フレンドは招待リンクで申請し、相手が承認すると成立する。リンクは期限内なら何度でも使え、作り直すと古いリンクは無効になる。送った申請の一覧・状態は送った側に見せない。解除・ブロックができ、ブロックは相手に知らせない。ブロックはブロック一覧から解除できる。
- フレンドにだけ、回収した枚数・どのカードか・回収した日・回収マップを見せる。メモは本人だけが見る。全体公開とプロフィールURLの共有はしない。
- 表示名を持つ。アカウントを削除すると記録・フレンド関係・パスキー・回復コードをすべて消す。書き出しは後回し。

## 構成

| 要素 | 方針 | 理由 |
| --- | --- | --- |
| API | 今の Worker `manhole-card-map` にスクリプトを足し、`assets.run_worker_first` で `/api/*` と各ページの HTML を Worker に通す。ページは LINE のアプリ内ブラウザーからなら `?openExternalBrowser=1` を付けて302で転送し（パスキーを使える標準ブラウザーで開かせる。付いていれば転送しない）、それ以外は `ASSETS` からそのまま返す | 同じオリジンになり、CORS も Cookie の Domain 指定も要らない。JS・CSS・データ・画像は今までどおり静的資産が直接返り、無料・無制限のまま。ページの表示は Worker の呼び出しとして数える。[C1][C2] |
| 画面 | 今のマルチページの静的HTMLのまま。ログイン状態でHTMLを出し分けない。設定・招待のページも静的に生成する | HTMLのキャッシュ、`404-page`、SPAフォールバックなしを変えない |
| DB | D1 を1つ（`--location=apac`）。read replication は使わない | フレンド・ブロック・記録の関係を SQL の一意制約と batch で守れる |
| 使わないもの | KV、Durable Objects、別 API ドメイン | KV は結果整合で、ログアウトやブロックの即時反映に向かない。[C7] Durable Objects を持つ Worker にはプレビューURLが作られない。[C5] 別ドメインは Cookie・CORS・配信が二重になる |
| カード台帳 | 静的 JSON のまま。D1 にはカードの表を持たない | 台帳の正本は Git と生成処理。二重管理を避ける |
| API の実装 | 小さな TypeScript の Worker。Hono は使ってよいが必須にしない。WebAuthn の検証は保守されているライブラリを使う | エンドポイントは20前後。安全性はフレームワークより認可の位置と SQL の制約で決まる |

`run_worker_first` と `not_found_handling: 404-page` の組み合わせは、固定している wrangler の版で、存在するページ・存在しないページ・`/cards.html` の転送・`/api`・Worker を通したページへの `_headers` の適用をローカルの workerd で確かめた（`web/worker/worker.test.ts`）。`run_worker_first` を外すと存在しないページが Worker に渡るので、この設定は必須。

### データの単位

| 表 | 主な列 | 備考 |
| --- | --- | --- |
| users | id（乱数128bit）、display_name、created_at | 連番IDを外へ出さない |
| credentials | credential ID、user_id、公開鍵、sign_count、transports、label、created_at、last_used_at | |
| recovery_codes | user_id、code_hash、used_at | 再発行で全件を置き換える |
| sessions | token_hash、user_id、kind（normal / recovery）、created_at、expires_at、verified_at（直近のパスキー認証） | |
| used_challenges | nonce、expires_at | 検証に通った challenge の nonce。期限を過ぎたら消す（AU-3） |
| recovery_failures | bucket（10分単位の窓）、failures | 全利用者の回復の失敗数（AU-10） |
| registration_counter | window_start（最新の10分単位の窓）、count | 全利用者の新規登録の数（AZ-7）。1行だけで、窓は後ろに戻らない。アカウントを削除しても減らない |
| applied_changes | change_id、applied_at | 操作が適用された印（PR-6）。user に外部キーを張らないので、アカウントを削除しても残る |
| records | user_id、card_id、received_on、memo、updated_at。主キー (user_id, card_id) | 1カード1記録 |
| invites | user_id（主キー）、token_hash、expires_at | 1人1本。作り直すと上書き |
| friend_requests / friendships / blocks | 2人の ID | friendships は小さいIDを先にして1行 |
| records_write_events | id、user_id、written_at | 書き込み1回につき1行。記録とフレンドの書き込みを合わせて直近1分の件数を数え、AZ-7 の「書き込みは1人1分60回」を守る。古い行は次の書き込みのときに消すので、1人60行まで。名前は記録 API で作ったときのまま |
| rate_limits | user_id、kind、window_start、count。主キー (user_id, kind) | 1日などの長い期間の上限の件数。今は申請の「1人1日20回」だけで、kind は `friend-request`、期間は日本時間の暦日 |

別の D1 の tombstones には kind、subject、object、created_at、state（pending / done）、change_id を持つ（PR-6）。

外部キーは `ON DELETE CASCADE` にする。D1 の外部キー制約は既定で有効で、`batch()` は途中で失敗すると全体を戻す。[C15]

### 地図との結合

- 未ログインでは今とまったく同じ。API を呼ばない。
- ログイン中は、HttpOnly のセッション Cookie とは別に、秘密を含まない表示用 Cookie（`signed_in=1`）を出す。これがあるときだけ、地図の初期描画の後に自分の記録（カード番号と日付だけ）を取得する。メモは詳細を開いたときに取る。
- 記録を取得できなければ「記録を読み込めませんでした」と出し、絞り込みを無効にする。取得できないカードを未回収と表示しない。
- 401 が返ったら（セッション切れ）、表示用 Cookie と記録をメモリから消し、未ログインの表示に戻す。

## 非機能要件

### 可用性・性能

| ID | 要件 | 方針・推奨値 | 検証 |
| --- | --- | --- | --- |
| AV-1 | API が止まっても閲覧は止まらない | `/api/*` 以外は Worker を通さない。HTML・公開 JSON・地図の開始を API の完了待ちにしない | API の 500・429・503・遅延のときに地図・検索・詳細が動くことを単体テストで確かめる |
| AV-2 | 失敗を正直に出す | 読み取り失敗を未回収として描かない。書き込みは保存中・失敗・確定を区別し、失敗したら画面を元に戻して知らせる。オフラインでの自動再送はしない | API 単体テストとフロントの単体テスト |
| AV-3 | 稼働の目標 | 数値の SLA は置かない。障害に気づいてから24時間以内の復旧を努力目標にする | — |
| PF-1 | 未ログインの初期表示を重くしない | 未ログイン時の追加リクエストは0件。地図エントリの JS の増分は gzip 後 5KB 以内。WebAuthn のクライアントコードはログイン・設定のページ（`account.html`）が読み込むモジュールから静的 import し、地図・一覧などの束には入れない。既存のサイズ予算を緩めない | `bun run sizes` で前後を比べる。`check-deploy.mjs` は地図・一覧・about・404・規約の各ページから静的 import だけを辿り、WebAuthn のコードが入っていたら失敗させる |
| PF-2 | 記録の重ね合わせで初期表示を遅らせない | 記録の取得は地図の初期描画の後。応答はカード番号と日付だけ（最大でも1,313件程度） | 実地図でログイン時と未ログイン時の起動を比べる |
| PF-3 | 記録操作の応答 | 受け取り登録・修正・取り消しは画面を先に更新する。サーバー応答は日本の通常回線で p75 500ms 以内を目標にする | 本番で数十回測る。D1 の apac 配置は保証されないので実測で確かめる。[C9] |
| PF-4 | Worker の CPU 時間 | 1要求 10ms 以内（無料枠の上限）。回復コードや招待トークンに低速ハッシュを使わない | WebAuthn の署名検証の CPU 時間を Workers Logs で確かめる（未計測）。[C3] |
| PF-5 | 私的データをキャッシュしない | `/api/*` はエラーを含めて `Cache-Control: private, no-store`。記録を localStorage・IndexedDB に保存せず、ログアウトでメモリから消す | `smoke-deploy.mjs` に `/api/` のヘッダー検査を足す |

### 認証

| ID | 要件 | 方針・推奨値 | 検証 |
| --- | --- | --- | --- |
| AU-1 | RP ID とオリジン | RP ID は `manhole-techo.com`、許可するオリジンは `https://manhole-techo.com` だけ。Host から組み立てない。clientDataJSON の origin・type、rpIdHash、UP・UV、credential の持ち主を検証する | 別オリジン・別 RP ID・type の取り違え・UV なしを拒否するテスト。[C10] |
| AU-2 | 登録の設定 | `residentKey: "required"`、`userVerification: "required"`、`attestation: "none"`、`excludeCredentials` に登録済みを入れる。alg は Ed25519（-8）、ES256（-7）、RS256（-257）。WebAuthn の `user.name` には表示名を入れず「マンホール手帳」と作成日にする | iOS Safari・Android Chrome・Windows・macOS の実機で登録とログイン。[C11] |
| AU-3 | チャレンジ | 32バイトの乱数（nonce）に用途、期限（5分）、利用者の ID を付け、`wrangler secret` で入れた鍵（`CHALLENGE_SECRET`）の HMAC で署名する。options の要求では D1 に書かない。検証に通った応答の nonce だけを期限まで D1 に残し、同じ challenge を2回は通さない。署名・期限・用途・認証器の応答の検証に通らない要求は D1 に書かない。検証に通る応答を再送すると、nonce の記録を試みる書き込みが走る（重複の INSERT は何も書かず、期限切れの nonce の掃除だけが行を消す） | 再使用・期限切れ・用途違い・署名の改ざんを拒否し、検証に通らない要求で D1 に書かないことを確かめるテスト |
| AU-4 | 署名カウンター | 0 のまま（同期パスキー）を許す。減ったらログに出すだけで拒否しない | 単体テスト |
| AU-5 | セッション | 32バイトの乱数。D1 には SHA-256 だけ保存する。最終利用から30日（更新は1日1回まで）、作成から最大180日。ログイン・回復のたびに作り直す。ログアウト・アカウント削除で即時に失効する | 期限・失効・固定化のテスト |
| AU-6 | Cookie | `__Host-session`、`Secure; HttpOnly; SameSite=Lax; Path=/`、Domain なし、`Max-Age` は AU-5 の期限に合わせる | 本番の `Set-Cookie` を smoke で確かめる。[C12] |
| AU-7 | CSRF | 状態を変えるのは POST・PUT・PATCH・DELETE だけ。ログイン前も含め `Origin` が本番と完全一致しなければ 403。本文は `application/json` だけ受け付ける。CORS は許可しない | Origin なし・別 Origin・フォーム送信を拒否するテスト |
| AU-8 | 回復コード | 10個。1個 80bit 以上の乱数を Crockford Base32 で表示（4文字ずつ区切る）。平文は発行時に1度だけ見せ、D1 には SHA-256 だけ保存する。消費は条件付き UPDATE で1回だけ成功させる。再発行で古いコードを全部無効にする | 使用済み・再発行前・同時使用を拒否するテスト。保存値に平文がないこと |
| AU-9 | 回復の権限 | 回復コードで入ると `recovery` セッション（15分）になり、パスキー登録しかできない。登録すると通常のセッションになり、ほかのセッションをすべて失効させ、回復コードの再発行を案内する。recovery セッションでもログアウトはできる。端末に残ったパスキーと衝突して登録できないときは、ログアウトして回復をやめ、そのパスキーでログインする（使った回復コードは戻らない） | recovery セッションで記録・フレンド・削除の API が 403 になるテスト |
| AU-10 | 回復の試行制限 | コードだけで引くので、アカウント単位では数えない。前段に IP 単位の制限（Rate Limiting binding、拠点ごとの近似）を置き、その後ろで D1 に全体の失敗数を10分単位で数える。異常に多ければ回復ログインをその10分だけ止め、次の窓で自動で再開する。80bit の乱数なので総当たりは成り立たず、制限は負荷対策。止めている間は正当な利用者も回復できないが、10分で戻るので許容する。数える書き込みは無料枠の書き込みを使う。Rate Limiting binding を Workers Free で使えるかは公式資料で確かめられなかった（2026-11-10。binding の資料にも料金の資料にもプランの記載がない）ので、binding はまだ設定していない。Worker は `RECOVERY_LIMITER`・`REGISTRATION_LIMITER` があれば使う。binding がない間は前段の IP 単位の制限がなく、全体の上限（回復の失敗、AZ-7 の新規登録）だけが残る。攻撃者が10分ごとに枠を使い切れば、正当な利用者の回復や新規登録を止め続けられる | 閾値を超えたら 429、次の窓で再開するテスト。[C8] |
| AU-11 | 重要な操作の再認証 | パスキーの削除、回復コードの再発行、アカウント削除は、セッションの `verified_at` が5分以内であることを求める。回復後に新しいパスキーを登録した直後は、その登録を直近の認証とみなす（漏れたかもしれない古いパスキーを消せるように）。最後の1本のパスキーは削除できない（先に別のパスキーを登録する） | テスト |
| AU-12 | 上限 | パスキーは1アカウント10本まで。recovery セッションでの登録だけは上限を超えてよい（10本あるアカウントも回復でき、通常のセッションに戻ってから削除で減らせる） | テスト |
| AU-13 | パスキー非対応環境 | `PublicKeyCredential` がない環境では「この端末ではログインできません。閲覧はそのまま使えます」と出し、別端末のパスキー（QR）を案内する。アプリ内ブラウザーも同じ扱い。回復コードの入力画面も、パスキーを登録できない端末では使う前に「この端末では回復を完了できません」と出す | 非対応ブラウザーでの表示を人が確かめる |
| AU-14 | 要求本文の上限 | 通常の JSON は 16KiB、WebAuthn の応答は 64KiB まで。超えたら 413。SQL はすべてパラメーター化する | 境界値と巨大な本文のテスト |

### 認可・フレンド

| ID | 要件 | 方針・推奨値 | 検証 |
| --- | --- | --- | --- |
| AZ-1 | フレンド以外には見せない | 他人の記録を返す API は1本にし、同じ SQL で「friendships に行があり、どちらからもブロックがない」を条件にする。満たさなければ、存在しない相手と同じ 404。メモの列は SELECT しない | 本人・フレンド・無関係・未ログイン・申請中・解除後・ブロックした側・された側・削除済み × 全 API の認可行列テスト。応答にメモがないこと |
| AZ-2 | 列挙させない | ユーザー ID は128bit の乱数。ユーザー検索・公開プロフィールの API を作らない | 認可行列テスト |
| AZ-3 | 招待トークン | 128bit 以上の乱数を base64url で、SHA-256 だけ保存する。期限7日、期限内は何度でも使え、作り直すと前のものは無効。URL は `/friends/invite?openExternalBrowser=1#t=…` とフラグメントに入れる。クエリは LINE で開いたときにアプリ内ブラウザーではなく標準ブラウザーで開かせ、パスキーを使えるようにするためのもの。JS が読んだら URL から消して POST の本文で送る。GET では申請しない。未ログインで開いたら、ログイン・登録の間だけ sessionStorage に持つ。招待ページの起動時と、bfcache からの復帰を含む pageshow・フォーカス復帰・再表示時に保存値を読み出してすぐ消し、以降はそのページのメモリだけに持つ。再ログインへ進むときだけ保存し直し、ログアウト時にも保存値を消す。復帰時に Cookie を読み直し、別タブでのログインを表示へ反映する。前回の確認時はログイン中で、今回は未ログインなら、メモリと保存値のトークンを捨てて招待リンクの再表示を求める | 期限・作り直し・自分への申請・重複申請・未ログインから登録して申請する流れのテスト。ログにトークンが出ないこと |
| AZ-4 | 招待ページで見せるもの | 招待した人の表示名だけ。トークンを POST で送る照会 API で返す | 応答をテストで固定する |
| AZ-5 | ブロックの非通知 | 申請した側には、送った申請の一覧も状態も見せない。承認されたら初めてフレンド一覧に現れる。こうすると、相手の無視・ブロック・申請の削除を区別できない。ブロックでフレンド関係と保留中の申請を消す。ブロックした人への申請は、送った側に通常と同じ「申請しました」を返し、保存しない。ブロックされた側の見え方は通常の解除と同じ。表示の差からの推測まで完全に防げるとは約束しない | ブロックと解除で、された側の応答が同じことを確かめるテスト |
| AZ-6 | 公開の範囲 | 承認すると、過去の分も含めてカード・日付・枚数が見える。承認の画面でそう伝える | 文面を人が確かめる |
| AZ-7 | 乱用の上限 | フレンド200人、受信中の申請100件、申請は1人1日20回、書き込みは1人1分60回。新規登録は全体で10分単位の窓ごとに10件まで（ソフトウェアの認証器なら登録を安く作れるため）。数えるのは最新の窓だけで、窓は後ろに戻らない。古い窓に始まって遅れて届いた登録は、最新の窓に数える。上限の判定、枠の消費、アカウントの作成は1回の batch で行い、アカウントを削除しても枠は戻らない | 上限のテスト |
| AZ-8 | 表示名 | NFC で正規化し、前後の空白を取る。1〜20書記素。制御文字、双方向制御文字、改行を拒否する（絵文字の ZWJ は許す）。重複してよい。描画は React のエスケープに任せる | 境界値と禁止文字のテスト |
| AZ-9 | メモ | 500文字まで。本人の API だけが返す | 長さのテスト |
| SE-1 | ヘッダー | `/api/*` に `X-Content-Type-Options: nosniff`、`Referrer-Policy: same-origin`。招待・設定のページは `Referrer-Policy: no-referrer`、frame を禁止する。サイト全体の CSP は `web/deploy/_headers` で強制する。inline の script と style 属性はなく、地図の通信先は CARTO の `basemaps.cartocdn.com`（スタイル）と `tiles.basemaps.cartocdn.com`（スプライト・フォント・タイル）だけなので、`connect-src` にこの2つを許す。MapLibre の worker と画像のために、`worker-src` と `img-src` に `blob:` を許す。Cloudflare が差し込む Web Analytics の計測のために、`script-src` に `static.cloudflareinsights.com`、`connect-src` に `cloudflareinsights.com` を許す | smoke でヘッダーを確かめる。`account.browser-check.mjs` で、各ページの CSP 違反が0件で地図の取得が成功することを確かめる |
| SE-2 | 秘密 | 秘密は `wrangler secret` で入れ、リポジトリと `VITE_` 変数に置かない。セッションは D1 で引くので署名鍵は要らない。Cloudflare と GitHub の管理者アカウントは強い認証にする | レビュー |

### データ・カード番号

| ID | 要件 | 方針・推奨値 | 根拠・検証 |
| --- | --- | --- | --- |
| DA-1 | 記録のキー | 公式カード番号（`cards[].id`、例 `13-100-A001`）を文字列で持つ。D1 に外部キーは張らない | `cmd/builddata` は照合済みの `Check.Code` を `Card.ID` にし、重複でビルドを止める。番号は `internal/gkp` が表の記号か画像ファイル名から組むので、後から訂正されうる |
| DA-2 | 番号の訂正 | 生成データに `cardAliases`（旧番号→新番号）を持ち、フロントと API は旧番号の記録を新番号として扱う。必要ならマイグレーションで D1 をまとめて書き換える。番号の再利用は禁止 | `web/public/data/` は Git で追跡していないので、公開した番号の一覧・aliases・除外一覧を追跡する小さなファイル（`data/card-ids.json`）としてリポジトリに置く。CI で生成結果と比べ、一覧から消えた番号が aliases にも除外一覧にもなければ失敗させる。施設の legacy alias（`cmd/builddata/national.go`）と同じ考え方 |
| DA-3 | 台帳から外れたカード | 記録は消さない。「現在の台帳にないカード」として本人の一覧に出し、枚数に含める。新規の記録はできず、既存の記録は修正・取り消しできる。地図には出さない | テスト |
| DA-4 | カードの統合 | 2つの番号が1つになり、同じ人の記録が2件になるときは、自動でメモや日付を捨てず、その移行を止めて個別に判断する | マイグレーションのテスト |
| DA-5 | 配布状態と記録 | 配布終了・一時中止のカードも記録でき、回収済みの印を出す | テスト |
| DA-6 | 日付 | 日本時間の暦日（YYYY-MM-DD）で、未設定を許す。未来の日付は拒否する。既存 JSON の `acquired`（生成の取得日）とは別物 | テスト |
| DA-7 | 枚数と地図 | 枚数は記録したカードの数。1つの施設に複数のカードがあるとき、ピンはカード単位で判定する（一部だけ回収済みを表せる）。位置未確定のカードも一覧と枚数に含める | 複数窓口・座標なしのデータで確かめる |
| DA-8 | 二重送信 | 受け取り登録は冪等な PUT、取り消しは冪等な DELETE。同じ人の複数端末の編集は後勝ち | 二重クリック・応答だけ失われた場合のテスト |

### プライバシー・削除

| ID | 要件 | 方針・推奨値 | 検証 |
| --- | --- | --- | --- |
| PR-1 | 保持データの最小化 | 保存するのは表示名、パスキーの公開鍵など、回復コードとセッションのハッシュ、記録、フレンド・申請・ブロック・招待、上限を数えるための書き込みの時刻と件数だけ。メール・電話・IP・User-Agent・位置は D1 に保存しない | スキーマのレビュー |
| PR-2 | ログ | 出してよいのはルートの雛形、状態コード、所要時間、エラーの種類、内部ユーザー ID、コードに書いた固定のイベント名（`sign_count_not_increased` など）だけ。本文、Cookie、トークン、回復コード、メモ、表示名、完全な URL は出さない。自動の呼び出しログは無効にして明示的に出す | テスト用の秘密で本番ログを検索する。[C6] |
| PR-3 | IP | レート制限の処理中だけ使う。D1 に保存しない | レビュー |
| PR-4 | アカウント削除 | パスキーで再認証し、D1 の1回の batch で全表のその人の行（ブロックはする側・される側の両方）を消し、Cookie も消す | 削除後、その ID を含む行が全表で0件になるテスト |
| PR-5 | バックアップに残る期間 | D1 の Time Travel（無料7日、有料30日）だけを使い、ほかにバックアップを作らない。削除したデータはこの期間だけ復元できる状態で残る | 規約に書く。[C4] |
| PR-6 | 復元で取り消した操作を戻さない | Time Travel の復元は DB 全体を戻すので、削除したアカウントだけでなく、削除したパスキー、使用済みの回復コード、解除・ブロックしたフレンド関係も戻る。そこで、アカウント削除・パスキー削除・フレンド解除・ブロックのたびに、ID と時刻だけを別の小さな D1（tombstones）に35日残す。記録は操作の前に乱数の change_id を付けて `pending` で書く。操作の本体の batch の中で、同じ change_id を本番の DB の applied_changes に書く（操作が適用された印）。操作のあとで記録を `done` にし、印を消す。再適用するのは `done` だけ。`pending` のまま残った記録は、復元の前に `web/scripts/reconcile-tombstones.mjs` で印と照合する。印があれば `done` にして印を消し、なければ操作は起きていないので記録を消す。今の行の有無からは判定しない（ブロックのあとの解除や、フレンド解除のあとの再承認で行が変わるため）。change_id のない記録は判定できないので、消さずに止める。復元したら、tombstones を再適用し、全セッション・招待・回復コードを失効させてから API を再開する（利用者は回復コードを再発行する） | 削除→復元、パスキー削除→復元、ブロック→復元で元に戻らないことを、年1回ローカルにコピーした DB で試す |
| PR-7 | 規約・プライバシーポリシー | 保存するデータ、使い道、フレンドに見えるもの・見えないもの、保存先（Cloudflare。海外のデータセンターを含む）、ログの保持期間、削除とバックアップの残存期間、障害で復元すると回復コードの再発行が要ること、両方を失うと復旧できないこと、回復コードの保管、ブロックは通知されないこと、地図の配信元への送信、問い合わせ先を、登録の前に示す | 文面を人が確かめる |
| PR-8 | 法務 | 個人情報保護法の適用と、電気通信事業法の届出・外部送信規律の要否を断定しない。非商用やメールなしを適用外の根拠にしない。専門家や窓口への確認はしない（利用者の決定） | 規約の文面を人が確かめる。[C13][C14] |

### 運用

| ID | 要件 | 方針・推奨値 | 検証 |
| --- | --- | --- | --- |
| OP-1 | 復元 | Time Travel で戻す。復元は上書きなので、前のブックマークを控えてから行う。手順は API 停止 → tombstones の照合で pending を0件にする → 復元 → PR-6 の再適用と失効 → 確認 → 再開 | 年1回の試行 |
| OP-2 | マイグレーション | `wrangler d1 migrations` で管理する。追加だけの変更を原則にし、列の削除はコードが使わなくなってから。Deploy では `migrations apply --remote` を Worker の配信より前に流す。そのため Cloudflare の API トークンに D1 の編集権限を足す。Worker をロールバックしても DB は戻らないので、古い Worker が新しいスキーマで動く変更だけにする | CI で空の DB に全マイグレーションを当ててテストを通す |
| OP-3 | 監視 | Workers Logs と、Deploy 後の smoke に足す `/api/health`（D1 に `SELECT 1`）。プレビューでは API を無効にするので、プレビューの smoke ではこの検査を飛ばす。利用量と 5xx はダッシュボードを週1回見る | smoke の結果 |
| OP-4 | 緊急停止 | `wrangler secret put API_DISABLED` で `/api/*` が 503 を返す。地図は影響を受けない。secret は配信で上書きされないので、CI を待たずに効き、次の配信でも残る（`vars` はダッシュボードで変えても次の `wrangler deploy` で上書きされる）。乱用が見えたら新規登録と招待だけ止める secret も用意する | ローカルで切り替えて確かめる。[C16] |
| OP-5 | 非公開に戻す手順 | 今の手順（Access を全トラフィックへ、または Custom Domain を外す）は API とプレビューにも効く見込み（Custom Domain への Access の効き方は公式資料で確かめていない）。データは消えない。停止中も退会の要望には応じる方針にする | `docs/deployment.md` を実装時に更新する |
| OP-6 | CD | `tools/ci/publish_inputs.py` は私的なパスを除外する方式なので、`web/` 配下に置く Worker のソースとマイグレーションは、何もしなくても公開入力になる。私的なディレクトリに置かない。GitHub の vars を足すなら `CONFIG_KEYS` にも足す | CI |

### テスト・開発環境

| ID | 要件 | 方針・推奨値 | 理由 |
| --- | --- | --- | --- |
| TE-1 | PRプレビュー | プレビューでは API を無効にする。`preview.yml` は D1 の binding を含まない別の設定（例 `wrangler.preview.jsonc`）で版を上げ、Worker は binding がなければ `/api/*` に 404 を返す。フロントはログインの入口を隠す。Host の判定は PR で変えられるコードなので、隔離の根拠にしない | 版の binding はその版の設定で決まり、今のままだと PR のコードが本番の D1 に書ける。[C5] 本番の RP ID `manhole-techo.com` はプレビューのホストの接尾辞ではないので、プレビューではもともとログインできない。CI でプレビューの設定に D1 の binding がないことを機械的に確かめる（Wrangler で別設定の版を上げられるかは実装時に確かめる） |
| TE-2 | ローカル | `wrangler dev` のローカル D1 と架空データ。RP ID `localhost`。RP ID とオリジンは環境変数で切り替え、本番の値は配信時に固定する | `wrangler dev` は既定で本番に触れない。[C9] |
| TE-3 | 自動テスト | 失敗するテストから始める。認可行列、WebAuthn の検証（記録済みの応答を使う）、回復コード・招待・セッションの期限と失効、削除の完全性、CSRF をリリースの必須条件にする | 既存の Vitest に乗せる |
| TE-4 | ブラウザー | Playwright の仮想認証器で登録→ログイン→記録の流れを `test:browser` に足す。CI では回さない（今の方針どおり）。仮想認証器だけで完了とせず実機でも確かめる | |

### アクセシビリティ

| ID | 要件 | 方針・推奨値 |
| --- | --- | --- |
| AC-1 | 回収済みの区別 | ピンの色は配布状態のまま。回収済みはチェックの印など色以外の手がかりで示し、一覧・詳細では文字でも出す |
| AC-2 | 絞り込みとフォーム | 絞り込みはラジオボタンのグループ。日付は `<input type="date">`。エラーは入力欄に関連づける。回復コードはコピーとファイル保存ができる |

## 規模と費用

利用者数の実績はないので、登録1,000人、1日100〜300人が記録を開くと仮定した。

| 項目 | 概算 | 無料枠 |
| --- | --- | --- |
| Worker 要求 | 5,000〜6,000件/日 | 10万件/日。[C3] |
| D1 読み取り | 約20万行/日（走査行で数えるので索引で増減する） | 500万行/日。[C4] |
| D1 書き込み | 1,000〜2万行/日 | 10万行/日 |
| D1 容量 | 60〜200MB | 1 DB 500MB |
| Workers Logs | 6,000件/日 | 20万件/日、保持3日。[C6] |

無料枠に収まる見込み。超えても止まるのは API だけで、地図は動く。無料枠は日本時間9時にリセットされる。

## 決めたこと

2026-11-10 に利用者が決めた。

| 事項 | 決定 |
| --- | --- |
| 有料プラン | Workers Free で始め、利用量が無料枠の50%を超えたら切り替える。WebAuthn の検証が CPU 10ms に収まらなければ最初から Workers Paid にする |
| セッションの長さ | 最終利用から30日・最大180日 |
| 認証の試験環境 | 作らない。プレビューで API を無効にし、ローカルで確かめる。本番でしか起きない問題が続いたら別の Worker と D1 を考える |
| 達成率 | 出さない。出すときは現在の台帳を分母にして基準日を添える |
| CSP | 認証と同時に入れる |
| 法務の確認 | 専門家や窓口への確認はしない。規約は PR-7 のとおり書き、法令の適用は断定しない |
| ブロックの解除 | ブロック一覧から解除できる。解除してもフレンドには戻らず、申請からやり直す |
| 送った申請 | 送った側には申請の一覧・状態を見せない（AZ-5） |

## 2案から採らなかったもの

この設計は Claude Opus と Codex Astra（GPT-6）の独立した2案を統合した。採らなかった主な案と理由。

| 案 | 採らなかった理由 |
| --- | --- |
| R2 への暗号化した日次バックアップ（7世代）と、削除・失効の記録を外部に残す仕組み | 1人運用には重い。Time Travel と小さな tombstones（PR-6）で、削除を戻さない目的は果たせる |
| D1 にカードの表と不変の内部キーを同期する | 台帳の二重管理になる。公式番号と aliases で足りる |
| 最初から Workers Paid | 概算では無料枠の数%。判断事項にした |
| Access 付きの固定ステージング | 環境が増える。判断事項にした |
| 回復コードごとの検索用 ID と、コード単位の失敗回数 | 80bit 以上の乱数なら総当たりは成り立たない。全体の上限で足りる |
| 版番号による編集の競合検出（409） | 記録を編集するのは本人だけで、後勝ちで困らない |
| 5分ごとの外部監視、フレンド画面の60秒ごとの再認可 | 1人運用・非商用には過剰 |

## 不要と判断した観点

- 数値の SLA、多リージョン冗長、SOC2 などの認証：1人運用・非商用で、閲覧は静的配信が担う。
- メール・SMS・パスワード・ソーシャルログイン：機能要件で除外した。
- JWT などのステートレスなセッション：ログアウト・削除の即時失効が要る。
- 回復コードの低速ハッシュ：80bit 以上の乱数なら SHA-256 で足り、CPU 10ms にも合わない。
- Service Worker・オフラインでの記録：過去に削除した。同期の競合と端末への残存が増える。
- メモの端末間暗号化：鍵の回復が重い。運用者も読めない、とは書かない。
- 常設の CAPTCHA、解析 SDK：画面が重くなり、外部送信先が増える。乱用が見えたら考える。
- 監査ログの長期保存：保存するデータが増えるだけで使い道がない。
- D1 のデータ所在の制限：日本の選択肢がなく、要件もない。
- 負荷試験：概算が無料枠の数%。実測（PF-3）で足りる。

## 未確認

Rate Limiting binding を無料プランで使えるか（AU-10）、署名検証の本番の CPU 時間、プレビューの版を D1 なしの設定で上げたときの実際の配信、Custom Domain への Access の効き方、Cloudflare 側の既定のログ保持、実機でのパスキーの対応状況、法令の適用。

WebAuthn の検証には `@simplewebauthn/server` 14.0.3 を使う。固定している wrangler の版のローカルの workerd で、ES256・Ed25519・RS256 の登録・ログイン・再認証が通ることを確かめた（`web/worker/auth-workerd.test.ts`）。同じ workerd で認証の署名検証を200回続けた時間は、ES256 が計36ms、Ed25519 が計23ms、RS256 が計22ms だった。1ms 単位のタイマーで測った経過時間で、本番の CPU 時間ではない。Rate Limiting binding は `RECOVERY_LIMITER`・`REGISTRATION_LIMITER` という名前で受け取る作りにしたが、`wrangler.jsonc` にはまだ足していない。

## 出典

- [C1] Static Assets のルーティング（`run_worker_first`）: https://developers.cloudflare.com/workers/static-assets/routing/worker-script/
- [C2] Static Assets の課金と制限: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- [C3] Workers の料金と制限（無料 10万要求/日、CPU 10ms、Paid 月5米ドルから）: https://developers.cloudflare.com/workers/platform/pricing/ 、https://developers.cloudflare.com/workers/platform/limits/
- [C4] D1 の制限と料金（無料 500MB/DB、読み取り500万行/日、書き込み10万行/日、Time Travel 無料7日・有料30日）: https://developers.cloudflare.com/d1/platform/limits/ 、https://developers.cloudflare.com/d1/platform/pricing/ 、https://developers.cloudflare.com/d1/reference/time-travel/
- [C5] プレビュー URL の制限（版の binding を使う、Durable Objects があると作られない）: https://developers.cloudflare.com/workers/configuration/previews/
- [C6] Workers Logs: https://developers.cloudflare.com/workers/observability/logs/workers-logs/
- [C7] KV の仕組みと制限: https://developers.cloudflare.com/kv/concepts/how-kv-works/ 、https://developers.cloudflare.com/kv/platform/limits/
- [C8] Rate Limiting binding: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- [C9] D1 のデータの場所とローカル開発: https://developers.cloudflare.com/d1/configuration/data-location/ 、https://developers.cloudflare.com/d1/best-practices/local-development/
- [C10] Web Authentication Level 3: https://www.w3.org/TR/webauthn-3/
- [C11] PublicKeyCredentialCreationOptions（MDN）と passkeys.dev の対応表: https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredentialCreationOptions 、https://passkeys.dev/device-support/
- [C12] Set-Cookie（MDN）: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie
- [C13] 個人情報保護委員会 法令・ガイドライン: https://www.ppc.go.jp/personalinfo/legal/
- [C14] 総務省 外部送信規律: https://www.soumu.go.jp/main_sosiki/joho_tsusin/d_syohi/gaibusoushin_kiritsu.html
- [C15] D1 の外部キーと batch: https://developers.cloudflare.com/d1/sql-api/foreign-keys/ 、https://developers.cloudflare.com/d1/worker-api/d1-database/
- [C16] Wrangler の設定（vars は配信で上書き、secret は残る）: https://developers.cloudflare.com/workers/wrangler/configuration/
