import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { useSignedIn } from "../../session/signed-in";
import { accountHref } from "../../session/account-url";
import { useRecords } from "./records-context";
import { RecordsProvider } from "./records-provider";
import {
  RecordFilter as Filter,
  RecordBadge as Badge,
  RecordAction as Action,
} from "./record-controls";
import { RecordEditor as Editor } from "./record-editor";

const hereHref = () => accountHref(location.pathname + location.search);

// The flag at each use site removes these imports from disabled builds.
// CSS is a side effect, so it has its own conditional import boundary.
const load = () => import("./records-feature");
const Styles = /* @__PURE__ */ lazy(load);
/** The controls' styles, for an entry to wait for before its first render. */
export const preloadRecords = async () => {
  await load();
};

type Gate = { ready: boolean; aliases?: Record<string, string> | undefined };
const HostReport = /* @__PURE__ */ createContext<((gate: Gate) => void) | null>(
  null,
);

/**
 * One provider for every screen of a document that switches screens, so a
 * record saved on one shows on the other and the records load once. Each
 * screen's boundary reports when its content has drawn; the first report
 * lets the records load. The provider stays mounted signed out too and
 * follows a sign-in or logout itself: the screens below must not remount.
 * The styles of its controls load beside it once a session is known, in a
 * boundary of their own: the screens never wait for them.
 */
export function RecordsHost({ children }: { children: ReactNode }) {
  const signedIn = useSignedIn();
  const [gate, setGate] = useState<Gate>({ ready: false });
  const report = useCallback(
    ({ ready, aliases }: Gate) =>
      setGate((gate) => ({
        ready: gate.ready || ready,
        aliases: aliases ?? gate.aliases,
      })),
    [],
  );
  return (
    <HostReport value={report}>
      {signedIn && (
        <Suspense fallback={null}>
          <Styles>{null}</Styles>
        </Suspense>
      )}
      <RecordsProvider ready={gate.ready} aliases={gate.aliases}>
        {children}
      </RecordsProvider>
    </HostReport>
  );
}
/** A screen's report to the `RecordsHost` above it. */
export function RecordsBoundary({
  ready,
  aliases,
  children,
}: ComponentProps<typeof RecordsProvider>) {
  const report = useContext(HostReport);
  useEffect(() => report?.({ ready, aliases }), [report, ready, aliases]);
  return children;
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
      className="record-stamp"
      href={hereHref()}
      // The map rewrites its URL without rendering; link to where it is now.
      onClick={(event) => (event.currentTarget.href = hereHref())}
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
