import { readFileSync } from "node:fs";
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
  expect(html).not.toContain("/account.html");
});

it("sizes its own boxes and keeps 44px targets above the page content", () => {
  const css = readFileSync(new URL("./site-menu.css", import.meta.url), "utf8");
  expect(css).toMatch(/\.site-menu,\s*\.site-menu \*\s*\{\s*box-sizing/);
  expect(css).toMatch(/line-height: 1\.5/);
  expect(css.match(/min-height: 44px/g)?.length).toBeGreaterThanOrEqual(2);
  expect(css).toContain("min-width: 44px");
  // Without the top layer the panel must still clear the map bar (30) and
  // the full detail sheet (40, 41).
  expect(css).toMatch(/\.is-open\s*\{[^}]*z-index: 50/);
});
