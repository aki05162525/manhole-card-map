# Issue14・15 統合検証

2026-11-05のローカル検証。全国の位置確定・全出典の利用条件確認・画面検証を完了したという記録ではない。採用台帳・manifest・配信データは変更していない。

## 変更と独立レビュー

全国監査、出典棚卸し、出典条件の一次資料調査を別担当で実施し、親が統合した。全国監査は固定810対象と全国の既知集合を分け、古い生成物・未登録proposal・未評価の調査段階を識別する。出典棚卸しは座標の根拠行を保持し、条件点検を施設IDと行全体のhashへ限定適用する。

独立レビューで検出し、修正後に検証した事項：

- 現台帳では配布中の施設を、古いfullの終了状態で作業対象から除外していた。現在の関係・証拠・原典指紋との照合を追加した。
- 現台帳の配布関係がfullから欠落した状態を、施設の再確認理由に出していなかった。欠落カードIDと不一致シグナルを追加した。
- 位置が一致していてもpinが欠けるケースと、proposalの関係証拠だけが異なるケースを監査対象に加えた。
- 出典条件のP05実例が、現採用と同じ施設・座標を持つ旧候補行を指していた。両行の原本・加工説明を再読して現採用行に訂正し、理由をregistryに保持した。旧候補は未点検のまま。
- PLATEAUの取得失敗後にHTTP再取得が成功したことと、Site Policy第3節(3)のCC BY 4.0許諾を本文・registryへ反映した。個別例外と加工への適用確認は保留のまま。

## 検証

- 新規の全国監査17テスト、出典棚卸し13テストで失敗から成功を確認。初回のモジュール欠落だけでなく、上記の世代差・誤selector等も回帰テストで失敗を再現した。
- `python3 -B -m unittest discover -s tools/national -v`：既存39件を含む69件成功。
- `mise exec -- go test -count=1 ./...`：成功。Go側からのPython全件検証も含む。
- 現manifestからassembleとGo builddataを実行し、既存coverageで台帳・施設・関係・pin整合を確認した。
- 新しい2つのCLIを実データで実行し、同じ入力で再実行した内容が一致することを確認した。固定残件のID集合は既存issue7_auditのcurrentStatus=remainingと一致した。
- source registryは現採用行へのexact参照と根拠を検査する。取得記録のメタデータ検査は非配布のdata/work原本に依存せずCIでも実行可能。ローカルでは取得成功原本のbytes/hashも照合した。

## 再現手順

保存済み全国素材が必要。出力先は未使用のディレクトリとファイルを使う。生成物は通常のweb/public/dataへ書き込まない。

```sh
mkdir -p data/work/issue14-15-validation
python3 -B tools/national/assemble.py \
  --out data/work/issue14-15-validation/ledger.json \
  --audit-out data/work/issue14-15-validation/assembly.json
mise exec -- go run ./cmd/builddata \
  -places data/work/issue14-15-validation/ledger.json \
  -review-list data/evidence/national/list-source/gkp-20261105.html \
  -date 2026-10-21 -as-of 2026-11-05 \
  -out data/work/issue14-15-validation/generated
python3 -B tools/national/coverage.py \
  --full data/work/issue14-15-validation/generated/full.json \
  --ledger data/work/issue14-15-validation/ledger.json \
  --out data/work/issue14-15-validation/coverage.json
python3 -B tools/national/national_audit.py \
  --full data/work/issue14-15-validation/generated/full.json \
  --ledger data/work/issue14-15-validation/ledger.json \
  --as-of 2026-11-05 --out data/work/issue14-15-validation/national-final.json
python3 -B tools/national/source_inventory.py \
  --registry data/national/source-review/registry.json \
  --as-of 2026-11-05 --out data/work/issue14-15-validation/sources-final.json
```

台帳・候補の元ファイルは保持する。各レポートのinputSHA256が、今回読んだ入力の再現キーである。全国監査の証拠hash収録範囲と、出典棚卸しの全検査原本収録範囲はそれぞれのCLI文書に記載した。

## この入力での結果と限界

固定810施設の採用198・残件612。台帳と生成full等の和集合は1,735施設で、full上の未位置761施設と台帳上の未位置612施設は異なる集合である。現在の採用位置について、生成座標の不一致・期待pinの欠落はともに0件だった。

fullには同じカード・施設ペアの完全一致関係が2件ある。元行を保持して重複参照を報告する。関係照合が未一致の1施設 `facility:cs-e908bad62bf5a18ac0` は確認済みactiveと未確認unknownが共存しており、監査は保守的に再確認対象とする。この変更では配布関係を修正していない。

出典棚卸しは採用974施設・974行と明示候補166行を対象とした。候補行数は未位置施設数ではない。今回の条件点検は5つの現採用行に限定し、1行は条件付き、4行は要確認、残る1,135行は未点検。出典名をURLから推測して一括許諾していない。詳細は[出典点検記録](issue15-source-review.md)を参照する。

未収録カードの原本ID対応表は今回作成していないため、その比較は未評価。全候補の施設同定、現地確認、全取得元の条件点検、ブラウザー描画・Google Maps到達精度は未実施。UI/SWを変更していないためフロント全体・オフラインブラウザーテストは今回実行していない。

## 既存文書との関係

既存の「公式施設案内にある目的地座標」という説明だけではP05/PLATEAUの採用を説明できないため、コードと現採用の根拠を優先した。また「新規住所ジオコードではない」は本プロジェクトの加工と原典作成工程を区別する必要がある。既存文書の修正自体は #18 に残す。今回確認したfullの関係重複・空hoursの省略は、台帳の一意性や配列型を生成fullへそのまま当てはめられない点として新監査文書に明記した。
