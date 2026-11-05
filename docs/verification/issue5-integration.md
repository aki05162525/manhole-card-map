# Issue #5 統合記録

全国の未位置承認施設847件を地域別に分類。37施設の位置を独立レビュー後に採用し、残る810施設は未承認。全残件の新規Web調査完了や受取保証を意味しない。地域JSONの未解決とレビュー棄却候補を併読する。配布未確認のraw施設は別にfinal-coverage.jsonへ残す。

横浜駅観光案内所14-100-A001は現JR横浜タワーのPLATEAU外形から算出した建物代表点を採用。入口・室内窓口位置ではない。Google由来の候補は使用していない。出典と加工表示をEvidenceに保持。

レビュー済み37施設のcoordinate/evidence、宇美2施設と千歳1施設の名称、神埼1関係のhours/conditionのみを統合。元調査原本や旧候補は保持し、統合用コピーをmanifestで明示選択する。未承認の旧説明訂正はレビューJSONに残し、承認座標と混同しない。

再現：docs/national-assembly.mdのassemblerで台帳生成後、builddataへ -places と -review-list data/evidence/national/list-source/gkp-20261105.html -as-of 2026-11-05 を渡す。coverage.pyへ同じ台帳とfullを渡す。基準/最終監査はdata/national/issue5/{baseline,final}-coverage.json。

Go全テスト、Python26テスト、Vitest56テスト、lint、format、typecheck、通常frontend build成功。web/public/dataとdistに全国データを反映。横浜の配布ピンのcardId/座標とfacilityMapLinkのquery一致を実生成物で検証。今回の実ブラウザー目視は未実施。既存MapLibreの500KB超チャンク警告は継続。

## 相違と対応

- 北関東候補と西日本訂正案のevidence.fetchedAtはGo非対応。原取得記録を保持し統合用Evidenceから除いた。
- 監査地域区分の埼玉/00が調査割当に不一致。北関東08–11、南関東00/12–14へ修正。
- 南関東検証は説明に反してCRS未検査。独立レビューで検証。P05補助資料の追補待ち表現は採用6件には該当しない。
- 寝屋川の終了説明はsuspendedと矛盾。統合用コピーで説明だけ訂正。
- P05の個別CC BY 4.0指定と一般PDL1.0を区別。出典、加工、JGD2011を保持。旧GISの条件/CRS不足は旧原典へ遡及して解消扱いしない。
- 旧北海道の登別/苫小牧の棟未同定、釧路への留萌説明混入はレビュー記録に残し該当座標不採用。千歳部署名は訂正。
- 筑西の名前付きPOI説明、中部の住所feature/別庁舎/処理場全体点の同定説明を訂正案に記録。P05の住所ジオコード不使用という断定と、規約を施設同定資料とする表現は中部統合用コピーで限定・訂正。
- 神埼の公式休館日相違はhours/conditionに明示。宇美の本館/南館名称を訂正。
- 横浜市配置図にモアーズ名称の表示はない。同定は位置・輪郭と他資料の対応による。
- 監査のピン座標/状態、verified関係の台帳状態/期限の検出漏れを修正。reviewSourceHashがある場合の照合を追加。全生成フィールドの版一致を認証するものではない。

## PR収録の注意

CIにPython unittestの明示ステップを追加。調査補助スクリプトには固定work入力依存が残るが、本体assembler・CIテストは追跡対象の原本のみで実行する。原本と証跡のコピー重複は保持し、匿名HTTP応答Cookieを実認証情報として扱わない。pycacheは収録しない。

横浜のevidence-probe.goは本体から複製した型・関数の検査であり、保存済み出力の「actual Go」は本体を直接呼び出した意味ではない。probe二つは記録として保持する。go testのコンパイルだけではprobeのmainは実行されない。本体の検証は親の実builddata生成とGo全テストで別途実施。coverage文書の605件引用は開始時点と明記した。

収録予定のGit indexだけを一時ディレクトリへ展開し、work入力なしでPython26テスト・Go全テストが成功した。実cloneではなくcheckout-indexによる収録内容の検証。
