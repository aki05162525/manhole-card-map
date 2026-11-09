import { expect, test } from "vitest";
import { INDEXNOW_KEY, indexNowPayload } from "./indexnow.mjs";

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
