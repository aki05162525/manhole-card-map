import { signedIn } from "../browser/signed-in";

// The cookie only says which label to show; nothing is fetched (PF-1).
// Static pages are rendered without a document and get no entry.
export const accountLabel = () =>
  typeof document === "undefined"
    ? null
    : signedIn()
      ? "アカウント"
      : "ログイン";

export function AccountLink({ current }: { current?: boolean }) {
  const label = accountLabel();
  if (!label) return null;
  return (
    <a
      className="account-link"
      href="/account.html"
      aria-current={current ? "page" : undefined}
    >
      {label}
    </a>
  );
}
