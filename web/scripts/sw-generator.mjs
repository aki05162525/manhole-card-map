// This function is serialized into a standalone worker; do not capture module state.
function workerRuntime(VERSION, MANIFEST) {
  const META = "manhole-offline-protocol-v1";
  const COMPLETE = "/__offline_complete__";
  const pinKey = (id) => "/__offline_client__/" + encodeURIComponent(id);
  const files = Object.keys(MANIFEST);
  const metadata = () => caches.open(META);
  const read = async (cache, key) => (await cache.match(key))?.text();
  const predecessorKey = "/predecessor/" + VERSION;
  const activeVersion = async () => {
    const active = self.registration.active;
    if (!active) return undefined;
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const finish = (error, version) => {
        clearTimeout(timer);
        channel.port1.close();
        channel.port2.close();
        if (error) reject(error);
        else resolve(version);
      };
      const timer = setTimeout(
        () => finish(Error("Active worker status timeout")),
        5000,
      );
      channel.port1.onmessage = ({ data }) => {
        const version = data?.activeVersion || data?.version;
        if (typeof version !== "string" || !version.startsWith("prototype-"))
          finish(Error("Invalid active worker version"));
        else finish(undefined, version);
      };
      try {
        active.postMessage({ type: "status" }, [channel.port2]);
      } catch (error) {
        finish(error);
      }
    });
  };
  self.addEventListener("install", (event) =>
    event.waitUntil(
      (async () => {
        const cache = await caches.open(VERSION);
        // A failed retry must not destroy an already complete, usable generation.
        if (await cache.match(COMPLETE)) return;
        try {
          for (const path of files) {
            const response = await fetch(path, {
              cache: "no-store",
              credentials: "same-origin",
              redirect: "error",
            });
            if (!response.ok) throw Error("Download failed: " + path);
            const bytes = await response.clone().arrayBuffer();
            const hash = [
              ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
            ]
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
            if (hash !== MANIFEST[path])
              throw Error("Deployment hash mismatch: " + path);
            await cache.put(path, response);
          }
          await cache.put(COMPLETE, new Response(JSON.stringify(files)));
          // v0 pages have no update action. Migrate once after verification so their
          // next ordinary reload can reach the new UI; activation still pins them.
          const meta = await metadata();
          const previous = await activeVersion();
          if (previous) await meta.put(predecessorKey, new Response(previous));
          if (!(await meta.match("/active")) && previous) {
            await self.skipWaiting();
          }
        } catch (error) {
          await caches.delete(VERSION);
          throw error;
        }
      })(),
    ),
  );
  self.addEventListener("activate", (event) =>
    event.waitUntil(
      (async () => {
        const meta = await metadata();
        const previous =
          (await read(meta, predecessorKey)) || (await read(meta, "/active"));
        // Persist pins: a worker may be stopped between any two fetches.
        if (previous && previous !== VERSION) {
          for (const client of await self.clients.matchAll({
            type: "all",
            includeUncontrolled: true,
          })) {
            if (!(await meta.match(pinKey(client.id))))
              await meta.put(pinKey(client.id), new Response(previous));
          }
        }
        await meta.put("/active", new Response(VERSION));
        // No claim: an uncontrolled first-load document must reload as a whole.
        // Retain old caches, including legacy caches, for open tabs and rollback.
      })(),
    ),
  );
  self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    if (
      url.origin !== self.location.origin ||
      (event.request.method && event.request.method !== "GET")
    )
      return;
    const navigation =
      event.request.mode === "navigate" &&
      ["/", "/index.html", "/legacy.html"].includes(url.pathname);
    const managed =
      url.pathname === "/legacy.html" ||
      files.includes(url.pathname) ||
      url.pathname.startsWith("/assets/") ||
      url.pathname.startsWith("/data/");
    if (!navigation && !managed) return;
    event.respondWith(
      (async () => {
        const meta = await metadata();
        let version = (await read(meta, pinKey(event.clientId))) || VERSION;
        let path = url.pathname;
        if (navigation) {
          version = VERSION;
          path =
            path === "/legacy.html" && files.includes(path)
              ? path
              : "/index.html";
        }
        if (event.resultingClientId)
          await meta.put(
            pinKey(event.resultingClientId),
            new Response(version),
          );
        const cache = await caches.open(version);
        return (
          (await cache.match(path)) ||
          new Response(
            "保存データを読み込めません。オンラインで再読み込みしてください。",
            { status: 503 },
          )
        );
      })(),
    );
  });
  self.addEventListener("message", (event) => {
    if (event.data?.type === "activate") {
      event.waitUntil(self.skipWaiting());
    } else if (event.data?.type === "status" && event.ports?.[0]) {
      event.waitUntil(
        (async () => {
          const meta = await metadata();
          const version =
            (await read(meta, pinKey(event.source?.id))) || VERSION;
          const cache = await caches.open(version);
          const saved = await read(cache, COMPLETE);
          const paths = saved ? JSON.parse(saved) : files; // Legacy status is conservative.
          const ready = (
            await Promise.all(paths.map((path) => cache.match(path)))
          ).every(Boolean);
          event.ports[0].postMessage({
            ready,
            version,
            activeVersion: VERSION,
            protocol: 1,
          });
        })(),
      );
    }
  });
}
export function generateServiceWorker(version, manifest) {
  return `(${workerRuntime.toString()})(${JSON.stringify(version)},${JSON.stringify(manifest)});\n`;
}
