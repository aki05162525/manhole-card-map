# 静的配信

Cloudflare Workers Static Assets に web/dist を配信する。Worker スクリプト、アプリの認証、DBは追加しない。公開先は独自ドメイン https://manhole-techo.com だけで、workers.dev は無効。PRの確認用に preview_urls を有効にしている。ドメインは Worker の Custom Domain としてダッシュボードで接続している。HTML処理・404は既定のままでSPAフォールバックは使わない。

## 有効化

1. 最初は GitHub variable CLOUDFLARE_DEPLOY_ENABLED を設定しない。
2. Cloudflare ダッシュボードで同名 Worker と workers.dev のホスト名を準備する。必要なら非公開情報を含まない初期コンテンツで準備する。
3. Workers & Pages → 対象 Worker → Settings → Domains & Routes → workers.dev のメニューで Access を有効化する。Access のポリシーを利用者に限定し、未認証アクセスが遮断されることを確認する。
4. GitHub secrets に CLOUDFLARE_API_TOKEN（対象アカウントの Workers 編集権限）、CLOUDFLARE_ACCOUNT_ID を登録する。
5. variables に PUBLIC_ORIGIN（https://manhole-techo.com）、必要に応じ VITE_MAP_STYLE_URL を登録する。VITE_ 値は公開されるため秘密を入れない。
6. Access の保護を確認してから CLOUDFLARE_DEPLOY_ENABLED を true にする。main の手動 Deploy または main push の CI 成功で配信する。

PUBLIC_RELEASE を設定していない間、Deploy は配信の前に node scripts/smoke-deploy.mjs --access-only を実行する。未認証のアクセスが Access のログインへの転送か 401/403 で遮断されなければ、配信せず失敗する。配信後の確認でも同じ検査を行う。空の Worker が 404 を返す状態も未保護として扱うので、手順2と3を省略できない。

公式の [workers.dev と Access](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/) を参照。Access 自体はコードで作らない。noindex はアクセス制御の代用にならない。

## ビルドと確認

台帳と根拠を更新し、基準日を確認して python3 -B tools/build-real-data.py を実行する。web/ で bun install --frozen-lockfile、bun run build、node scripts/check-deploy.mjs の順に検査する。fixture は配信できない。

配信処理は [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) を参照。配信後は PUBLIC_ORIGIN に対し node scripts/smoke-deploy.mjs で検査する。Access使用中にサービストークンがなければ、未認証のアクセスが遮断されることだけを確認し、画面と配信内容は人が確認する。secrets の CF_ACCESS_CLIENT_ID と CF_ACCESS_CLIENT_SECRET を登録すると、Access の内側の配信内容も自動で確認する。トークンを通すには Action が Service Auth のポリシーが必要。

_headers と .assetsignore は実データdistだけに配置する。[公式の除外書式](https://developers.cloudflare.com/workers/static-assets/binding/) はgitignore形式。圧縮済み副本とdata/quality.jsonは配信しない。ハッシュ付きassetsだけ長期キャッシュし、他は既定の再検証を維持する。

## 公開入力が変わらない場合

Deploy の先行ジョブは、本番で配信中の Worker バージョンのメッセージ `sha=<40桁>;cfg=<16桁>` と比較する。公開時に `wrangler deploy --message` でこの印を残す。cfg は VITE_MAP_STYLE_URL・PUBLIC_RELEASE・PUBLIC_ORIGIN の値から計算した SHA-256 の先頭16桁で、値そのものは記録しない。

`wrangler deployments status --json` で100%配信中の版を特定し、`wrangler versions view <version-id> --json` の `annotations["workers/message"]` を読む。最新のアップロード版や前回のActions成功ではなく、ロールバック先も含む実際の本番の版を基準にする。JSON読み取りの前提は `tools/ci/publish_inputs.py` の1関数に集約する。

cfg が一致し、差分が docs/、ルート直下のMarkdown、web/README.md、tools/ci/、tools/dev/、lefthook.yml、.agents/、.apm/、apm.yml、apm.lock.yaml、CI・agentsワークフローだけなら、生成・ビルド・公開を省略する。Deploy・Previewワークフロー、data/配下の証拠、未知のパスは公開対象。印の読み取り・形式・履歴・差分が不明、複数版への分割配信、cfgの変更は公開する。PUBLIC_RELEASE が true でなければ、省略時も軽量ジョブで従来の `--access-only` 検査を行う。

Secretsや設定の変更後などに強制的に再公開するには、main の Deploy を `workflow_dispatch` で手動実行する。手動実行は差分判定を省略するが、公開前後の検査は維持する。

## ロールバック

自動配信を止めるには CLOUDFLARE_DEPLOY_ENABLED を削除する。権限を持つ運用者が web/ で bun run wrangler rollback を実行し、配信確認を行う。過去版へ戻るためmanifestはその版の生成物と比較する。次のCDは本番で配信中の版のSHAと比較するため、戻した版と公開入力が異なれば現在のmainを再配信する。

## PRプレビュー

PRを作成・更新すると Preview ワークフローが起動し、PRのbase SHAとの差分を先行ジョブで判定する。公開入力が変われば `wrangler versions upload --preview-alias pr-<番号>` で、本番を変えずに実データのビルドを配信して、URLをPRへコメントする。公開入力に変更がなければビルド・配信・URLコメントを省略する。data/配下のMarkdown証拠は公開入力として扱う。

プレビューは認証なしで開けるが `noindex` を付ける。CARTOのキーは本番のホストだけを許可するので、プレビューの背景地図はキーなしの既定URLを使う。誰にも見せたくない場合は、Worker の Access で Previews only を有効にする。ただし配信確認が未認証で失敗するので、サービストークンを secrets に登録して Preview ワークフローへ渡す変更も必要になる。

## 公開状態

variable PUBLIC_RELEASE が true の間は一般公開で、Deploy は Access の検査を省略して配信内容を確認する。true でない間は未認証のアクセスが遮断されていなければ配信しない。

GKP一覧原本、配布情報、位置情報の利用条件は、権利者から指摘があった場合に見直す。連絡先は contact@manhole-techo.com。quality.json は内部出力のみとし公開しない。

## 非公開へ戻す

権利者などの指摘ですぐ公開を止める手順。

1. Workers & Pages → manhole-card-map → Access で、すべての Traffic を対象に Access を有効化する。急ぐ場合は Domains で Custom Domain を外してもよい。Custom Domain だけを外す場合は、Domains で Preview の Worker URL も無効にする。プレビューにも同じデータが載っている。
2. シークレットウィンドウと curl で https://manhole-techo.com/ が遮断されることを確認する。
3. variable PUBLIC_RELEASE を削除する。以後の Deploy は Access の遮断を確認してから配信する。
4. 内容の修正・削除は台帳と生成処理を直して再生成する。生成JSONを手で修正しない。解決後に Access を外し、PUBLIC_RELEASE を true に戻す。
