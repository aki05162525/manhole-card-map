import { SiteHeader } from "../../shared/ui/site-header";

// PR-7. Applicable laws are not asserted here (PR-8).
export function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className="static-page">
        <h1>規約とプライバシーポリシー</h1>
        <p>
          マンホール手帳のアカウント機能（受け取り記録とフレンド）を使うときの決まりと、預かるデータの扱いです。地図と一覧を見るだけなら、アカウントは要りません。
        </p>

        <section aria-labelledby="stored">
          <h2 id="stored">保存するデータ</h2>
          <ul>
            <li>表示名</li>
            <li>
              パスキーの公開鍵と識別子、パスキーの名前、登録した日時と最後に使った日時。指紋・顔・画面ロックの情報は端末から出ず、受け取りません。
            </li>
            <li>
              回復コードとログイン状態の値をハッシュに変えたもの。回復コードそのものは保存しません。
            </li>
            <li>受け取り記録（カード番号、受け取った日付、メモ）</li>
            <li>フレンド関係、フレンド申請、ブロック、招待リンク</li>
            <li>乱用を防ぐために数える、操作の日時と回数</li>
          </ul>
          <p>
            メールアドレス、電話番号、位置情報、IPアドレス、端末の情報はデータベースに保存しません。IPアドレスは、短い時間の操作回数の制限を判断する間だけ使います。
          </p>
        </section>

        <section aria-labelledby="purpose">
          <h2 id="purpose">使い道</h2>
          <p>
            ログイン、受け取り記録の表示、フレンドへの公開、乱用の防止に使います。それ以外の目的には使いません。広告や解析のツールは入れていません。
          </p>
        </section>

        <section aria-labelledby="friends">
          <h2 id="friends">フレンドに見えるもの</h2>
          <p>
            フレンドになった相手には、表示名、受け取った枚数、どのカードを受け取ったか、受け取った日付、受け取り済みの地図が見えます。承認すると、承認より前の記録も見えます。
          </p>
          <p>
            メモ、パスキー、回復コードは誰にも見せません。全体への公開や、プロフィールのURLはありません。
          </p>
          <p>
            ブロックしても相手には知らせません。申請した人には、送った申請がどうなったかを表示しません。
          </p>
        </section>

        <section aria-labelledby="where">
          <h2 id="where">保存先</h2>
          <p>
            データは Cloudflare（Workers と
            D1）に保存し、そこで処理します。日本国外のデータセンターで保存・処理されることがあります。
          </p>
        </section>

        <section aria-labelledby="logs">
          <h2 id="logs">ログ</h2>
          <p>
            アクセスごとに、操作の種類、結果、処理時間、エラーの種類、内部のユーザーIDを記録します。送られた内容、Cookie、表示名、メモ、回復コード、URLの全体は記録しません。このログは3日で消えます。Cloudflare
            が独自に持つ記録は、Cloudflare の方針に従います。
          </p>
        </section>

        <section aria-labelledby="delete">
          <h2 id="delete">削除とバックアップ</h2>
          <p>
            アカウントを削除すると、受け取り記録、フレンド関係、パスキー、回復コードをすぐに消します。障害に備えたバックアップには、削除のあとも最長30日（いまの契約では7日）残り、その後消えます。
          </p>
          <p>
            障害でバックアップから戻したときは、削除したアカウントやパスキー、解除・ブロックしたフレンド関係が戻らないように処理します。このとき、すべてのログインと回復コードを無効にします。パスキーでログインし直し、回復コードを再発行してください。戻した時点より後の記録は失われることがあります。
          </p>
        </section>

        <section aria-labelledby="recovery">
          <h2 id="recovery">パスキーと回復コード</h2>
          <p>
            パスキーと回復コードを両方失うと、アカウントを復旧できません。運営者も復旧できません。
          </p>
          <p>
            回復コードは登録したときと再発行したときに一度だけ表示します。紙やパスワード管理ツールなど、端末の外に控えてください。人に見せないでください。1つのコードは1回だけ使えます。漏れたおそれがあれば、アカウントの画面から再発行してください。
          </p>
        </section>

        <section aria-labelledby="map">
          <h2 id="map">地図の配信元への送信</h2>
          <p>
            地図を表示するため、ブラウザーが CARTO（地図の配信元。地図のデータは
            OpenStreetMap）に直接接続します。このとき、IPアドレスや表示している範囲などが
            CARTO に送られます。アカウントの情報は送りません。
          </p>
        </section>

        <section aria-labelledby="changes">
          <h2 id="changes">変更と停止</h2>
          <p>
            この機能やこの文書は、予告なく変えたり止めたりすることがあります。止めている間も、アカウントの削除の依頼には応じます。
          </p>
        </section>

        <section aria-labelledby="contact">
          <h2 id="contact">問い合わせ</h2>
          <p>
            <a href="mailto:contact@manhole-techo.com">
              contact@manhole-techo.com
            </a>
          </p>
          <p>2026年11月10日 作成</p>
        </section>
      </main>
    </>
  );
}
