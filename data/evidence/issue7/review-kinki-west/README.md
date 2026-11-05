# Issue 7 kinki-west 独立採否レビュー

28候補を個別レビューし、26件 accepted、2件 deferred、0件 correction-required とした。機械可読の全判定・採用ID一覧・exact old/new 訂正案は `data/national/issue7/reviews/kinki-west.json`。採用は建物代表点の判定であり、配布状態・関係の変更やmanifestへの適用ではない。

保留は次の2件。

- `facility:kinki-9a89ff7b1625b66ddbd8`：柏原市役所本館。P05の市役所点と女性センター・フローラルセンター点が約1mの範囲に集中する一方、公式原本は新本館と別館を区別する。別館写真のファイル名も floralcenter.jpg。2021年竣工と2022年版だけでは点が本館を表すか解消しない。配置図との照合が必要。
- `facility:kinki-daaa4e44e2c541067679`：スワンホール。公式原本では中央公民館も同じ館内だが、P05の中央公民館948は約480m離れる。明示名称の947を優先するだけで競合解消とは認定しない。建物外形または公式目的点で判別する必要がある。

その他26件は、施設の合理的な名称・住所・現建物対応で採用。入口・室内の測量や全改修履歴の不存在証明は要求していない。高砂は2021年9月竣工・同年11月開庁と現本庁窓口を原本で確認し、2022年4月基準の本庁分類点を対応させた。現地測量までの確認は主張しない。

原ZIPの3府県GeoJSON member・28 feature・GML P05 IDとpoint ID・原数値・軸順・EPSG:6668・hashを再照合。元GMLには不正な分類タグがあるためXML全体の妥当性を主張せず、該当FeatureブロックとPointの文字列を個別確認した。GeoJSONは経度/緯度、GMLは緯度/経度。`evidence_contract.go` は実コードのEvidence型とvalidateEvidenceをそのまま抽出した検証用ハーネス。28件は7フィールドだけでなく `checkedAt` の `YYYY-MM-DD` 検証にも合格し、日時文字列の負例は拒否された。

出典条件は `source-conditions.json`。保存済みP05-2022個別ページのCC BY 4.0指定と、現在の一般PDL1.0および現行カタログの表現を別々に保持する。自治体HTMLの照合利用と、その全文の公開再配布許諾は別であり、後者を認定していない。

文書とコードの相違は1件。READMEは既存取得メタデータの実取得時刻を継承すると述べるが、build.pyの汎用再利用ループは無条件にfetchedAtをnullとする。p05-spec.pdf.source.jsonに実取得時刻が存在するため補正案を記録した。コード・生成物の現状を事実として扱い、元ファイルは修正していない。

仕様書PDFを再抽出し、品質検査は6章、8章はメタデータと確認。既存READMEへの8→6訂正案を支持し、sources.jsonのpointMeaningにも同じ誤記が残ることを追加指摘した。これらは原典との相違でありEvidenceコード契約との不一致ではない。

134対象のうち元の未解決106件は35件の個別精査済みと71件の構造探索・P05照合までを区別して維持。今回の候補28件レビューを理由に残件全深掘り済みとは扱わない。原本94ファイルの候補本文照合記録はidentity-audit.json、全467参照hashの検証記録はsource-hashes.json。検証結果はvalidation.json。

元成果・manifest・既存共有ファイル・コード・固定baselineは変更していない。子起動、branch、commit、push、PR操作なし。review.pyは検証とレビューJSON再生成のみを行い、元build.pyは再実行していない。
