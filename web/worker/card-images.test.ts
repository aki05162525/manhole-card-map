import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { startWorker } from "./test-harness";

type Running = Awaited<ReturnType<typeof startWorker>>;
type Store = { put(key: string, value: ArrayBuffer): Promise<void> };

const key = "14-100-B001-0123456789abcdef.webp";
// RIFF....WEBP and a few bytes: distinct content to compare.
const bytes = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2, 3,
]);

describe("card images from KV", () => {
  let running: Running;
  beforeAll(async () => {
    running = await startWorker();
    // The KV binding as the tests write it; the Worker itself only reads.
    const env = await running.harness
      .getWorker<{ CARD_IMAGES: Store }>()
      .getEnv();
    await env.CARD_IMAGES.put(key, bytes.buffer);
    // Stored, but not a name the Worker ever serves.
    await env.CARD_IMAGES.put("notes.txt", bytes.buffer);
  });
  afterAll(() => running.close());

  test("serves a stored image for a year, unchanged", async () => {
    const response = await running.harness.fetch(`/card-images/${key}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    // Other sites may not embed the permitted image.
    expect(response.headers.get("cross-origin-resource-policy")).toBe(
      "same-origin",
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });
  test("answers HEAD without a body", async () => {
    const response = await running.harness.fetch(`/card-images/${key}`, {
      method: "HEAD",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });
  test.each([
    "14-100-B001-fedcba9876543210.webp",
    "notes.txt",
    "14-100-B001.webp",
    "14-100-B001-0123456789ABCDEF.webp",
    "..%2Fnotes.txt",
    `${key}/x`,
    "",
  ])("answers an unknown or malformed key %j with 404", async (name) => {
    const response = await running.harness.fetch(`/card-images/${name}`);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  test("refuses other methods", async () => {
    const response = await running.harness.fetch(`/card-images/${key}`, {
      method: "POST",
    });
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
  });
});

describe("card images without the KV binding", () => {
  let running: Running;
  beforeAll(async () => {
    running = await startWorker({ dev: true });
  });
  afterAll(() => running.close());

  test("answers 404", async () => {
    const response = await running.harness.fetch(`/card-images/${key}`);
    expect(response.status).toBe(404);
  });
});
