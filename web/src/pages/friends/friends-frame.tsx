import type { ReactNode } from "react";
import { SiteHeader } from "../../shared/ui/site-header";

/** The header and `main` of the friends and invite pages. */
export function FriendsFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="account-page">{children}</main>
    </>
  );
}

// The pages test the build flag themselves, so a disabled build drops the
// code of their other branch.
export function FriendsUnavailable() {
  return <p>フレンド機能はまだ使えません。</p>;
}
