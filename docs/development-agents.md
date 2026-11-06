# AI 開発用のスキル管理

地図 UI の実装で使う mapcn 公式スキルを、Microsoft の **Agent Package Manager (APM)** で管理する。Bun はブラウザー向けコードと開発ツール、APM は AI が読む開発資料を担当する。APM やスキルはアプリの配信物に含めない。

## 初回セットアップ

APM CLI は **0.35.0** を使う。既にインストール済みなら `apm --version` で確認する。Python 3.10 以上の環境では、公式が案内する pip 配布を次のように版指定して導入できる。OS の Python に直接入れたくない場合は、仮想環境を作ってから実行する。

```sh
python -m pip install apm-cli==0.35.0
apm --version
apm install --frozen
apm audit --ci
```

リポジトリのルートで実行する。`apm.yml` の対象は `codex` に固定しているため、ローカルの自動検出結果によって別のエージェント設定は追加されない。APM は `.agents/skills/mapcn/` にスキルを配置する。Codex の新しいセッションから検出でき、実装中のエージェントは同ディレクトリの `SKILL.md` と必要な references を読む。

初期導入時のコマンドは次のとおり。普段の復元では上記の `--frozen` を使い、この追加コマンドを繰り返す必要はない。

```sh
apm install 'AnmolSaini16/mapcn/skills/mapcn#5f0491955ad3ac7b51a7ed16b1f72f9c7ae9dab0' --target codex
```

`apm.yml` と `apm.lock.yaml` を Git に保存する。`.agents/skills/mapcn/` は固定した原典から生成する出力、`apm_modules/` は復元用キャッシュとして Git 対象外にする。ロックファイルには解決済みのコミットと内容のハッシュが含まれる。新しいチェックアウトでは、エージェントに作業を依頼する前に `apm install --frozen` を実行する。スキルを使う間は `apm_modules/` を残し、APM の復元・監査が使えるようにする。

### APM 0.35.0 で出力を Git 管理しない理由

APM の公式文書は出力のコミットを推奨するが、0.35.0 では追跡済み出力のある新規チェックアウトで `apm install --frozen` が出力を削除し、監査が失敗する。ローカルの配置記録がないため配置をスキップし、出力を古いファイルと判定するためである。

本プロジェクトではこの版の対処として、スキル出力を追跡せず、通常の frozen install でファイルとローカルの配置記録を作る。`--force`、監査の無効化、ローカル配置記録の共有は行わない。出力の正しさは `apm audit --ci` によるロックファイルのハッシュ・再配置結果との照合で確認する。APM 更新時はこの条件で初回と2回目のインストールを検証し、出力の追跡方針を再検討する。

## 更新

更新時は `apm.yml` の依存をレビューしたコミットに変更して `apm install` を実行する。原典のスキルの差分と `apm.lock.yaml` を確認し、`apm install --frozen` と `apm audit --ci` を通してマニフェストとロックファイルをコミットする。生成されたスキルを直接編集せず、変更が必要なら原典への変更か別途レビューするプロジェクト指示として扱う。CLI の版を更新する場合は、この文書と `.github/workflows/agents.yml` の版指定も同時に更新する。

スキルに含まれる mapcn の CLI インストール手順は、アプリの部品を導入する別工程である。スキルのコミット固定だけでは、shadcn のレジストリから取得するコンポーネントまでは固定されない。導入したコンポーネントのソースと Bun のロックファイルも保存し、変更をレビューする。

## CI

復元と監査の実行条件・検査内容は [.github/workflows/agents.yml](../.github/workflows/agents.yml) を参照。

APM の組織ポリシー探索は既定のまま有効で、個人リポジトリに組織ポリシーがない場合はその旨の警告が出る。これはスキルのロック・内容整合性の確認とは別であり、このプロジェクトで組織ポリシーの適合を保証するものではない。

## 参照

- [mapcn 公式スキル](https://www.mapcn.dev/docs/skill)
- [導入したスキルの原典](https://github.com/AnmolSaini16/mapcn/tree/5f0491955ad3ac7b51a7ed16b1f72f9c7ae9dab0/skills/mapcn)
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
