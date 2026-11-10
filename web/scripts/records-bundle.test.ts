import { expect, it } from "vitest";
import { build } from "vite";

it.each([false, true])(
  "excludes records modules, listeners, styles and map badges when accounts=%s",
  async (enabled) => {
    const result = await build({
      mode: "fixture",
      logLevel: "silent",
      define: {
        "import.meta.env.VITE_ACCOUNTS_ENABLED": JSON.stringify(
          String(enabled),
        ),
      },
      build: { write: false },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap(
      (bundle) => ("output" in bundle ? bundle.output : []),
    );
    const js = outputs
      .filter((asset) => asset.type === "chunk")
      .map((asset) => asset.code)
      .join("\n");
    const css = outputs
      .filter(
        (asset) => asset.type === "asset" && asset.fileName.endsWith(".css"),
      )
      .map((asset) => (asset.type === "asset" ? String(asset.source) : ""))
      .join("\n");
    for (const marker of [
      "/api/me/records",
      "signed_in=",
      "signed-out",
      "-receipt",
      "/api/auth/",
    ])
      expect(js.includes(marker), marker).toBe(enabled);
    expect(css.includes(".record-editor")).toBe(enabled);
  },
  60_000,
);
