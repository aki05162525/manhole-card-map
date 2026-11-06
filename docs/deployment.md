# 静的配信

Cloudflare Workers Static Assets に web/dist を配信する。Worker スクリプト、アプリの認証、DBは追加しない。workers.dev を使い、preview_urls は無効。HTML処理・404は既定のままでSPAフォールバックは使わない。

## 有効化

1. 最初は GitHub variable CLOUDFLARE_DEPLOY_ENABLED を設定しない。
2. Cloudflare ダッシュボードで同名 Worker と workers.dev のホスト名を準備する。必要なら非公開情報を含まない初期コンテンツで準備する。
3. Workers & Pages → 対象 Worker → Settings → Domains & Routes → workers.dev のメニューで Access を有効化する。Access のポリシーを利用者に限定し、未認証アクセスが遮断されることを確認する。
4. GitHub secrets に CLOUDFLARE_API_TOKEN（対象アカウントの Workers 編集権限）、CLOUDFLARE_ACCOUNT_ID を登録する。
5. variables に PUBLIC_ORIGIN（https://対象.workers.dev）、必要に応じ VITE_MAP_STYLE_URL を登録する。VITE_ 値は公開されるため秘密を入れない。
6. Access の保護を確認してから CLOUDFLARE_DEPLOY_ENABLED を true にする。main の手動 Deploy または main push の CI 成功で配信する。

PUBLIC_RELEASE を設定していない間、Deploy は配信の前に node scripts/smoke-deploy.mjs --access-only を実行する。未認証のアクセスが Access のログインへの転送か 401/403 で遮断されなければ、配信せず失敗する。配信後の確認でも同じ検査を行う。空の Worker が 404 を返す状態も未保護として扱うので、手順2と3を省略できない。

公式の [workers.dev と Access](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/) を参照。Access 自体はコードで作らない。noindex はアクセス制御の代用にならない。

## ビルドと確認

台帳と根拠を更新し、基準日を確認して python3 -B tools/build-real-data.py を実行する。web/ で bun install --frozen-lockfile、bun run build、node scripts/check-deploy.mjs の順に検査する。fixture は配信できない。

CDは独立した Deploy ワークフローで直列実行し、CIの成功したpushのhead_shaを配信する。固定したdevDependencyのWranglerを使う。配信後は PUBLIC_ORIGIN に対し node scripts/smoke-deploy.mjs で検査する。Access使用中にサービストークンがなければ、未認証のアクセスが遮断されることだけを確認し、画面と配信内容は人が確認する。secrets の CF_ACCESS_CLIENT_ID と CF_ACCESS_CLIENT_SECRET を登録すると、Access の内側の配信内容も自動で確認する。トークンを通すには Action が Service Auth のポリシーが必要。

_headers と .assetsignore は実データdistだけに配置する。[公式の除外書式](https://developers.cloudflare.com/workers/static-assets/binding/) はgitignore形式。圧縮済み副本とdata/quality.jsonは配信しない。ハッシュ付きassetsだけ長期キャッシュし、他は既定の再検証を維持する。

## ロールバック

自動配信を止めるには CLOUDFLARE_DEPLOY_ENABLED を削除する。権限を持つ運用者が web/ で bun run wrangler rollback を実行し、配信確認を行う。過去版へ戻るためmanifestはその版の生成物と比較する。次のCDは現在のmainを再配信する。

## 一般公開前

GKP一覧原本の利用・再配布条件とジオコーディング結果の利用・表示条件を確認する。背景地図の利用条件と必要なキー、出典表示も確認する。quality.jsonは内部出力のみとし公開しない。独自ドメインを取得して経路とAccessの保護範囲を確認し、一般公開の承認後に_headersのnoindexを解除し、variable PUBLIC_RELEASE を true にして Access の検査を止める。
