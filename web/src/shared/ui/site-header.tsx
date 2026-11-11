import { Info } from "lucide-react";
import { AccountLink } from "./account-link";
import { Logo, Wordmark } from "./logo";
import { SiteMenu } from "./site-menu";
import "./site-header.css";

export function SiteHeader({
  current,
}: {
  current?: "cards" | "about" | "account" | "friends" | undefined;
}) {
  return (
    <header className="site-header" data-current={current}>
      <div className="site-header-inner">
        <a className="site-brand" href="/" aria-label="マンホール手帳 地図へ">
          <Logo /> <Wordmark />
        </a>
        {/* Wide bands list the links; narrow ones show only the menu. The
            stylesheet removes the other from the accessibility tree. */}
        <nav aria-label="メインナビゲーション">
          <div className="site-nav-links">
            <a href="/">地図</a>
            <a
              href="/cards"
              aria-current={current === "cards" ? "page" : undefined}
            >
              一覧
            </a>
            {import.meta.env.VITE_ACCOUNTS_ENABLED === "true" && (
              <>
                <a
                  href="/friends"
                  aria-current={current === "friends" ? "page" : undefined}
                >
                  フレンド
                </a>
                <AccountLink current={current === "account"} />
              </>
            )}
            <a
              className="site-about-link"
              href="/about"
              aria-current={current === "about" ? "page" : undefined}
              aria-label="このサイトについて"
            >
              <Info aria-hidden="true" size={20} />
            </a>
          </div>
          <SiteMenu current={current} landmark={false} />
        </nav>
      </div>
    </header>
  );
}
