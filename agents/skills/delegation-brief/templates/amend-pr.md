# 開いている PR に修正を足す雛形

PR のブランチは別の worktree が checkout している前提で指示する。その worktree があると `git switch <branch>` は失敗する。手順の2と6は書き換えずに残す。

`<…>` を埋め、当てはまらない行は消す。

````markdown
開いている PR <URL>（ブランチ `<branch>`、head <SHA>）に、<直すこと> の修正を足してほしい。

## 目的
<何を、なぜ。レビューの指摘なら、指摘の本文か、そのコメントへのリンク>

利用者の言葉:
> <言い換えずに引く>

## 範囲
- 担当ファイル: <パス>
- 並行して別の PR が触るファイル（この PR では変えない）: <PR の番号とパス>
- 判明済みの事実: <調べた結果、捨てた案とその理由>
- 守る条件: <利用者が決めた見た目・決まり、安全の条件だけ>。前からある実装・文書も、良くなるなら作り直してよい。

## 設計の整理（同じ種類の指摘が2回続いたときだけ残す）
指摘を1件ずつ塞がない。前回までの指摘 <番号・要約> に共通する原因を、<何を持ち主として結び付けるか、どこで正規化するか> の設計として整理し、PR 本文に書いてから直す。前回までの指摘は、どれもその設計の帰結として説明できるようにする。

## 進め方
1. 最初に `python3 -B tools/dev/setup_checkout.py` を実行する。
2. `git fetch origin <branch>` の後、`git switch -c <作業名> origin/<branch>` で作業用のブランチを作る。PR のブランチそのものへは切り替えない。
3. 直す振る舞いが今の head で失敗するテストを先に書き、失敗することを確かめる: <テストの場所と、確かめる振る舞い>。自明なテストは書かない。
4. 直す。
5. 合否のコマンドを通す（触った範囲のものを残す）:
   - `web/`: `bun run lint && bun run lint:css && bun run knip && bun run format:check` と `bun run typecheck && bun run test && bun run build:fixture`
   - ルート: `go test -count=1 ./...`
   - ルート: `python3 -B -m unittest discover -s tools/ci`、`python3 -B -m unittest discover -s tools/dev`、`python3 -B -m unittest discover -s tools/agents`
6. コミットして `git push origin HEAD:<branch>` で PR のブランチへ push する。force push はしない。main を取り込むときは `git merge origin/main` を使い、rebase しない。
7. PR 本文の「変えたこと」と検証の記述を、push した内容に合わせて直す。マージはしない。

## 作業の決まり
- 長いコマンドは前景で待つ。バックグラウンドに回したまま報告を返さない。
- 出力を `tail` などで絞るときは `set -o pipefail` を付けるか、ログに保存してから読む。表示用のコマンドの成功で、検証の失敗を隠さない。
- 負荷のせいで変更と無関係のテストが時間切れになったら、負荷が下がってから同じコマンドを再実行する。期待値や timeout を変えて通さない。
- 全部終えてから報告する。

## 報告
- コマンドで確かめた事実だけを書く。実行したコマンドと結果を書き、実行していない検証は分けて書く。
- 文書とコードの食い違いを見つけたら、すべて挙げる。
- 最後の行は `PR <URL>, head <SHA>` にする。
````
