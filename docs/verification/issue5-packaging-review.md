# Issue #5 PR収録レビュー

2026-11-05。private repository 内の収録点検。外部公開・ネットワーク取得・commit・branch・push・PR操作はしていない。原本bytes・共有ファイルを変更せず、このレポートだけを作成した。`docs/verification/issue5-integration.md` と `tools/national/manifest.json` を起点に、新規Issue5成果と直接の依存先を確認した。

## 判定と具体的な対応

1. **収録漏れ防止が必要**。現時点ではIssue5の2ディレクトリ、coverage実装・テスト、説明・検証文書が未追跡。本体assemblerの実行で実際に読み込まれた未追跡ファイルは下記25件。manifest変更だけを収録すると、クリーンcheckoutで台帳を生成できない。25件を含む原本・調査・独立レビュー成果を一緒に収録すること。
2. **CIがPython監査を実行していない**。`.github/workflows/ci.yml` はGo、frontend、合成fixtureの検査を実行するが、`python3 -B -m unittest discover -s tools/national -v` はない。収録だけでPython26テストがCIに追加されるわけではない。継続検証が目的ならこの実行ステップも親側で追加する。
3. **調査補助の再実行には未収録work入力が必要**。本体assemblerには不要。`data/evidence/issue5/north-kanto/inventory.json` のsnapshot参照2種類は `data/work/official-facility-index/{P05-22_GML.zip,tsuchiura-card.pdf}` を指す。現在ローカルでは存在しhash一致だが、そのパスはクリーンcheckoutにはない。調査全体を「追跡ファイルのみでそのまま再実行可能」とは記述しない。
4. **不要probeはGo探索対象**。`review-west-south/evidence-probe.go` と `review-yokohama-priority/evidence-probe.go` は `go list ./...` に独立パッケージとして出現する。両方ともmain関数内の検査であり、`go test ./...` でコンパイルされてもmainの検査は走らない。証跡として保持するなら実行コードの探索を避ける拡張子や配置を親側で選び、実行手順との整合も取る。現状のGoテスト成功をprobe検査成功と数えない。本レビューでは削除・改名しない。
5. **一時ファイルは収録不要**。`data/evidence/issue5/yokohama-priority/__pycache__/fetch.cpython-314.pyc` が存在するがgit ignore対象。強制追加しない。他に `.tmp/.log/.bak/.pyc` の対象内混入は見つからなかった。

## 必須の未追跡依存ファイル

以下は本体 `assemble.assemble()` のrepo_path呼び出しを記録し、`git ls-files` と突き合わせた完全な差分（25件）。既存の追跡済み依存も必要である。

- `data/evidence/issue5/chubu/P05-22_GML.zip`
- `data/evidence/issue5/kinki/snapshots/reused-16a66401531b41a119d1c3955c4446a786029c6151716032ec315410b3daf003.html`
- `data/evidence/issue5/kinki/snapshots/reused-2aa2279cf2f5e93925571dcc1793531e356d7ac8e7a8ed3f317524189aaea873.html`
- `data/evidence/issue5/kinki/snapshots/reused-6bbd75e63afa090f17beaa9613191c3be04306a1d87f06c79f0ae07ecdae17e3.html`
- `data/evidence/issue5/kinki/snapshots/reused-91098476fc503da211a304d1c28387e2cb0f9d2ad854c2cd583a95a07ea30554.html`
- `data/evidence/issue5/north-kanto/4b31a7ac547841fadb01.html`
- `data/evidence/issue5/north-kanto/94c03d33f97df4713b57.html`
- `data/evidence/issue5/north-kanto/e0a856fded24fd7f9b03.html`
- `data/evidence/issue5/north/originals/3056d3e0d02248143f1f2c9a5e62fd37717eb761a7257106b5d252415aef4cdc.zip`
- `data/evidence/issue5/north/originals/3605de35f717b7faca87ea6c2c93dff5c2f13db68327fdfe2ef4076399b23ed2.html`
- `data/evidence/issue5/north/originals/3eae833fea06a5879cd6a3eca218f2418fd8a4eb9b20a2f42b7c6e41da883efb.html`
- `data/evidence/issue5/north/originals/ef63640b62a7d2727475c6820c1895617817607b24739fba282e2296398e146c.html`
- `data/evidence/issue5/review-north-kanto/proposed-location-updates.json`
- `data/evidence/issue5/west-south/3056d3e0d02248143f1f2c9a5e62fd37717eb761a7257106b5d252415aef4cdc.zip`
- `data/evidence/issue5/west-south/ac3770256e1d8f3039e49db8fc2f08cdf3df3a400770123cb29ad133e2a9398e.bin`
- `data/evidence/issue5/west-south/cc5fb1ec44029eefe6a2aebdc3ec3f431d54363a4be026da03dd29a7805e6fad.bin`
- `data/evidence/issue5/yokohama-priority/53391459.gml.gz`
- `data/national/issue5/chubu-reviewed.json`
- `data/national/issue5/kinki-reviewed.json`
- `data/national/issue5/north-reviewed-patches.json`
- `data/national/issue5/north-reviewed.json`
- `data/national/issue5/south-kanto.json`
- `data/national/issue5/west-south-reviewed-patches.json`
- `data/national/issue5/west-south.json`
- `data/national/issue5/yokohama-priority.json`

Python監査の収録に必要な追加ファイルは `tools/national/coverage.py`、`tools/national/test_coverage.py`、`data/national/issue5/baseline-coverage.json`（test_coverageが直接読む固定fixture）。`tools/national/test_assemble.py` と `tools/national/manifest.json` の変更も同時収録する。`final-coverage.json` は現状のテスト直接入力ではないが最終監査の成果として収録する。

監査可能性のため、`data/national/issue5/` の元候補・reviewedコピー・`reviews/`、`data/evidence/issue5/` の原本、取得記録、導出根拠、レビュー記録と補助スクリプトを保持する。上記25件だけを残せば十分という意味ではない。`docs/issue5-coverage.md`、`docs/verification/issue5-{coverage-review,integration}.md`、このレポート、変更済み `docs/national-assembly.md` も収録対象。原本やコピー重複は勝手に削除しない。

## 証拠のpath/hashと再現性

本体assemblerはメモリ内で実行成功。施設1,586、関係1,670、承認位置追補642。manifest選択パッチのファイルhash、位置行hash、採用証拠bytesのhashが検査を通過した。本体の実読み込みに `data/work` はゼロ。既存追跡ファイルと上記25件を収録すれば、採用台帳の証拠はrepo相対pathで解決できる。

Issue5内JSONの `snapshotPath` / `snapshotSHA256` 対を再帰検査し、5,729参照・1,676 unique pathでローカル欠落・hash不一致ゼロ。ただし、これは現在のworkspaceでの検査であり、前述のwork参照2種類は別扱い。全種類のメタデータhashを一律検査したという意味ではない。

work参照の原本bytesには追跡済み同一内容がある：

- `P05-22_GML.zip` → `data/evidence/national/locations-chugoku-shikoku/reuse-3056d3e0d02248143f1f.zip`
- `tsuchiura-card.pdf` → `data/evidence/national/kanto-north/210f0e368caa1cfa7b0f.html` および `data/evidence/national/locations-kanto-north-ibaraki-tochigi-gunma/reused-210f0e368caa1cfa7b0f.html`（拡張子ではなくbytesのSHA256一致を確認）

原記録のpathを書き換えず、必要なら再構築用の対応表として扱う。`north-kanto/assemble.py` は地域調査用であり、`tools/national/assemble.py` と区別する。地域build/validate、north・north-kanto・review-*のverify等は `data/work/issue5-baseline/{ledger,full}.json` に依存し、north/build.pyはbaseline manifestにも依存する。coverage READMEの基準再現コマンドもwork入力を必要とするが、同READMEはそれをCI前提にしないと明記しており、この点は実テストと一致している。

## 容量と重複

計測は圧縮前のファイルbytes（ignored pycを含む）。`data/evidence/issue5` は1,126ファイル・225,237,444 bytes、`data/national/issue5` は21ファイル・12,969,564 bytes。合計238,207,008 bytes。単体50,000,000 bytes超も50 MiB超もゼロ。

最大は `data/evidence/issue5/north/originals/1c61ab51c3621b54849e0f68c196f37213f981a50a96eef40fa75086515b7e08.pdf` の37,439,676 bytes。次点は `north/5372621a66628b06fea2.pdf` の30,355,519 bytes。

Issue5両ディレクトリ内の完全bytes重複は30組、余剰コピー38ファイル・20,495,852 bytes。例えばP05 ZIPは `chubu/P05-22_GML.zip`、`west-south/3056d3e0d02248143f1f2c9a5e62fd37717eb761a7257106b5d252415aef4cdc.zip`、`north/originals/3056d3e0d02248143f1f2c9a5e62fd37717eb761a7257106b5d252415aef4cdc.zip` で一致する。3パスとも本体の証拠依存に含まれる。

既存の追跡済み `data/evidence` と同一bytesのIssue5ファイルは881件・131,805,958 bytes。これは上の重複集計と重なるため加算しない。コピーは証拠参照の保存単位でもあり、容量だけを理由に削除するとpath検証を壊し得る。今回はすべて保持する。

## 秘密情報の点検

原本を含む対象ファイルを既知の秘密鍵・GitHub/AWS/OpenAI token形・認証ヘッダ形で検査し、該当なし。JSONヘッダも構造走査した。これは任意形式の秘密情報が絶対にないという保証ではない。

`Set-Cookie` は south-kantoのsource-index/fetch-recordsとそのnationalコピー、north-kantoのfetch-additional-records/candidate-revalidationに存在する。取得元は公開Webのjebl、yokohamastationcity、at-yokohama、川島町。対応するfetchスクリプトは認証情報・Cookieを渡さない匿名GETで応答ヘッダを保存しており、保存値を実認証credentialと判断する根拠はない。リクエストのAuthorization/Cookieやログイン済みセッション持込みは確認されなかった。匿名応答Cookieを理由に原本bytesを変更しない。値はこのレポートにもツール出力にも記載していない。

## 検証結果と文書上の相違

- `python3 -B -m unittest discover -s tools/national -q`：26件成功。
- 本体assemblerのメモリ内実行と採用path/hash検査：成功。
- `go list ./...`：上記probeの2パッケージを確認。Go全テスト・frontend検証は今回再実行せず、integration記録の実施報告と区別した。
- `docs/issue5-coverage.md` の「読んだ仕様との相違・限界」はassembly文書の位置追補を605件と引用するが、現在のmanifest/assemblerと更新済みassembly文書は642件。基準時点605件への言及だと明示すると誤読を防げる。
- 横浜probeの出力文字列は「actual Go Evidence strict decode and validateEvidence」とするが、コードは本体を呼ばず構造体・検証関数を複製している。本体そのものの回帰検証とは区別する。

integration記録に既にあるCRSや旧説明等の相違は、本レビューで地理・施設の内容再審査をしていないため再判定していない。今回新規に確認した収録上の相違・限界は上記のとおり。
