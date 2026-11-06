# 埼玉20施設：生成・ブラウザー検証

実装commit `c9bede8e11c574a6ee4727bd9648bd8c1e8adac7` の入力で実施。localhost:4181の専用サーバーとChromeの一時プロファイルを使用し、終了後に破棄した。全国suiteは通常フックが成功。Mapsはリンクのqueryを検査し、外部へ遷移していない。

```json
{
  "schema": 1,
  "phase": "saitama first adoption",
  "sourceAsOf": "2026-11-05",
  "reviewedAt": "2026-11-06",
  "ledgerFacilities": 1586,
  "ledgerRelations": 1670,
  "unlocatedBefore": 588,
  "unlocatedAfter": 568,
  "generatedPlaces": 1735,
  "generatedRelations": 1825,
  "placePins": 1018,
  "exactChangedIds": [
    "facility:kanto-north-2dc5fe988e3e972a5140",
    "facility:kanto-north-3c2f7159dc235081f4f2",
    "facility:kanto-north-4244d9dc97ba1a68e1de",
    "facility:kanto-north-6777261cc63db7a86bfb",
    "facility:kanto-north-8a61ac8c818d5fd1fa6e",
    "facility:kanto-north-9366bd29aeba766aae7f",
    "facility:kanto-north-9dce5a0d82eb96d95e6c",
    "facility:kanto-north-9f36b9d69d27a034f19c",
    "facility:kanto-north-a51582814cdc995742e5",
    "facility:kanto-north-afe67f47007d5e1f246c",
    "facility:kanto-north-b49337e3f4e3384f788a",
    "facility:kanto-north-c4b568ea60ecd6589c50",
    "facility:kanto-north-c5f25d696949a267388f",
    "facility:kanto-north-c8b6772285e4ba7b42be",
    "facility:kanto-north-d35c60a8c05e97e3a3a9",
    "facility:kanto-north-e1e48bd4fbf356515d0f",
    "facility:kanto-north-e82f8bb306d214d3951f",
    "facility:kanto-north-ed37026123185dfcdd90",
    "facility:kanto-north-f328a302882bae5abddd",
    "facility:kanto-south-c5f3c43a0c2bf2667f5d"
  ],
  "fullSplitDetailMapsBrowserChecks": 40,
  "externalMapsNavigation": false,
  "fullSuite": "normal commit hook; result recorded separately",
  "outputSHA256": {
    "web/public/data/full.json": "0439eec11345a52605933afcd53df5a2fb0a0302a23ca5cdbfc53f55bf836911",
    "web/public/data/quality.json": "a62b158c69136690f13d03b960ed87661dcf386125b963a1aef50c31d962a123",
    "web/public/data/details.json": "bba9b51b3a5984e183ea33fd95c6bffa9f4877dfdc2889b661af604060d6d333",
    "web/public/data/manifest.json": "2feb66e17cd64cf82abd1a6790bde8d17a990a40c864b1e7a7a215bba109fdf0",
    "web/public/data/pins.json": "02007c695dbcdd28754e76ced2f7ac8d5e8a3c706524b028cae5f6a0e3b5495e"
  }
}
```
