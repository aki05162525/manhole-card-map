import { describe, expect, it } from "vitest";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { generateServiceWorker } from "./sw-generator.mjs";

const origin = "https://example.test";
function harness(manifest: Record<string, string>, fail = false) {
  const listeners: Record<string, (e: any) => void> = {};
  const stores = new Map<string, Map<string, Response>>();
  const key = (r: any) =>
    new URL(typeof r === "string" ? r : r.url, origin).href;
  const caches = {
    keys: async () => [...stores.keys()],
    delete: async (n: string) => stores.delete(n),
    open: async (n: string) => {
      if (!stores.has(n)) stores.set(n, new Map());
      const s = stores.get(n)!;
      return {
        addAll: async (files: string[]) => {
          for (const f of files) {
            requests.push({ url: f, options: { cache: "default" } });
            if (fail) throw Error("offline");
            s.set(key(f), new Response("new"));
          }
        },
        put: async (r: any, v: Response) => s.set(key(r), v.clone()),
        match: async (r: any) => s.get(key(r))?.clone(),
        keys: async () => [...s.keys()].map((url) => new Request(url)),
      };
    },
  };
  const requests: any[] = [];
  let skipped = false;
  const self = {
    location: { origin },
    registration: {
      get active() {
        return stores.has("prototype-old")
          ? {
              postMessage: (_: unknown, ports: MessagePort[]) =>
                ports[0].postMessage({ version: "prototype-old", ready: true }),
            }
          : null;
      },
    },
    addEventListener: (n: string, fn: any) => (listeners[n] = fn),
    skipWaiting: async () => {
      skipped = true;
    },
    clients: {
      claim: async () => {},
      matchAll: async () => [{ id: "old-tab" }],
    },
  };
  const restart = () =>
    vm.runInNewContext(generateServiceWorker("prototype-new", manifest), {
      self,
      MessageChannel,
      setTimeout,
      clearTimeout,
      location: self.location,
      caches,
      URL,
      Response,
      Request,
      crypto: webcrypto,
      fetch: async (url: string, options: any) => {
        requests.push({ url, options });
        if (fail) throw Error("offline");
        return new Response("new");
      },
    });
  restart();
  return {
    restart,
    caches,
    stores,
    requests,
    skipped: () => skipped,
    dispatch: async (type: string, event: any = {}) => {
      let result: any;
      listeners[type]({
        ...event,
        waitUntil: (p: any) => (result = p),
        respondWith: (p: any) => (result = p),
      });
      return await result;
    },
  };
}
const digest =
  "11507a0e2f5e69d5dfa40a62a1bd7b6ee57e6bcd85c67c9b8431b36fff21c437";
describe("atomic offline generations", () => {
  it("bypasses HTTP cache and waits for explicit activation", async () => {
    const h = harness({ "/index.html": digest });
    await h.dispatch("install");
    expect(h.requests[0].options.cache).toBe("no-store");
    expect(h.skipped()).toBe(false);
    await h.dispatch("message", { data: { type: "activate" } });
    expect(h.skipped()).toBe(true);
  });
  it.each([true, false])(
    "failed download/hash keeps the old offline generation (%s)",
    async (fail) => {
      const h = harness(
        { "/index.html": digest, "/data/full.json": "wrong" },
        fail,
      );
      await (
        await h.caches.open("prototype-old")
      ).put("/index.html", new Response("old"));
      await expect(h.dispatch("install")).rejects.toThrow();
      expect(
        await (await (
          await h.caches.open("prototype-old")
        ).match("/index.html"))!.text(),
      ).toBe("old");
      expect(h.stores.has("prototype-new")).toBe(false);
    },
  );
  it("pins old tabs across activation and worker restart, switches only on navigation", async () => {
    const h = harness({
      "/index.html": digest,
      "/data/full.json": digest,
      "/data/pins.json": digest,
      "/data/details.json": digest,
    });
    const old = await h.caches.open("prototype-old");
    for (const path of [
      "/index.html",
      "/data/full.json",
      "/data/pins.json",
      "/data/details.json",
    ])
      await old.put(path, new Response("old"));
    // A failed legacy installation leaves a newer but empty cache behind.
    await h.caches.open("prototype-failed");
    await h.dispatch("install");
    expect(h.skipped()).toBe(true); // Legacy UI cannot send an activation message.
    await h.dispatch("activate");
    h.restart();
    for (const path of ["full", "pins", "details"]) {
      const response = await h.dispatch("fetch", {
        clientId: "old-tab",
        request: { url: `${origin}/data/${path}.json?test=1`, mode: "cors" },
      });
      expect(await response.text()).toBe("old");
    }
    expect(h.stores.has("prototype-old")).toBe(true);
    const response = await h.dispatch("fetch", {
      clientId: "old-tab",
      resultingClientId: "new-tab",
      request: { url: `${origin}/`, mode: "navigate" },
    });
    expect(await response.text()).toBe("new");
    expect(
      await (
        await h.dispatch("fetch", {
          clientId: "new-tab",
          request: { url: `${origin}/data/details.json`, mode: "cors" },
        })
      ).text(),
    ).toBe("new");
  });
  it("keeps protocol-aware updates waiting and reports the actual tab version", async () => {
    const h = harness({ "/index.html": digest });
    await (
      await h.caches.open("prototype-old")
    ).put("/index.html", new Response("old"));
    await (
      await h.caches.open("manhole-offline-protocol-v1")
    ).put("/active", new Response("prototype-old"));
    await h.dispatch("install");
    expect(h.skipped()).toBe(false);
    await h.dispatch("activate");
    let status: any;
    await h.dispatch("message", {
      data: { type: "status" },
      source: { id: "old-tab" },
      ports: [{ postMessage: (value: any) => (status = value) }],
    });
    expect(status).toMatchObject({
      ready: true,
      version: "prototype-old",
      activeVersion: "prototype-new",
    });
  });
  it("does not fill missing generation data from the network", async () => {
    const h = harness({ "/data/full.json": digest });
    await h.dispatch("install");
    h.stores.get("prototype-new")!.delete(`${origin}/data/full.json`);
    const r = await h.dispatch("fetch", {
      clientId: "tab",
      request: { url: `${origin}/data/full.json`, mode: "cors" },
    });
    expect(r.status).toBe(503);
  });
});
