import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { SiteHeader } from "./site-header";

afterEach(() => vi.unstubAllEnvs());

// The generated county and card pages are rendered without a document.
it("prerenders the links without the cookie-dependent account entry", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  const html = renderToStaticMarkup(createElement(SiteHeader));
  expect(html).toContain('href="/friends"');
  expect(html).not.toContain("/account");
});
