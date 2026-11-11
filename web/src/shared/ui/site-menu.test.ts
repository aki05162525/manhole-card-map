import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { SiteMenu } from "./site-menu";

afterEach(() => vi.unstubAllEnvs());

it("prerenders a script-free popover without the cookie-dependent account entry", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  const html = renderToStaticMarkup(createElement(SiteMenu));
  expect(html).toContain('popover="auto"');
  // React writes the attribute as popoverTarget; HTML ignores its case.
  expect(html.toLowerCase()).toContain("popovertarget=");
  expect(html).toContain('aria-label="メニュー"');
  expect(html).toContain('href="/friends"');
  expect(html).not.toContain("/account");
});
