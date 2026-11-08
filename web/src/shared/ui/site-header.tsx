import { Info } from "lucide-react";
import { Logo, Wordmark } from "./logo";
import "./site-header.css";

export function SiteHeader({ current }: { current: "cards" | "about" }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="site-brand" href="/" aria-label="マンホール手帳 地図へ">
          <Logo /> <Wordmark />
        </a>
        <nav aria-label="メインナビゲーション">
          <a href="/">地図</a>
          <a
            href="/cards.html"
            aria-current={current === "cards" ? "page" : undefined}
          >
            一覧
          </a>
          <a
            href="/about.html"
            aria-current={current === "about" ? "page" : undefined}
            aria-label="このサイトについて"
          >
            <Info aria-hidden="true" size={20} />
          </a>
        </nav>
      </div>
    </header>
  );
}
