# manhole-card-map の開発指針

マンホールカードを配布施設で受け取り、その後に蓋を訪れて撮影する利用者向けの地図。主に表示するのは配布施設ピン。蓋は別の目的地として扱い、詳細から Google Maps へ渡す。軽快な操作と訪問先情報の正確さを重視する。

## 作業上の合意

- 日本語で報告する。実施した検証と未確認の範囲を区別する。
- ドキュメントと既存コードが食い違うときはコードに従い、同じ PR で文書を直し、見つけた食い違いを最後の返答ですべて挙げる。古い文書や過去の計測・調査記録を根拠に、設計や判断を縛らない。
- 新機能・不具合修正は対象の振る舞いが失敗するテストから始める。自明なテストは書かない。期待値や hash だけを合わせて検査を通さない。
- 確認の重さは失敗したときの損失に合わせる。同じ内容を検査した通常フック・CI の成功は再利用し、全 suite を重ねて実行しない。画面操作は利用者が確認する。
- 機能の実装・修正は、毎回の指示がなくても [ハーネス](docs/harness.md) の使い分けに従って委任してよい。数ファイルで済む変更は自分で行う。親が統合と最終検証を担当し、調査候補を自動承認しない。作業中に気づいた進め方の改善は、ハーネスへ足す。
- レビューは [REVIEW.md](REVIEW.md) に従う。
- 進捗・調査履歴・テスト結果は Issue・PR・CI へ残す。検証結果の Markdown や archive を新設しない。

## 構成と参照先

作業に必要な資料だけ読む。標準画面は React + TypeScript + Vite + mapcn / MapLibre。

| 作業 | 実装・参照先 |
| --- | --- |
| 地図・詳細UI | `web/src/app/`（画面の切り替え）、`web/src/pages/`・`web/src/features/`（純粋関数は `web/src/domain/`、共通補助は `web/src/shared/`）、[web/README.md](web/README.md)、[mapcn設計](docs/mapcn-design.md)、都道府県の範囲は `tools/map/` |
| アカウント・記録・フレンド | API は `web/worker/`・`web/migrations/`、画面は `web/src/pages/account/`・`web/src/pages/friends/`・`web/src/features/records/`、[アカウント設計](docs/account-design.md) |
| 配信 | [配信手順](docs/deployment.md)、`web/wrangler.jsonc`、`.github/workflows/` |
| 配布情報モデル | `cmd/builddata/`、`internal/`、[配布場所設計](docs/distribution-design.md) |
| 台帳の表（SQLite）と位置の採用・訂正 | `tools/db/`、`data/db/`、[台帳データベースの設計](docs/database-design.md) |
| 原本の取得・位置候補の保守 | [取得・候補・レビューの手順](docs/data-maintenance.md)、`data/user-answers/`、`data/terms/` |
| 件数と残件 | `tools/db/ledgerdb.py summary`、`data/work/internal-data/quality.json`、[件数の取り方](docs/database-design.md#件数の取り方) |
| スキルの復元・更新 | [APM手順](docs/development-agents.md)。生成されたスキルは直接修正しない |

- main の CI 成功で https://manhole-techo.com へ自動配信される（Cloudflare Workers Static Assets）。マージは本番への配信になる。
- プレビューは D1 なしで `/api/*` が404になる。アカウントの画面は、ビルド時の `VITE_ACCOUNTS_ENABLED` が `true` のときだけ出る。
- HTML・CSS・ブラウザー側の JS は modern-web-guidance スキル、React は react-best-practices スキルで現行の書き方を確かめる（Next.js・サーバー側の規則は当てはまらない）。

## 開発と検証

ツールの版は `mise.toml`、コマンドは `web/package.json` を基準にする。mise をシェルで有効化していなければ `mise exec --` を付ける。

```sh
# リポジトリルート：初回セットアップ（新しい worktree でも同じ）
python3 -B tools/dev/setup_checkout.py

# web/：フロントエンド変更の検証
bun run lint && bun run lint:css && bun run knip && bun run format:check
bun run typecheck && bun run test && bun run build:fixture
```

- 整形は `web/` で `bun run format`。ESLint の設定は追加しない（Oxlint / Oxfmt を使う）。
- Go・台帳・Python の変更はルートで `go test -count=1 ./...`（`tools/db` と `tools/research` の Python unittest を含む）。データの採用やマージの前に、対象 head の CI 成功を確かめる。
- ブラウザー検査（`bun run test:browser`、実データは `REAL_DATA_ORIGIN=<稼働中のURL> node scripts/real-data-browser-check.mjs`）は CI では走らない。必要なときに手動で実行する。
- サーバーを起動する前に稼働プロセスとポートを確かめ、自分の試験サーバーは終了する。利用者のサーバーは明示された範囲でだけ止める。

## データを変更するとき

- カードの収録、配布関係の確認、配布状態、施設位置の採用は別の判断。座標があっても受取可能・在庫ありとは限らない。
- 配布施設へ案内できれば位置を採用する。入口・室内窓口の測量は要求しない。候補の棟が同じ敷地内で50m程度に収まり、線路や川で隔てられていなければ、棟を特定しなくてよい。公式情報に最も合う建物に点を置く。旧施設・別の施設・蓋・単なる地図中心を代用しない。座標系の名称だけが未確定であることを、保留の理由にしない。
- 独立レビューは敷地、点の置き場所（道路・線路上でないか）、別施設との取り違えを確かめる。別棟の否定までは求めない。残る不確かさは記録する。
- 人への確認は別の敷地や遠い場所を指すおそれがあるなど、案内先が変わる場合に限る。AI 調査の転記を電話・現地確認として扱わない。
- 採用・訂正の根拠は台帳の表に記録する（出典URL、取得日時、原本の sha256、確認日、確認主体・方法、座標系・精度・加工方法）。レビュー済みの採用対象だけを足し、`tools/db/ledgerdb.py build --check` を通す。
- 取得した原本は Git 管理外の `data/work/originals/` に置き、採用とレビューの後は持たない。Git に残すのは、利用者の回答・承認（`data/user-answers/`）と、利用条件の写し（`data/terms/`）だけ。これらをブラウザー向けの配信資産へ混ぜない。原本全文の再配布と座標情報の利用条件は別に確かめる。
- `web/public/data/`・`web/dist/`・`web/dist-fixture/` は生成物。台帳か生成処理を直して作り直す（手順は `web/README.md`）。実データが足りないとき、fixture へ自動で置き換えない。
- 静的 JSON の配布状態は時間の経過だけでは更新されない。再生成するときは一覧原本と `-as-of` の基準日を明示し、根拠が古い状態を新たな確認済み情報として扱わない。件数は対象集合と基準日を添え、`ledgerdb.py summary` と `quality.json` から取る。

## UI・性能で守ること

- 位置未確定でも検索・詳細から施設を確認できる状態を保つ。地図の初期化に失敗しても一覧を使えるようにする。
- 実 JSON には説明・営業時間・リンクが `null` のカードがある。終了・未確認・複数窓口のデータも描画を確かめる。
- 性能は実地図で、起動・詳細の応答・移動を分けて測る。fixture の無地の背景や PC での結果を、実地図・スマホの性能の保証にしない。大チャンクの警告を、閾値の変更だけで解消扱いにしない。
- 私的データ（記録、フレンド、アカウント）をブラウザーの保存領域と history に入れない。同じ文書で切り替える画面の決まりは [ハーネス](docs/harness.md#同じ文書で切り替える画面) にある。

このファイルには恒常的な判断基準とコマンドだけを置く。仕組み（テスト・lint・フック）で止まる規則は書かない。実装やワークフローの変更で無効になった指示は更新する。
