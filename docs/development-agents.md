# AI 開発用のスキル管理

AI が読む開発用スキルを、Microsoft の **Agent Package Manager (APM)** で管理する。

| スキル | 用途 | 入手元 |
| --- | --- | --- |
| mapcn | 地図 UI の部品と使い方 | mapcn 公式（コミット固定） |
| react-best-practices | React の性能と書き方の規則（Vercel、70規則）。`server-` など Next.js・サーバー側の規則は対象外 | vercel-labs/agent-skills の `skills/react-best-practices`（コミット固定、MIT） |
| modern-web-guidance | HTML・CSS・ブラウザー側 JS のウェブ標準に沿った書き方 | 利用者の [skills](https://github.com/aki05162525/skills) の `packages/modern-web-guidance`（コミット固定）。中身は GoogleChrome/modern-web-guidance をコミット固定で取り込む |
Bun はブラウザー向けコードと開発ツール、APM は AI が読む開発資料を担当する。APM やスキルはアプリの配信物に含めない。

## 初回セットアップ

APM CLI は **0.35.0** を使う。既にインストール済みなら `apm --version` で確認する。Python 3.10 以上の環境では、公式が案内する pip 配布を次のように版指定して導入できる。OS の Python に直接入れたくない場合は、仮想環境を作ってから実行する。

```sh
python -m pip install apm-cli==0.35.0
apm --version
apm install --frozen
apm audit --ci
```

リポジトリのルートで実行する。`apm.yml` の対象は `codex` と `claude` に固定しているため、ローカルの自動検出結果によって別のエージェント設定は追加されない。APM は Codex 用に `.agents/skills/<スキル名>/`、Claude Code 用に `.claude/skills/<スキル名>/` へ同じスキルを配置する。各エージェントの新しいセッションから検出できる。

新しいチェックアウトや worktree では、`python3 -B tools/dev/setup_checkout.py` がツール、フロントエンドの依存、フック、スキルの復元をまとめて行う。APM がない環境ではスキルの復元だけを飛ばし、その旨を表示する。

初期導入時のコマンドは次のとおり（スキルごとに1回）。普段の復元では上記の `--frozen` を使い、この追加コマンドを繰り返す必要はない。

```sh
apm install 'AnmolSaini16/mapcn/skills/mapcn#5f0491955ad3ac7b51a7ed16b1f72f9c7ae9dab0' --target codex,claude
apm install 'aki05162525/skills/packages/modern-web-guidance#614a78e70b95c2d4082b8e6c18faeb47c31ba33f' --target codex,claude
apm install 'vercel-labs/agent-skills/skills/react-best-practices#1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62' --target codex,claude
```

`apm.yml` と `apm.lock.yaml` を Git に保存する。`.agents/skills/` と `.claude/skills/` 以下は固定した原典から生成する出力、`apm_modules/` は復元用キャッシュとして Git 対象外にする。ロックファイルには解決済みのコミットと内容のハッシュが含まれる。新しいチェックアウトでは、エージェントに作業を依頼する前に `apm install --frozen` を実行する。スキルを使う間は `apm_modules/` を残し、APM の復元・監査が使えるようにする。

### APM 0.35.0 で出力を Git 管理しない理由

APM の公式文書は出力のコミットを推奨するが、0.35.0 では追跡済み出力のある新規チェックアウトで `apm install --frozen` が出力を削除し、監査が失敗する。ローカルの配置記録がないため配置をスキップし、出力を古いファイルと判定するためである。

本プロジェクトではこの版の対処として、スキル出力を追跡せず、通常の frozen install でファイルとローカルの配置記録を作る。`--force`、監査の無効化、ローカル配置記録の共有は行わない。出力の正しさは `apm audit --ci` によるロックファイルのハッシュ・再配置結果との照合で確認する。APM 更新時はこの条件で初回と2回目のインストールを検証し、出力の追跡方針を再検討する。

## 更新

更新時は `apm.yml` の依存をレビューしたコミットに変更して `apm install` を実行する。原典のスキルの差分と `apm.lock.yaml` を確認し、`apm install --frozen` と `apm audit --ci` を通してマニフェストとロックファイルをコミットする。生成されたスキルを直接編集せず、変更が必要なら原典への変更か別途レビューするプロジェクト指示として扱う。CLI の版を更新する場合は、この文書と `.github/workflows/agents.yml` の版指定も同時に更新する。

modern-web-guidance のスキルは `npx -y modern-web-guidance@latest` で検索と取得を行う。APM のコミット固定はスキル本文と同梱の `guides/` までで、npx が取得する CLI と検索結果は固定されない。結果が同梱の `guides/` と食い違うときは、取得日と出典を添えて扱う。

スキルに含まれる mapcn の CLI インストール手順は、アプリの部品を導入する別工程である。スキルのコミット固定だけでは、shadcn のレジストリから取得するコンポーネントまでは固定されない。導入したコンポーネントのソースと Bun のロックファイルも保存し、変更をレビューする。

## CI

復元と監査の実行条件・検査内容は [.github/workflows/agents.yml](../.github/workflows/agents.yml) を参照。

APM の組織ポリシー探索は既定のまま有効で、個人リポジトリに組織ポリシーがない場合はその旨の警告が出る。これはスキルのロック・内容整合性の確認とは別であり、このプロジェクトで組織ポリシーの適合を保証するものではない。

## 参照

- [mapcn 公式スキル](https://www.mapcn.dev/docs/skill)
- [導入したスキルの原典](https://github.com/AnmolSaini16/mapcn/tree/5f0491955ad3ac7b51a7ed16b1f72f9c7ae9dab0/skills/mapcn)
- [react-best-practices の原典](https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62/skills/react-best-practices)
- [modern-web-guidance のパッケージ](https://github.com/aki05162525/skills/tree/614a78e70b95c2d4082b8e6c18faeb47c31ba33f/packages/modern-web-guidance)、[原典](https://github.com/GoogleChrome/modern-web-guidance/tree/341268561baaff256927c931ec8215dbd30e3cee/skills/modern-web-guidance)
- [APM パッケージの導入とロック](https://microsoft.github.io/apm/consumer/install-packages/)
- [APM CLI の導入方法](https://microsoft.github.io/apm/getting-started/installation/)

## GitHub Actions の依存更新

全4ワークフローの action は `.github/workflows/actions.lock` で固定する。リポジトリルートで、CI と同じ版の公式拡張を使う。

```sh
gh extension install github/gh-actions-lock --pin v0.4.1
gh actions-lock
gh actions-lock --verify
```

既存拡張の版は `gh extension list` で確認する。異なる版が入っている環境では、一時的な `GH_CONFIG_DIR` と `XDG_DATA_HOME` を指定して導入する（既存の `gh auth token` を `GH_TOKEN` に渡して認証する）。

ワークフローの追加や `uses:` の変更後は `gh actions-lock` を実行し、ワークフローと生成された lockfile の差分を確認して一緒にコミットする。既存の参照を最新へ進める場合は `gh actions-lock --relock` を使い、更新差分を確認する。lockfile は手で編集しない。CI はワークフローか lockfile の変更時に `--verify` を実行し、取得失敗も検証失敗として扱う。Dependabot は GitHub Actions の更新を週次でまとめる。

mise がダウンロードするツールと `run:` でインストールする依存は、この lockfile の対象外。GitHub の `Require lockfile` ポリシーは別の管理設定であり、このファイルの導入では変更しない。
