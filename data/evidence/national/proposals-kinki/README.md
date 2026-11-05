# 近畿・追加窓口の採用（2026-11-05）

初回監査の18カードの全proposalを個別照合し、19配布関係を `data/overrides/proposals/kinki.json` に登録した。新施設17件、既存文化センターの共有1件。伊丹B/Cは同一仮設施設を共有する。全19関係の `change.kind` は `addition`。位置は担当外のため座標を追加していない。確認主体はAIであり、人・現地確認ではない。

状態はactive 16、suspended 1（寝屋川の休日窓口）、unknown 2。unknownも「配布先としての登録」として採用したが、受取可能を確認した件数には含めない。田尻観光協会は町の配布9～17時と施設の営業9～15時が相違。福崎サキちゃんプラザは町の土日祝18時までと施設の11～3月17時までが相違する。後者は今回の施設原本追加取得で判明した。両方の原文とhashは `decisions.json` の `additionalEvidence` に残した。時刻を勝手に短縮・延長して確定していない。

全18カード・19関係の判定、個別未解決理由は `decisions.json`。伊丹仮設店舗は番地未確定のため、市名と公式の「旧伊丹市演劇ホール喫茶店跡」という所在地説明を保持した。終了日は未告知。旧駅構内住所は流用しない。橿原は10/1から、伊丹は9/14からの新関係。新関係の採用により旧施設の終了をカード全体終了へ誤反映しなくなった。

## 調査と根拠

初回manifestと保存HTMLを再利用し、GKPの再GETは行っていない。追加取得は公式施設の8 URLで、全8件HTTP 200。取得時刻、最終URL、bytesのSHA256は `manifest.json`。`fetch.py` は既存URLを再取得せず、約1.1秒間隔で取得し、HTTP失敗もそのまま記録する。失敗回避・TLS検証無効化は行っていない。元監査にある泉南旧リンクの404は成功へ変更していない。

住所の追補は羽曳野市、福崎町がリンクする指定管理者、明石市がリンクする観光協会、田原本町がリンクする公園公式を使用。明石の配布時間は市が「各施設の営業時間による」と明示しているため、あかし案内所の営業時間を採用した。田原本は配布専用時刻16:30までを保持し、公園の17時閉園に延ばしていない。草津は列挙された月曜・祝日翌日のみを市役所代替対象とし、交流館の全臨時休館日へ拡張していない。

公式限定の追加検索も実施した：

- 羽曳野（city.habikino.lg.jp / ok-habikino.jp）「古市駅前観光案内所 ビジターセンター 移転」。市の現施設情報と設立報告は確認できたが、旧1-1-19窓口の配布終了を示す原本は得られなかった。
- 泉南（city.sennan.lg.jp）「下水道課 樽井737 別館 移転」。現下水道課案内・部署一覧が候補に出たが、旧窓口の配布終了は証明できなかった。
- 田尻（tajiri-tourism.com / town.tajiri.osaka.jp）「田尻 マンホールカード 15時 17時」。町と施設の記載差は残り、案内所個別ページの追加取得でも解決しなかった。

検索結果だけを採用根拠にせず、使用した原本は `evidence-used.json` で列挙した。新規検索の初回には検索語のsite指定外の結果も返ったが、それらは採用していない。

## パッチと未解決の旧関係

`data/national/patches/kinki.json` の `patches` は9件のexact old/new値。親がレビューして元fragmentに適用するための提案であり、元fragment・元監査を変更していない。

- 宇治田原A/Bの3関係と橿原旧関係の現sourceHash：各公式原本の更新内容を確認した4件のみ。全国一括更新ではない。
- 京都Aの既存総合受付：初回fragmentの8:30～17:15（庁舎営業時間）から、公式第2弾カードの平日10～17時へ訂正。
- 交野の既存1階窓口：平日をcondition/hoursに明示。休日警備員室は別の実窓口として追加。
- 四日市・草津：新窓口が実登録されたので、既存hoursから未採用proposalという作業用文言を除去。

同ファイルの `deferredCorrections` は5件の保留記録。old/newは同じ値であり、削除・終了・統合パッチではない。

- 羽曳野旧古市駅前、泉南旧樽井737：新窓口採用済みだが、旧窓口の終了は独立根拠がなく未確認のまま保持。
- 栗東B、門真B、摂津Aの建物見出し：実窓口は初回fragmentで採用済み。建物を第三の配布窓口にしない。現schemaは見出し原関係の除外を表せず、建物を一方の室内窓口のaliasにするのも不正確なため、親側の表現判断待ち。門真Bの現原本はカード全体在庫切れ告知であり、見出しを新しい実窓口に承認する根拠ではない。

## 統合・再現

親は9パッチをexact old値照合のうえレビューし、既存地域fragmentへ適用する。その後 `data/overrides/proposals/kinki.json` を他fragmentとマージする。宇治田原文化センターのfacility行は既存行の完全コピーなので、同ID同値マージが前提。座標担当の修正を先に適用する場合は、この共有行もレビュー済みの同じ値へ合わせるか、統合入力で共有行を1本にする。座標を推測補完しない。

`build.py` は原本と初回fragmentを読み、成果と `/tmp/kinki-proposals-combined.json` のみ生成する。元データを編集しない。以下でpilotを保った一時合成による実Go検証を再現できる。

```sh
mise exec -- go run ./cmd/builddata \
  -places data/work/national-input/places.json \
  -review-list /tmp/gkp-current-design.html -as-of 2026-11-05 \
  -out /tmp/kinki-proposals-current
python data/evidence/national/proposals-kinki/build.py /tmp/kinki-proposals-current/quality.json
mise exec -- go run ./cmd/builddata \
  -places data/work/national-input/places.json \
  -place-fragments /tmp/kinki-proposals-combined.json \
  -review-list /tmp/gkp-current-design.html -as-of 2026-11-05 \
  -out /tmp/kinki-proposals-build
python data/evidence/national/proposals-kinki/validate.py
```

`validation.json`：19追加関係すべてverified、全原関係のcanonical対応を保持、全証拠hash一致、不変入力3ファイルのhash一致、新施設座標0件。伊丹B/Cと橿原Aの旧関係はendedのまま、新関係を加えたカード全体はactive。宇治田原A/Bもactive。全国出力1,313カード・1,744関係となった（この出力は近畿とpilotのみを統合した検証用で、全国完成を意味しない）。

初回の検証実行は近畿台帳単独だったため、全国fullにある他地域pilot施設21関係とcanonical IDが一致しないチェック失敗があった。pilot入力を併用する上記の本来の統合条件で再実行して全件保持を確認した。Go/UIの変更はしていない。

ドキュメントと実装の不一致は今回見つからなかった。初回近畿READMEの「新窓口はproposalまで」は初回成果の記録で、本追補により採用が進んだ。コミット・branch変更・push・PR・子起動は行っていない。
