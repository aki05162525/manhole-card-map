import { Logo } from "../../shared/ui/logo";
import { SiteHeader } from "../../shared/ui/site-header";

export function NotFoundPage() {
  return (
    <>
      <SiteHeader />
      <main className="not-found-page">
        <Logo size={96} incomplete />
        <p className="not-found-code">404</p>
        <h1>ページが見つかりません</h1>
        <p>URLが変わったか、ページが削除された可能性があります。</p>
        <nav className="not-found-actions" aria-label="カードを探す">
          <a href="/">地図へ</a>
          <a href="/cards">一覧へ</a>
        </nav>
      </main>
    </>
  );
}
