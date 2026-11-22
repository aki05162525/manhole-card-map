# AIエージェントで開発するときのハーネス

AIに任せる作業の進め方をまとめる。うまくいかなかったときは、担当の出来を責める前に、指示・検査・環境のどこを変えれば再発しないかを考えて、ここを直す。作業ログや結果は書かず、次の作業で使う決まりだけを書く。守る規則は [AGENTS.md](../AGENTS.md)、レビューは [REVIEW.md](../REVIEW.md) に置く。

## 仕組みで止めているもの

テスト・lint・フックで止められる規則は文書に書かず、仕組みに置く。新しい決まりを足す前に、ここへ移せないかを考える。

| 止めているもの | 仕組み |
| --- | --- |
| フックのスキップ、コミット署名の無効化、Git の恒久設定の変更、確認の後に無条件で続く `gh pr merge`。ヒアドキュメントの本文（区切りに引用符がなければ、その中の `\$` で無効にしていない `$(...)` は見る。シェルが読むヒアドキュメント・ヒアストリングは本文もコマンドとして見る）と、`echo`・`command -v` などの引数に書いた `gh pr merge` は見ない。`if`・`then`・`do`・`{` などの予約語の後はコマンドの位置として読む | [command_guard.py](../tools/agents/command_guard.py)（Claude Code は `.claude/settings.json`、Codex は `.codex/hooks.json` から呼ぶ。checkout の外では通す）。Codex の [.codex/rules/](../.codex/rules/git-safety.rules) は Python を呼ばない別の `prefix_rule` で、コマンドの先頭の語の形だけを止める |
| PR の分岐点の後に base の lint・型検査の設定が変わった PR の `gh pr merge`。設定は CI の lint・typecheck のジョブが実行するもの：その手順が `bun run` で呼ぶ `web/package.json` の script、その script が起動するパッケージ、`web/scripts/lint/` の plugin（試験と型定義を除く）が import するパッケージ、stylelint の `customSyntax`・`plugins`・`extends` と oxlint の `jsPlugins` が名指すパッケージ、`typescript`・`tsrs`・`@types/*`、設定ファイル（`web/.oxlintrc.json`・`.stylelintrc.json`・`.oxfmtrc.json`・`knip.json`・`tsconfig*.json`・`web/scripts/lint/`）。ほかの依存（react・vitest など）では止めない。main のブランチ保護は最新の main の取り込みを求めない（速さを優先）ので、ここで止める。PR に main を取り込めば通る。`--auto` は予約したときに確かめるだけで、予約の後の base の更新は確かめない。`--help`・`--disable-auto` は見ない | [merge_guard.py](../tools/agents/merge_guard.py)（command_guard.py から呼ぶ） |
| T3 の `delegate_task` で、レビュー・調査の担当（role が `review`・`research`）に `isolation: "worktree"` を渡さないこと | [delegate_guard.py](../tools/agents/delegate_guard.py)（Claude Code・Codex の PreToolUse。シェルの `acp-mcp-call delegate_task` は command_guard.py から） |
| T3 の `delegate_task` で、開いている PR に修正を足す worktree の担当の task に、ブランチの手順を書かないこと。task には `git switch -c <作業名> origin/<branch>` で作業し `git push origin HEAD:<branch>` で push する手順を書く。フックが確かめるのは、`git switch -c`（または `git checkout -b`）と `git push <remote> HEAD:` の両方があることだけで、起点・remote・ブランチ名は見ない。修正の送り先が既存の PR と読める言い回し（`PR #12 に…足す`、`PR #12 を修正`、`同じブランチに push`、`push to PR #12` など）で止め、PR やそのブランチに触れるだけの task と `Issue #12` は通す。言い回しは [test_delegate_guard.py](../tools/agents/test_delegate_guard.py) の例が持つ | [delegate_guard.py](../tools/agents/delegate_guard.py) |
| `data/` への実行コードと、取得した原本の持ち込み | [data_policy.py](../tools/ci/data_policy.py)、[acquisition.py](../tools/research/acquisition.py) |
| 台帳の過去の位置の判断の書き換え | [ledger_history.py](../tools/ci/ledger_history.py) |
| 層の表に反する import（製品コードからの試験 `*.test.*` とテスト補助 `fake-*`・`test-*` の取り込みを、同じ単位の中も含む）、domain・contract・Worker への npm package の取り込み、一覧・about への地図のコードの取り込み。取り込みの形式・例外・パスの解決は検査が持つ | [oxlint-layers.mjs](../web/scripts/lint/oxlint-layers.mjs)（層の表と例外の一覧）、[oxlint-layers.test.ts](../web/scripts/lint/oxlint-layers.test.ts) |
| `src/pages/`・`src/features/`・`src/app/` の製品コードでの `history` と popstate の直接使用（テストと、招待ページがフラグメントを消す1か所は例外）、domain・contract・Worker でのブラウザーの globals | [web/.oxlintrc.json](../web/.oxlintrc.json)、[oxlint-app-history.mjs](../web/scripts/lint/oxlint-app-history.mjs) |
| 製品の `src/`（試験とテスト補助を除く）で、`localStorage`・`sessionStorage`・`indexedDB`・`caches`・`cookieStore`・`cookie` の名前を書くこと。グローバル、任意のオブジェクトのメンバー、分割代入のキー、文字列（`window["localStorage"]`、`Reflect.set(document, "cookie", …)`、記述子の取得）のどれも対象。許可は `src/session/invite-token.ts`・`tab-recovery.ts` の `sessionStorage` と `src/session/signed-in.ts` の `cookie` だけ。実行時に組み立てた名前（`"local" + "Storage"`、`eval`）と、許可したファイルで使うキーは見ない | [oxlint-private-storage.mjs](../web/scripts/lint/oxlint-private-storage.mjs) |
| guard（`src/session/session-guard.ts`）以外の製品コードからの `forgetSignedIn` の取り込み（別名、namespace・default、`export … from`、`import()`・`require()`）と、guard の中での呼び出し以外の使用（ファイルのどこに置いた export も、`export default`、値として渡す・持つ、namespace ごとの公開、計算したメンバー、`import()`・`require()`） | [oxlint-guarded-exports.mjs](../web/scripts/lint/oxlint-guarded-exports.mjs) |
| 履歴への私的な値の混入。ログイン中に地図（詳細のメモ）→一覧→フレンド→入手マップ→戻る→アカウント→地図と巡る1つの経路で、`pushState`・`replaceState` に渡す state と URL（クエリとフラグメントは復号した値も）と、最後の `history.state`・URL に、メモ・受け取り日・フレンドと自分の表示名・招待トークンの本体が入らないかを見る。ほかの経路と値は見ない | [app.dom.test.tsx](../web/src/app/app.dom.test.tsx) |
| 待たない Promise、オブジェクトの既定の文字列化、比較関数のない sort など型を使う検査 | [web/.oxlintrc.json](../web/.oxlintrc.json) の `typeAware`（tsrs） |
| ユニオン型の switch の分岐漏れ、ボタンの type の省略、Promise の二重解決や void コールバックへの取り違え、製品コードでの明示的な any・any 由来の値の無検査な利用・Error 以外の値を新たに throw することなど | [web/.oxlintrc.json](../web/.oxlintrc.json) |
| 一覧の最初の表示への地図のコードの混入、パスキーのコードの境界、配信するデータの世代 | [check-deploy.mjs](../web/scripts/deploy/check-deploy.mjs) |
| 画面の CSS の漏れ、色のコントラスト、サイズ予算、サイト内リンクの `.html`、アカウント無効のビルドへの記録のコードの混入 | [web/scripts/checks/](../web/scripts/checks/)、県・カードページの描画は [static-pages.test.ts](../web/src/pages/card/static-pages.test.ts) |
| フロントエンド試験が参照する web 外のファイルの、CI の取得漏れ | [test_workflow_checkout.py](../tools/ci/test_workflow_checkout.py) |
| Context の value に描画ごとに作る値を渡すこと（import した Context の `<X value>` を含む）と、親の再描画で記録・入手マップの値の参照が変わること | [web/.oxlintrc.json](../web/.oxlintrc.json) の `react/jsx-no-constructed-context-values`、[oxlint-context-values.mjs](../web/scripts/lint/oxlint-context-values.mjs)、[records.dom.test.tsx](../web/src/features/records/records.dom.test.tsx)・[friend-map.dom.test.tsx](../web/src/features/friends/friend-map.dom.test.tsx) |

## 役割

| 担当 | 役割 | 既定のモデル |
| --- | --- | --- |
| オーケストレーター | 設計の判断、指示、差分と報告の確認、統合、マージ | Claude Opus 5.5 |
| 設計・レビュー担当 | 実測と設計案、独立レビュー。リポジトリは変更しない | Codex Astra。設計レビューには Claude Fable 5.2 も使う |
| 実装担当 | 指示された範囲の実装とテスト、ブランチへのコミット | 仕様が明確なら Codex Sol（Claude の枠を使うなら Sonnet 5.5）、複雑なものとリファクタリングは Claude Opus 5.5。見た目の設計と作り込みは Claude Fable 5.2 |
| 並列の作業員 | 1つのコンテキストに収まらない調査・作業を分けて受け持つ | Claude Sonnet 5.5 か Codex Sol |
| 文書の簡潔化 | yomiyasu で推敲し、条件を落とさず短くする | Claude Haiku 5.5。下書きは Sonnet 5.5 |
| 読み取り担当 | 探索とログの読解。編集と判断はしない | Claude は `.claude/agents/`（Haiku 5.5）、Codex は `.codex/agents/`（Luna） |
| 利用者 | 目的と方針の判断、画面の確認 | — |

指揮は Claude Code が受け持つ。Claude の利用枠が尽きたときは、Codex の Astra が代わりに指揮する。

担当は次の順に決める。

1. 間違えたときの損失。データの正確さ・公開手順・資格情報は上位のモデルに任せ、別の系統にもレビューさせる。見た目はすぐ直せるので軽く扱う。
2. 仕様の明確さ。明確なら Sol か Sonnet、曖昧なものや設計を含むものは Opus（見た目の設計は Fable）。
3. コンテキストに収まるか。収まらない作業は Opus か Fable がリードし、並列の作業員に分ける。依存が一本につながる作業は分けない。
4. 系統。実装とレビューは別の系統にする（Claude が実装したら Codex、Codex が実装したら Claude）。
5. 利用枠。片方が詰まったら、もう片方の同じ格に替える（Opus と Astra、Sonnet と Sol）。

| 作業 | 担当 | レビュー |
| --- | --- | --- |
| 小さなバグ修正・UIの調整 | Sol（medium） | 見た目は利用者のプレビュー。データに関わるなら Claude Opus |
| 複雑な機能（アカウント、Worker の API など） | Opus（high） | Astra |
| 大規模なリファクタリング・設計 | Fable（medium） | Astra |
| 見た目の作り込み | Fable | 採点担当（Opus）と利用者の実機確認 |
| 都道府県ごとの位置候補の調査 | Opus がリードし、Sonnet か Sol を並列で動かす | Astra か Fable の独立レビュー |
| 文書 | Sonnet が下書きし、Haiku が簡潔にする | 意味が変わっていないかを Astra が見る |

- 読むだけの作業（探索、テスト・CIのログ、資料の要約）は読み取り担当に任せる。編集と判断は親に残す。
- 担当の力が足りないときは、自己検証を指示に入れる、努力レベルを1段上げる、上位のモデルに替えて努力レベルを下げ直す、の順に試す。Claude Opus を high より上げる前に Fable 5.2 を試す。Sol は medium を指定する（既定の low では途中で報告が返りやすい）。
- 合否を機械で判定できる大量の作業は、まず low で全件を回し、失敗した分だけ high で再実行する。位置の採用、データの訂正、見た目の判断には使わない。
- モデルを替えるのは作業の区切りにし、全履歴を引き継がず、要約と指示書から始める。
- 未コミットの差分は `codex review --uncommitted`、ブランチは `codex review --base main` で、PR を作る前に非対話でレビューできる。

## 指示と報告

委任の指示の雛形（実装、開いている PR への修正、独立レビュー、範囲を絞った再確認）と、報告の読み方、レビューの往復で直し方を切り替える判断は、[delegation-brief スキル](../agents/skills/delegation-brief/SKILL.md) にある。

## 確認の重さ

過度な検証は開発を遅らせる。確認の重さは失敗したときの損失に合わせる。

- 実装担当の合否はテスト・lint・型検査・ビルドと、変えた動きを1回たどる確認までにする。計測、スクリーンショットの網羅、main との操作列の比較、検査スクリプトの整備を合否に入れない。
- 計測と実ブラウザーの確認は、PR に対して指揮役が1回だけ行う。性能を変える PR では効果の数字を1回測る。
- CI の高速化は直近のジョブ・step の時間から待ち時間の主因を選ぶ。並列化では待ち時間と runner の合計使用時間を分け、キャッシュがない初回と通常時の違いも確認する。
- [kill-matrix の計測](../web/README.md#ミューテーションテスト)を同じ予算で再開しても Pending が減らないときは、キャッシュと `--include` を保ち、未判定の ID を少数ずつ `--only` に指定する。最後に `--only` を外して同じ範囲を集計する。
- 独立レビューは認証・私的データ・公開手順・データの正確さ・履歴のように損失の大きい変更に出す。リンクの文字列や演出の削除のような小さな変更は、指揮役の差分確認と CI で判断する。
- 確認が通る前にマージや push をしない。確認とマージは別のコマンドにする。
- 画面は利用者がプレビューURLで確認する。PR本文に確認してほしい点を書く。大きなUIは実装の前に試作かワイヤーで操作の流れを見せる。
- 見た目を段階的に作り込む作業では、段階の最後に、実装担当とは別の採点担当（Claude Opus）がスクリーンショットと実データで採点表どおりに1回採点し、全軸8点以上で次へ進む。
- 旧処理の検査を新しい仕組みへ移す前に、それが守る実際の必要を一文で言えるか確かめる。言えなければ移さずに捨てる。「旧処理と出力が一致する」を移行の合否にしない。

### 同じ文書で切り替える画面

地図・一覧・フレンド・アカウント・about は、同じ文書の中で切り替わる（Issue #260）。

- ページを開き直すことで保たれていた安全がなくなる。画面を足す・保持するときは、私的データの取り直し、利用者の交代、離れた後も続く処理（パスキーの確認、保存、位置情報）を洗い出す。私的な API は `web/src/session/session-guard.ts` を通す。
- 隠したまま残す画面は隠している間の副作用を確かめる（履歴の書き込み、文書全体のキー操作、進行中のアニメーションとタイル取得、top layer に残った modal）。
- 画面の CSS を変えたら、`web/scripts/browser/css-isolation.browser-check.mjs` で他の画面への漏れを比べる。未ログインの状態しか撮らないので、ログイン中の表示（記録欄、確認ダイアログ）に関わる規則は、変更前のビルドと別に比べる。

### 見た目を検査するときの観点

- 一度直した問題が別の画面で再発したら、共通部品にまとめて直す。共通の帯は自身で box-sizing・行送り・最小高さを指定する。
- 文字200%は横あふれに加えて、sticky な帯の高さ・アイコンの大きさ・件数の途中改行を見る。横に収まっていても、画像の隣の情報が1字ずつ改行されていないか確かめる。空状態は、0件の件数・内訳・基準日が重なっていないかを見る。
- スマホの要約に置いた操作は、DOM にあるだけでは届かない。実データの長い内容と小さい画面で、その操作の下端が固定バーより上にあることを実測する。要約は触るとシートが動くので、スクロールで届く前提にしない。
- 条件付きの要素を消した状態も含めて、Grid の列数と右端を実測する。浮動パネルは開閉の両方で隣の操作との重なりを見る。
- canvas 上の円と文字は衝突判定が別になる。必要な地名がすべて出ること、数字が丸に収まること、出典が最長の詳細を開いた状態でも押せることを見る。
- 色や影のトークンへ一括置換するときは、`none`・`transparent` などの意図的な例外を残す。
- 外部ライブラリの開閉UIを拡張するときは、導入版が生成するDOMと開閉属性を実物で確かめる。背景地図の配色を変える前に、配信中の style JSON の source-layer を確かめる。
- modal の終了アニメーションは、裏が inert な間と解除後を分けてフォーカスを見る。
- 画面を比べる撮影はフォント・一覧データ・地図描画の完了を待つ。地図は各画面幅で再読み込みして、初期のカメラをそろえる。
- カスタム404は配信と同じ Workers Static Assets でステータスと本文を確かめる。

### 性能を測るときの観点

- 地図の計測はページだけでなく worker のネットワークも記録・制限する。見えない取得を0バイトやキャッシュ命中と判断しない。圧縮サイズと実転送量を分ける。比べる計測の間に別のビルドやブラウザー試験を重ねない。
- 計測スクリプトが DOM のハンドルを持ち続けると、アプリのリークに見える。
- 計測スクリプトのヘッドレスのブラウザーはソフトウェア描画（SwiftShader）で動き、地図の1フレームの時間はその描画が占める。フレーム時間を実機の滑らかさの代わりにしない。操作中の引っかかりは、CPU プロファイルから JavaScript の時間だけを 50ms の区間ごとに集計し、区間を埋める処理を探す。
- データ待ちの表示を最初の描画の内容に置き換えると、その配置計算も最初の描画へ移り、FCPが遅れることがある。FCPと目的の表示の時刻を分けて測る。
- 性能予算は対象チャンクと圧縮方式を明記する。フォント名のチャンクにも共有トークンが混ざるため、ファイル名だけで除外しない。
- シートの性能は移動中と終了後のレイアウト処理を分けて数える。シートが止まった後に別の要素（現在地・出典・固定バー）が動き出す遅れは、シートだけの計測では見えない。指を離してから全要素の `transitionend` が終わるまでを測る。
- 動きに合わせて書く CSS 変数は、使う要素に置く。ルートの変数を1つ変えるだけで、画面全体のスタイルが計算し直される。

## 環境

- 新しい worktree では最初に `python3 -B tools/dev/setup_checkout.py` を実行させる（依存、フック、スキル）。実データ（`web/public/data/`）は Git 管理外なので、要るなら元の checkout からコピーさせる。
- マージ後は `git fetch --prune` の後に `python3 -B tools/dev/clean_worktrees.py` で消す対象を確かめ、`--apply` で消す。作業中の worktree のブランチは、マージされても作業が終わるまで片付けない。PR を積み上げたら、下の PR のマージ後に上の PR の base を main へ変える。
- 配信の直後は、エッジの一部が少しのあいだ前の版を返す。[smoke-deploy.mjs](../web/scripts/deploy/smoke-deploy.mjs) が再試行するので、回数と間隔はそのスクリプトに従う。
- コミットの署名鍵と署名プログラムは、Git の設定と実行環境の `GIT_CONFIG_*` に従う。環境による上書きがない場合は通常の Git 設定を使う。署名が失敗したら作業を残して利用者に伝える。
- Codex のフックは端末で起動した CLI の `/hooks` で信頼する（T3 Code 経由では信頼できない）。`.codex/hooks.json` を変えたら信頼し直す。有効かどうかは、`echo hook-probe git commit -n .` が止まるかで確かめる。
- コマンドのガードは、`git` の禁止の指定を `echo` の引数にあっても止める。区切りに引用符がないヒアドキュメントの `$(...)` と、シェルへ渡すヒアドキュメントも検査する。禁止の指定を含む文書を書き換えるときは、編集用のスクリプトをファイルに書いてから実行する。
- フックのテストの `git` 呼び出しには `GIT_*` を渡さない。一時リポジトリでのコミットはコマンド単位で `-c commit.gpgsign=false` を付ける。
- ローカルの実データ確認では、ブラウザーが受け取った基準日と生成JSONの基準日を照合する。
