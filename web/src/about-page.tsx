import { Clock, MapPin, Navigation, Search } from "lucide-react";
import { AUTHOR, credits } from "./about-credits";

function CreditList({ group }: { group: string }) {
  return (
    <ul className="credit-list">
      {credits
        .filter((credit) => credit.group === group)
        .map((credit) => (
          <li key={credit.url}>
            <a href={credit.url}>{credit.name}</a>
            {credit.license && (
              <>
                （
                {credit.licenseUrl ? (
                  <a href={credit.licenseUrl}>{credit.license}</a>
                ) : (
                  credit.license
                )}
                ）
              </>
            )}
            {credit.note && <>。{credit.note}</>}
          </li>
        ))}
    </ul>
  );
}

export function AboutPage() {
  return (
    <main className="about-page">
      <nav aria-label="地図へ">
        <a href="/">地図に戻る</a>
      </nav>
      <header className="about-header">
        <span className="about-mark" aria-hidden="true">
          ◎
        </span>
        <h1>マンホール手帳</h1>
        <p>マンホールカードの配布施設を探す、非公式の無料地図です。</p>
      </header>
      <section className="about-card" aria-labelledby="features">
        <h2 id="features">できること</h2>
        <ul className="feature-grid">
          <li>
            <MapPin aria-hidden="true" />
            配布場所を地図で探す
          </li>
          <li>
            <Search aria-hidden="true" />
            地域やカード番号、施設名などで検索する
          </li>
          <li>
            <Clock aria-hidden="true" />
            配布時間などの詳細を確認する
          </li>
          <li>
            <Navigation aria-hidden="true" />
            Google マップで配布場所や蓋へ向かう
          </li>
        </ul>
      </section>
      <section className="about-card" aria-labelledby="usage">
        <h2 id="usage">ご利用にあたって</h2>
        <p>
          非公式の個人サイトです。下水道広報プラットホーム（GKP）や自治体とは関係がありません。
        </p>
        <p>
          在庫は確認していません。位置は建物の代表点で、正確性を保証しません。参考位置は訪問先の確定座標ではありません。
        </p>
        <p>
          データは各カードの詳細などに表示する基準日時点のものです。最新の配布状況や時間は、訪問前に公式情報を確認してください。
        </p>
      </section>
      <section className="about-card" aria-labelledby="contact">
        <h2 id="contact">お問い合わせ</h2>
        <p>
          掲載内容の修正・削除のご依頼やご質問は、
          <a href="mailto:contact@manhole-techo.com">
            contact@manhole-techo.com
          </a>
          までお知らせください。
        </p>
      </section>
      <section className="about-card" aria-labelledby="credits">
        <h2 id="credits">クレジット</h2>
        <h3>カード情報</h3>
        <p>
          <a href="https://www.gk-p.jp/mhcard/">
            下水道広報プラットホーム（GKP）の公開情報
          </a>
          をもとに作成しています。カード画像は使用していません。
        </p>
        <h3>配布場所の位置</h3>
        <p>
          配布場所の位置は、各施設の公式案内や公的データなどの公開情報をもとに独自に整理したものです。
        </p>
        <details>
          <summary>使用した公開データの一覧</summary>
          <h4>国・公的機関のデータ</h4>
          <ul>
            <li>
              「国土数値情報（市町村役場等及び公的集会施設データ）」（国土交通省）（
              <a href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-P05-2022.html">
                P05・2022年版
              </a>
              ）をもとに{AUTHOR}が作成。
              <a href="https://creativecommons.org/licenses/by/4.0/deed.ja">
                CC BY 4.0
              </a>
              。
            </li>
            <li>
              「最適化ベクトルタイル」（国土地理院）（
              <a href="https://github.com/gsi-cyberjapan/optimal_bvmap">
                配布元・利用方法
              </a>
              ）をもとに{AUTHOR}が作成。
              <a href="https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html">
                国土地理院コンテンツ利用規約（PDL1.0）
              </a>
              。
            </li>
            <li>
              「地理院タイル（全国最新写真）」（国土地理院）（
              <a href="https://maps.gsi.go.jp/development/ichiran.html#seamlessphoto">
                地理院タイル一覧
              </a>
              ）をもとに{AUTHOR}が作成。国土地理院コンテンツ利用規約（PDL1.0）。
            </li>
          </ul>
          <p>
            座標候補：
            <a href="https://www.digital.go.jp/policies/base_registry_address">
              デジタル庁 ABR
            </a>
            （PDL1.0）、
            <a href="https://www.geospatial.jp/ckan/dataset/houmusyouchizu-riyoukiyaku">
              法務省 登記所備付地図データ
            </a>
            。{AUTHOR}が加工して作成。
          </p>
          <p>
            自治体照合：
            <a href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html">
              国土交通省 N03 2026年版
            </a>
            （CC BY 4.0）を{AUTHOR}が加工して作成。
          </p>
          <h4>航空写真と施設配置図を用いた位置</h4>
          <p>
            深谷テラスパークの建物代表点：
            <a href="https://www.geospatial.jp/ckan/dataset/_-6-2024">
              深谷市「令和6年(2024)航空写真（ライト版）」2203
            </a>
            （CC-BY、版の明示なし）を{AUTHOR}が加工して作成。
          </p>
          <p>
            航空写真を用いた施設代表点：国土地理院「地理院タイル（全国最新写真）」を
            {AUTHOR}が加工して作成。
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
            写真上の既存地物に基づいて{AUTHOR}
            が独自に位置合わせし、建物代表点を作成。
            ORIGAMIは2010年4月～5月のオルソ画像、桐生は2020年5月～8月の民有林空中写真を使用。
            写真の旧建物を現在の新棟と同定したものではなく、国土地理院・自治体が測量、同定又は承認した座標ではありません。
          </p>
          <h4>自治体などの公開データ</h4>
          <p>
            以下のデータから対象施設を抽出し、座標の項目を組み替えるなどして
            {AUTHOR}
            が作成しました。原データの提供者が本サイトの位置を承認したものではありません。
          </p>
          <p>
            CC BY 4.0の条件は
            <a href="https://creativecommons.org/licenses/by/4.0/deed.ja">
              表示4.0国際ライセンス
            </a>
            を参照してください。版の明示がないものは各配布元の表記を残しています。
          </p>
          <h4>BODIKで公開されている自治体データ</h4>
          <CreditList group="BODIKで公開されている自治体データ" />
          <h4>静岡県オープンデータ</h4>
          <CreditList group="静岡県オープンデータ" />
          <h4>沖縄県地図情報システム</h4>
          <p>
            <a href="https://gis.pref.okinawa.jp/OpenData/">
              沖縄県GISオープンデータ
            </a>
            の市町村情報、図書館・文化施設、指定一般避難所、津波避難ビルを加工しています。
            <a href="https://creativecommons.org/licenses/by/4.0/deed.ja">
              CC BY 4.0
            </a>
            ・
            <a href="https://www.pref.okinawa.lg.jp/_res/projects/default_project/_page_/001/016/461/20230222opendata_rule.pdf">
              沖縄県オープンデータ利用規約
            </a>
            。
          </p>
          <h4>東京都・その他の自治体</h4>
          <CreditList group="東京都・その他の自治体" />
        </details>
        <h3>背景地図</h3>
        <p>
          © <a href="https://carto.com/attributions">CARTO</a>、©
          <a href="https://www.openstreetmap.org/copyright">
            OpenStreetMap contributors
          </a>
          。
        </p>
        <h3>ソフトウェア</h3>
        <p>
          <a href="https://maplibre.org/">MapLibre</a> と
          <a href="https://mapcn.dev/">mapcn</a> を使用しています。
          <a href="/MAPCN_LICENSE.txt">mapcn のライセンス（MIT）</a>。
          フォントは
          <a href="https://fonts.google.com/noto/specimen/Noto+Sans+JP">
            Noto Sans JP
          </a>
          （<a href="/NOTO_SANS_JP_LICENSE.txt">SIL OFL 1.1</a>
          ）を使用しています。
        </p>
      </section>
      <nav aria-label="地図へ戻る">
        <a href="/">地図に戻る</a>
      </nav>
    </main>
  );
}
