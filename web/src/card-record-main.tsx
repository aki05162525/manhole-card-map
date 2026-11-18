import { onPageReturn, signedIn } from "./shared/browser/signed-in";

// The script of a generated card page (`src/pages/card/static-pages.tsx`). Signed
// out, the page keeps its sign-in link. A return from another tab or the
// back/forward cache may bring a session; only then does the record load.
const root = document.getElementById("card-record");
if (import.meta.env.VITE_ACCOUNTS_ENABLED === "true" && root) {
  let loading: Promise<void> | undefined;
  let stop = () => {};
  const start = () => {
    if (!root.isConnected || !signedIn()) return;
    loading ??= import("./pages/card/card-record")
      .then(async ({ mountCardRecord }) => {
        await mountCardRecord(root);
        // The mounted provider now follows sign-ins, sign-outs and user changes.
        stop();
      })
      .catch(() => {
        // Keep the HTML's link if the feature could not load; retry on return.
        loading = undefined;
      });
    return loading;
  };
  stop = onPageReturn(() => void start());
  await start();
}
