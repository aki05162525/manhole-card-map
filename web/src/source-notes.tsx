export function SourceNotes() {
  return (
    <details className="source-notes">
      <summary>データの出典と注意</summary>
      <div className="source-content">
        <p>
          非公式の検証用アプリです。在庫は未確認。訪問前に公式情報を確認してください。
        </p>
        <p>
          カード情報：保存済みの GKP
          一覧（画像は使用しない）。配布場所の確定状態は詳細に表示。参考位置は訪問先の確定座標ではありません。
        </p>
        <p>
          座標候補：
          <a href="https://www.digital.go.jp/policies/base_registry_address">
            デジタル庁 ABR
          </a>
          （PDL1.0）、
          <a href="https://www.geospatial.jp/ckan/dataset/houmusyouchizu-riyoukiyaku">
            法務省 登記所備付地図データ
          </a>
          。本リポジトリで abr-geocoder により加工。
        </p>
        <p>
          自治体照合：
          <a href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html">
            国土交通省 N03 2026年版
          </a>
          （CC BY 4.0）を本リポジトリで加工。位置の正しさを保証しません。
        </p>
        <p>
          深谷テラスパークの建物代表点：
          <a href="https://www.geospatial.jp/ckan/dataset/_-6-2024">
            深谷市「令和6年(2024)航空写真（ライト版）」2203
          </a>
          （CC-BY、版の明示なし）をmanhole-card-mapが加工して作成。
          保存APIの登録値isopen=falseも保持しています。写真原本は配信していません。
        </p>
        <p>
          航空写真を用いた施設代表点：国土地理院「地理院タイル（全国最新写真）」を
          manhole-card-mapが加工して作成。
          <a href="https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html">
            PDL1.0・国土地理院コンテンツ利用規約
          </a>
          に基づく出典・加工表示です。今回採用した写真は基本測量成果以外の利用区分。
          国土地理院による施設同定・承認ではありません。
        </p>
        <p>
          ORIGAMIプラザ・桐生市役所の建物代表点：
          <a href="https://maps.gsi.go.jp/development/ichiran.html">
            国土地理院「地理院タイル（全国最新写真）」
          </a>
          （PDL1.0）。上三川町基本設計概要／桐生市庁舎駐車場案内図の施設配置を、
          写真上の既存地物に基づいてmanhole-card-mapが独自に位置合わせし、建物代表点を作成。
          ORIGAMIは2010年4月～5月のオルソ画像、桐生は2020年5月～8月の民有林空中写真を使用。
          写真の旧建物を現在の新棟と同定したものではなく、国土地理院・自治体が測量、同定又は承認した座標ではありません。
          写真・図面原本は配信していません。
        </p>
        <p>
          背景地図は通信が必要です。オフライン保存の対象はカードの一覧・詳細です。
        </p>
        <p className="legend">
          <span>● 蓋</span>
          <span>■ 配布場所</span>
          <span className="active">● 配布中</span>
          <span className="upcoming">● 開始前</span>
          <span className="suspended">● 一時中止</span>
          <span className="ended">● 終了</span>
          <span className="unknown">● 要確認</span>
        </p>
      </div>
    </details>
  );
}
