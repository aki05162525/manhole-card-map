import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AboutLid } from "./about-lid";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("waits for fonts and visibility before opening the notebook", async () => {
  let reveal: (entries: { isIntersecting: boolean }[]) => void = () => {};
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof reveal) {
        reveal = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  let fontsLoaded: () => void = () => {};
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: new Promise<void>((resolve) => (fontsLoaded = resolve)) },
  });
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
    callback();
    return 0;
  });
  const { container } = render(<AboutLid />);
  const lid = container.querySelector(".about-lid")!;
  expect(lid.classList.contains("is-playing")).toBe(false);
  await act(async () => fontsLoaded());
  expect(lid.classList.contains("is-playing")).toBe(false);
  act(() => reveal([{ isIntersecting: true }]));
  expect(lid.classList.contains("is-playing")).toBe(true);
});

it("still finishes the drawing if the readiness signals never arrive", () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { ready: new Promise<void>(() => {}) },
  });
  const { container } = render(<AboutLid />);
  act(() => {
    vi.advanceTimersByTime(3000);
  });
  expect(
    container.querySelector(".about-lid")!.classList.contains("is-playing"),
  ).toBe(true);
});
