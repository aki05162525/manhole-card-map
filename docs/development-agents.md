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

`apm.yml` と `apm.lock.yaml`、配置済みの `.agents/skills/mapcn/` を Git に保存する。`apm_modules/` は再生成するキャッシュなので Git 対象外。ロックファイルには解決済みのコミットと内容のハッシュが含まれる。スキルを使う間は `apm_modules/` を残し、APM の復元・監査が使えるようにする。

## 採用理由と更新

- 複数のエージェントが同じ mapcn のルール・API 資料を参照できる。
- 座標順序、地図コンテナーの高さ、レイヤーのライフサイクルなどの実装上の注意を共有できる。
- スキル更新をコードと同様に差分レビューできる。スキルを入れただけで描画速度が改善するわけではなく、ブラウザーでの検証は別途必要。

更新時は `apm.yml` の依存をレビューしたコミットに変更して `apm install` を実行する。配置されたスキルの差分と `apm.lock.yaml` を確認し、`apm install --frozen` と `apm audit --ci` を通してコミットする。CLI の版を更新する場合は、この文書と `.github/workflows/agents.yml` の版指定も同時に更新する。

スキルに含まれる mapcn の CLI インストール手順は、アプリの部品を導入する別工程である。スキルのコミット固定だけでは、shadcn のレジストリから取得するコンポーネントまでは固定されない。導入したコンポーネントのソースと Bun のロックファイルも保存し、変更をレビューする。

## CI

`Agent skills` ワークフローは APM CLI 0.35.0 を導入し、`apm install --frozen`、`apm audit --ci`、配置済みファイルの Git 差分確認を実行する。アプリの既存 CI とは分離し、スキル管理の失敗とフロントエンドの失敗を区別する。外部公開・デプロイは行わない。

APM の組織ポリシー探索は既定のまま有効で、個人リポジトリに組織ポリシーがない場合はその旨の警告が出る。これはスキルのロック・内容整合性の確認とは別であり、このプロジェクトで組織ポリシーの適合を保証するものではない。

## 参照

- [mapcn 公式スキル](https://www.mapcn.dev/docs/skill)
- [導入したスキルの原典](https://github.com/AnmolSaini16/mapcn/tree/5f0491955ad3ac7b51a7ed16b1f72f9c7ae9dab0/skills/mapcn)
- [APM パッケージの導入とロック](https://microsoft.github.io/apm/consumer/install-packages/)
- [APM CLI の導入方法](https://microsoft.github.io/apm/getting-started/installation/)
