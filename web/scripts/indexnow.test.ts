import { expect, test } from "vitest";
import { INDEXNOW_KEY, indexNowPayload, submitIndexNow } from "./indexnow.mjs";

test("IndexNow payload lists same-host sitemap URLs with the hosted key", () => {
  const xml = `<?xml version="1.0"?><urlset>
    <url><loc>https://manhole-techo.com/</loc></url>
    <url><loc>https://manhole-techo.com/pref/tokyo/</loc></url>
    <url><loc>https://example.com/other</loc></url></urlset>`;
  expect(indexNowPayload(xml, "https://manhole-techo.com")).toEqual({
    host: "manhole-techo.com",
    key: INDEXNOW_KEY,
    keyLocation: `https://manhole-techo.com/${INDEXNOW_KEY}.txt`,
    urlList: [
      "https://manhole-techo.com/",
      "https://manhole-techo.com/pref/tokyo/",
    ],
  });
  expect(INDEXNOW_KEY).toMatch(/^[0-9a-f]{32}$/);
});

test("retries while the freshly deployed key is not yet accepted", async () => {
  const statuses = [403, 403, 200];
  const calls: string[] = [];
  const fake = async (url: string) => {
    calls.push(url);
    if (url.endsWith(".txt")) return new Response(INDEXNOW_KEY);
    if (url.endsWith("sitemap.xml"))
      return new Response(
        "<urlset><url><loc>https://manhole-techo.com/</loc></url></urlset>",
      );
    const status = statuses.shift();
    if (status === undefined)
      throw new Error("Unexpected extra IndexNow request");
    return new Response(null, { status });
  };
  await submitIndexNow("https://manhole-techo.com", {
    fetch: fake as typeof fetch,
    wait: async () => {},
  });
  expect(calls.filter((u) => u.includes("api.indexnow.org"))).toHaveLength(3);
});
