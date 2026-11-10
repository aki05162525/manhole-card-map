import { CircleUserRound } from "lucide-react";
import { signedIn } from "../browser/signed-in";

// The cookie only says which label to show; nothing is fetched (PF-1).
// Static pages are rendered without a document and get no entry.
export function AccountLink({
  current,
  icon,
}: {
  current?: boolean;
  icon?: boolean;
}) {
  if (typeof document === "undefined") return null;
  const label = signedIn() ? "アカウント" : "ログイン";
  return (
    <a
      className="account-link"
      href="/account.html"
      aria-current={current ? "page" : undefined}
      aria-label={icon ? label : undefined}
    >
      {icon ? <CircleUserRound aria-hidden="true" size={20} /> : label}
    </a>
  );
}
