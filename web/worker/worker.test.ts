import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { pages, startWorker } from "./test-harness";

type Running = Awaited<ReturnType<typeof startWorker>>;

// wrangler types its own Response; only the headers matter here.
const expectApiHeaders = (response: {
  headers: Pick<Headers, "get" | "has">;
}) => {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe("same-origin");
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(response.headers.has("access-control-allow-origin")).toBe(false);
};

// Static pages must behave exactly as before the Worker script existed.
const expectUnchangedAssets = (running: () => Running) => {
  test.each([
    ["/", pages["index.html"]],
    ["/cards", pages["cards.html"]],
  ])("serves %s from assets", async (path, body) => {
    const response = await running().harness.fetch(path);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(body);
  });
  test("keeps the static headers on pages", async () => {
    const response = await running().harness.fetch("/");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
  // One document switches between these screens and keeps the headers of
  // the one it opened with, so each carries the strictest (SE-1).
  test.each(["/", "/cards", "/friends", "/account", "/about"])(
    "protects %s as every screen of one document",
    async (path) => {
      const response = await running().harness.fetch(path);
      expect(response.status).toBe(200);
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("content-security-policy")).toContain(
        "frame-ancestors 'none'",
      );
    },
  );
  test("keeps the canonical redirect for .html", async () => {
    const response = await running().harness.fetch("/cards.html", {
      redirect: "manual",
    });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/cards");
  });
  test.each(["/__missing__", "/card/__missing__/", "/api", "/apix/health"])(
    "answers %s with the 404 page",
    async (path) => {
      const response = await running().harness.fetch(path);
      expect(response.status).toBe(404);
      expect(await response.text()).toBe(pages["404.html"]);
    },
  );
};

describe("production config with D1", () => {
  let running: Running;
  beforeAll(async () => {
    running = await startWorker();
  });
  afterAll(() => running.close());

  expectUnchangedAssets(() => running);
  test("reports health from the production D1 binding", async () => {
    const response = await running.harness.fetch("/api/health");
    expect(response.status).toBe(200);
    expectApiHeaders(response);
    expect(await response.json()).toEqual({ ok: true });
  });
});

describe("local config with D1", () => {
  let running: Running;
  beforeAll(async () => {
    running = await startWorker({ dev: true });
  });
  afterAll(() => running.close());

  expectUnchangedAssets(() => running);
  test("reports health after querying D1", async () => {
    const response = await running.harness.fetch("/api/health");
    expect(response.status).toBe(200);
    expectApiHeaders(response);
    expect(await response.json()).toEqual({ ok: true });
  });
  test("answers an unknown API path with a JSON 404", async () => {
    const response = await running.harness.fetch("/api/__missing__");
    expect(response.status).toBe(404);
    expectApiHeaders(response);
  });
  test("rejects an unsupported method without CORS", async () => {
    const response = await running.harness.fetch("/api/health", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    expectApiHeaders(response);
  });
});

describe("LINE in-app browser", () => {
  let running: Running;
  beforeAll(async () => {
    running = await startWorker();
  });
  afterAll(() => running.close());
  const line =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.0.0";
  const open = (path: string, userAgent = line) =>
    running.harness.fetch(path, {
      redirect: "manual",
      headers: { "User-Agent": userAgent },
    });

  // Passkeys do not work inside LINE, so pages ask it for the default browser.
  test.each([
    ["/", "/?openExternalBrowser=1"],
    ["/cards?q=%E6%9D%B1", "/cards?q=%E6%9D%B1&openExternalBrowser=1"],
  ])("sends %s to the default browser", async (path, target) => {
    const response = await open(path);
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname + location.search).toBe(target);
  });
  test("serves the page once LINE was asked, so it never loops", async () => {
    const response = await open("/?openExternalBrowser=1");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(pages["index.html"]);
  });
  test("leaves other browsers and the API alone", async () => {
    expect((await open("/", "Mozilla/5.0 Safari/605.1.15")).status).toBe(200);
    expect((await open("/api/health")).status).toBe(200);
  });
});

describe("emergency stop", () => {
  let running: Running;
  beforeAll(async () => {
    running = await startWorker({
      dev: true,
      secrets: { API_DISABLED: "1" },
    });
  });
  afterAll(() => running.close());

  test("answers every API path with 503", async () => {
    for (const path of ["/api/health", "/api/__missing__"]) {
      const response = await running.harness.fetch(path);
      expect(response.status).toBe(503);
      expectApiHeaders(response);
      expect(await response.json()).toEqual({ error: "api_disabled" });
    }
  });
  expectUnchangedAssets(() => running);
});
