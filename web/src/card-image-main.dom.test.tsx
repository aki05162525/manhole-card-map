import { beforeEach, expect, it, vi } from "vitest";

const page = `<main><article class="card-page"><div class="card-lead"><figure class="card-figure"><img src="/card-images/x.webp" alt="カード"><figcaption>画像：合成テスト市</figcaption></figure><div class="card-summary">配布中</div></div></article></main>`;
beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = page;
});
const image = () => document.querySelector("img")!;
const shown = () => document.querySelector(".card-lead")!.innerHTML;

it("keeps an image that loads, with its credit", async () => {
  Object.defineProperties(image(), {
    complete: { value: true },
    naturalWidth: { value: 640 },
  });
  await import("./card-image-main");
  image().dispatchEvent(new Event("load"));
  expect(shown()).toContain("画像：合成テスト市");
});

it.each([
  ["fails after the script has run", false],
  ["had failed before the script ran", true],
])("removes the image and its frame when it %s", async (_name, already) => {
  Object.defineProperties(image(), {
    complete: { value: already },
    naturalWidth: { value: 0 },
  });
  const element = image();
  await import("./card-image-main");
  if (!already) {
    expect(document.querySelector("figure")).not.toBeNull();
    element.dispatchEvent(new Event("error"));
  }
  // What is left is the page of a card without an image.
  expect(shown()).toBe('<div class="card-summary">配布中</div>');
});
