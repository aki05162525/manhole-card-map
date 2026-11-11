import { lazy, Suspense, type ComponentProps, type ReactNode } from "react";
import { signedIn as hasSession } from "../../shared/browser/signed-in";
import { useRecords } from "./records-context";
import { RecordsProvider } from "./records-provider";
import {
  RecordFilter as Filter,
  RecordBadge as Badge,
  RecordAction as Action,
} from "./record-controls";
import { RecordEditor as Editor } from "./record-editor";

const accountHref = () =>
  typeof location === "undefined"
    ? "/account"
    : `/account?${new URLSearchParams({ returnTo: location.pathname + location.search })}`;

// The flag at each use site removes these imports from disabled builds.
// CSS is a side effect, so it has its own conditional import boundary.
const Styles = /* @__PURE__ */ lazy(() => import("./records-feature"));

export function RecordsBoundary(props: ComponentProps<typeof RecordsProvider>) {
  const signedIn =
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true" && hasSession();
  return signedIn ? (
    <Suspense fallback={null}>
      <Styles>
        <RecordsProvider {...props} />
      </Styles>
    </Suspense>
  ) : (
    props.children
  );
}
/** Private controls render only while a session is known. */
function SignedIn({ children }: { children: ReactNode }) {
  return useRecords().phase !== "signed-out" ? children : null;
}
export function RecordFilter(props: ComponentProps<typeof Filter>) {
  return import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? (
    <SignedIn>
      <Filter {...props} />
    </SignedIn>
  ) : null;
}
export function RecordBadge(props: ComponentProps<typeof Badge>) {
  return import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? (
    <SignedIn>
      <Badge {...props} />
    </SignedIn>
  ) : null;
}
/** Without a session, the same place offers to sign in and come back here. */
export function RecordAction(props: ComponentProps<typeof Action>) {
  const signedOut = useRecords().phase === "signed-out";
  if (import.meta.env.VITE_ACCOUNTS_ENABLED !== "true") return null;
  return signedOut ? (
    <a
      className="detail-record-sign-in"
      href={accountHref()}
      // The map rewrites its URL without rendering; link to where it is now.
      onClick={(event) => (event.currentTarget.href = accountHref())}
    >
      ログインして記録
    </a>
  ) : (
    <Action {...props} />
  );
}
export function RecordEditor(props: ComponentProps<typeof Editor>) {
  return import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? (
    <SignedIn>
      <Editor {...props} />
    </SignedIn>
  ) : null;
}
