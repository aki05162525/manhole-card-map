# manhole-card-map

マンホールカードの配布施設を探し、受け取り後に蓋を訪れるための地図。

| やりたいこと | 読む文書と内容 |
| --- | --- |
| アプリを起動・ビルドする | [web/README.md](web/README.md)：環境構築、データ生成、起動、検証 |
| 配信する | [配信手順](docs/deployment.md)：Cloudflare の設定、公開、ロールバック |
| 地図UIを直す | [mapcn設計](docs/mapcn-design.md)：描画、階層、検索、障害時の動作。県の範囲は [地図生成](tools/map/README.md) |
| 施設の位置を調査・採用する | [データ保守](docs/data-maintenance.md)：原本、候補、証拠の管理 |
| 配布情報のモデルと採用基準を知る | [配布場所設計](docs/distribution-design.md)：施設・蓋・配布状態と位置の採用基準 |
| 台帳を統合する | [全国統合](docs/national-assembly.md)：manifest と生成処理 |
| 位置を取り下げ・訂正する | [位置のライフサイクル](docs/location-lifecycle.md)：採用後の訂正・失効 |
| 件数や残件を調べる | [監査](docs/audits.md)：収録・採用・表示の件数定義と残件 |
| AIスキルを復元する | [APM手順](docs/development-agents.md)：公式スキルの復元、監査、更新 |
| GitHub Actions を更新する | [Actions の依存更新](docs/development-agents.md#github-actions-の依存更新)：lockfile の生成と検証 |
| 開発規則を確認する | [AGENTS.md](AGENTS.md)：作業・検証・データ・UIの規則 |
| 変更をレビューする | [REVIEW.md](REVIEW.md)：採用判断、再検証、結果の返し方 |
| 出典とライセンスを確認する | [データ出典](web/THIRD_PARTY_DATA.md)、[mapcn由来](web/MAPCN_PROVENANCE.md) |

React + MapLibreで一覧・検索・詳細を提供し、位置未確定の施設も一覧で確認できる。現在の件数は台帳・生成物の監査、完了済みの調査や検証結果はGit履歴・PR・CIを参照する。
