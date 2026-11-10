import { lazy, Suspense, type ComponentProps, type ReactNode } from "react";
import { signedIn as hasSession } from "../../shared/browser/signed-in";
import { useRecords } from "./records-context";
import { RecordsProvider } from "./records-provider";
import {
  RecordFilter as Filter,
  RecordBadge as Badge,
  RecordJump as Jump,
} from "./record-controls";
import { RecordEditor as Editor } from "./record-editor";

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
export function RecordJump(props: ComponentProps<typeof Jump>) {
  return import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? (
    <SignedIn>
      <Jump {...props} />
    </SignedIn>
  ) : null;
}
export function RecordEditor(props: ComponentProps<typeof Editor>) {
  return import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? (
    <SignedIn>
      <Editor {...props} />
    </SignedIn>
  ) : null;
}
