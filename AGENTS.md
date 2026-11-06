# manhole-card-map の開発指針

## 利用者とプロダクト

マンホールカードを配布施設で受け取り、その後に蓋を訪れて撮影する利用者向けの地図。主に表示するのは配布施設ピン。蓋は別の目的地として扱い、詳細から Google Maps へ渡す。軽快な操作と訪問先情報の正確さを重視する。

## 作業上の合意

- 日本語で報告する。実施した検証と未確認の範囲を区別する。
- ドキュメントと既存コードが食い違うときはコードの書き方に従い、見つけた食い違いを最後の返答ですべて挙げる。過去の計測・調査記録を現在の結果として扱わない。
- 新機能・不具合修正は対象の振る舞いが失敗するテストから始め、修正後の成功を確認する。文書だけの変更にアプリ全体のテストは不要。
- レビューは [REVIEW.md](REVIEW.md) に従い、成功済み検証を再利用して差分と影響範囲に絞る。
- サブエージェントを使う場合は担当ファイル・成果物・検証範囲を分ける。親が統合と最終検証を担当し、調査候補を自動承認しない。
- explainer、explainer-book、first-reader、d2-diagram、d2-slides、eli5 は、利用者がスキル名を指定した場合、または指定されたスキルの手順で必要な場合だけ使う。
- 現在の公開範囲はローカル確認とCI検査まで。外部デプロイ・認証・DBの導入は、それを含む依頼で扱う。

## 構成と参照先

必要な作業に対応する資料だけ読む。

| 作業 | 実装・参照先 |
| --- | --- |
| 地図・詳細UI | `web/src/`、[web/README.md](web/README.md)、[mapcn設計](docs/mapcn-design.md) |
| 配布情報モデル | `cmd/builddata/`、`internal/`、[配布場所設計](docs/distribution-design.md) |
| 台帳・位置の統合 | `tools/national/assemble.py`、`tools/national/manifest.json`、[統合手順](docs/national-assembly.md) |
| 残件の集計 | `tools/national/issue7_audit.py`、[監査の件数定義](docs/issue7-audit.md) |
| キャッシュ・オフライン | `web/scripts/sw-generator.mjs`、`web/src/offline-update.ts`、[更新設計](docs/offline-update.md) |
| mapcnスキルの復元・更新 | [APM手順](docs/development-agents.md)、`apm.yml`、`apm.lock.yaml` |

標準画面は React + TypeScript + Vite + mapcn / MapLibre。生成されたmapcnスキルを直接修正せず、APMの固定入力から復元する。

## 開発と検証

ツールの版は `mise.toml`、依存・実行コマンドは `web/package.json` と `web/bun.lock` を基準にする。miseをシェルで有効化していなければ各コマンドに `mise exec --` を付ける。

```sh
# リポジトリルート：初回セットアップ
mise install
cd web
bun install --frozen-lockfile
bun run hooks:install

# web/：フロントエンド変更の検証
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run build:fixture
```

- 整形は `web/` で `bun run format`。ESLint設定を追加せず、既存のOxlint / Oxfmtを使う。
- Go変更はルートで `go test ./...`。全国統合・Python変更は `go test -count=1 ./...`（全国Python unittestも内部で実行）。通常フックの成功を再利用し、同じ全suiteを重複実行しない。
- 画面操作は人間が確認する。必要に応じ、`web/` で `bunx --no-install playwright install chromium` 後に `bun run test:browser` を手動実行できる。SW・保存更新の手動検査は `node scripts/offline-browser-check.mjs`。固定旧workerの取得方法は `docs/offline-update.md` を参照。CIではブラウザー検査を実行しない。
- 実データ操作は既存サーバーを確認してから `web/` で `REAL_DATA_ORIGIN=http://127.0.0.1:4180 node scripts/real-data-browser-check.mjs`。このスクリプトはサーバーを起動しない。URLは実際の稼働先に合わせる。
- CIの実行内容は `.github/workflows/ci.yml`、スキル復元の検証は `.github/workflows/agents.yml` を参照する。フックをスキップして成功扱いにしない。

## データを変更するとき

- カードの収録、配布関係の確認、配布状態、施設位置の採用は別の判断。座標があっても受取可能・在庫ありとは限らない。
- 現配布先を含む建物代表点を採用できる。入口・室内窓口の測量は要求しない。旧施設・別棟・蓋・単なる地図中心を配布施設点として代用しない。
- 現行の生成・採用根拠・法的表示に必要な原本と調査を保持し、訂正・採否を追跡可能にする。完了済みの作業ログ・世代スナップショットはGit履歴に任せ、参照閉包を確認して削除する。レビュー済みの採用対象をmanifestへ明示し、証拠・ID・参照・旧値の検査を通す。テストの期待値やhashだけを合わせて整合性エラーを消さない。
- 配布先の建物を特定でき、根拠に基づく位置の不確かさを考慮しても、その建物への案内として支障がなければ採用する。座標系の名称だけが未確定であることを、一律の保留理由にしない。 不確かさの根拠と対象建物への影響を記録し、独立レビューで判断する。
- 出典URL、取得記録、原本hash、確認日、座標系・精度・加工方法を残す。原本全文の再配布と座標情報の利用条件は別に確認する。調査原本をブラウザー向け配信資産へ混ぜない。
- `web/public/data/`、`web/dist/`、`web/dist-fixture/` は生成物。生成JSONだけを手修正せず、台帳・生成処理を直して再生成する。手順は `web/README.md` にある。
- 静的JSONの配布状態は時間経過だけでは更新されない。再生成時は一覧原本と `-as-of` の基準日を明示し、根拠が古い状態を新たな確認済み情報として扱わない。
- 実データ不足時にfixtureへ自動で置き換えない。データ収録数・採用数・表示数は対象集合と基準日を添え、現在値を監査から取得する。

## UI・更新・性能で守ること

- 位置未確定でも検索・詳細から施設を確認できる状態を保つ。地図の初期化失敗で一覧を使えなくしない。
- 実JSONには説明・営業時間・リンクが `null` のカードがある。TypeScriptの配列型だけを信用せず、終了・未確認・複数窓口のデータも描画検証する。
- 保存更新は同一originで旧版→新版を検証する。別ポートや保存領域の全消去だけで解決扱いにしない。画面・assets・full/splitの世代整合、失敗時の旧版維持、複数タブ、オフライン再起動を確認する。
- サーバーを起動する前に稼働プロセス・ポートを確認し、利用者へ実際のURLを伝える。自分の試験サーバーは終了する。利用者のサーバーは明示された停止範囲で扱う。
- 性能は実地図での起動・詳細応答・移動を分けて計測する。fixtureの無地背景やPCでの結果を実地図・スマホ性能の保証にしない。大チャンク警告を閾値変更だけで解消扱いにしない。

## このファイルの保守

恒常的な判断基準とコマンドを置き、進捗・調査履歴・テスト結果はIssue・PR・CIへ残す。恒久的な検証結果Markdownやarchiveは新設せず、設計と現行手順だけを保守する。実装・ワークフローの変更で無効になった指示は更新する。

参考：[公式AGENTS.mdガイド](https://learn.chatgpt.com/docs/agent-configuration/agents-md)、[指示を簡潔に保つ公式ガイド](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)。
