import { lazy, Suspense, type ComponentProps } from "react";
import { useRecords } from "./records-context";
import { RecordsProvider } from "./records-provider";
import {
  RecordFilter as Filter,
  RecordBadge as Badge,
} from "./record-controls";
import { RecordEditor as Editor } from "./record-editor";

// The flag at each use site removes these imports from disabled builds.
// CSS is a side effect, so it has its own conditional import boundary.
const Styles = /* @__PURE__ */ lazy(() => import("./records-feature"));

export function RecordsBoundary(props: ComponentProps<typeof RecordsProvider>) {
  const signedIn =
    import.meta.env.VITE_ACCOUNTS_ENABLED === "true" &&
    document.cookie.split(";").some((part) => part.trim() === "signed_in=1");
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
export function RecordFilter(props: ComponentProps<typeof Filter>) {
  const { phase } = /* @__PURE__ */ useRecords();
  return import.meta.env.VITE_ACCOUNTS_ENABLED === "true" &&
    phase !== "signed-out" ? (
    <Filter {...props} />
  ) : null;
}
export function RecordBadge(props: ComponentProps<typeof Badge>) {
  const { phase } = /* @__PURE__ */ useRecords();
  return import.meta.env.VITE_ACCOUNTS_ENABLED === "true" &&
    phase !== "signed-out" ? (
    <Badge {...props} />
  ) : null;
}
export function RecordEditor(props: ComponentProps<typeof Editor>) {
  const { phase } = /* @__PURE__ */ useRecords();
  return import.meta.env.VITE_ACCOUNTS_ENABLED === "true" &&
    phase !== "signed-out" ? (
    <Editor {...props} />
  ) : null;
}
