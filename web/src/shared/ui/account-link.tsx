import { useSignedIn } from "../browser/signed-in";

// The cookie only says which label to show; nothing is fetched (PF-1).
// Static pages are rendered without a document and get no entry. The label
// follows a sign-in or logout on another screen of the same document.
export function useAccountLabel() {
  const signedIn = useSignedIn();
  return typeof document === "undefined"
    ? null
    : signedIn
      ? "アカウント"
      : "ログイン";
}

export function AccountLink({ current }: { current?: boolean }) {
  const label = useAccountLabel();
  if (!label) return null;
  return (
    <a
      className="account-link"
      href="/account"
      aria-current={current ? "page" : undefined}
    >
      {label}
    </a>
  );
}
