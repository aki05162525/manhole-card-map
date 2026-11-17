import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InviteSection } from "./invite-section";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("says it has copied on the button, then offers the copy again", async () => {
  vi.useFakeTimers();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async () => {} },
  });
  render(
    <InviteSection
      invite={{ url: "https://example.test/friends/invite#t=a" }}
      busy={false}
      run={(action) => action()}
      onCopied={() => {}}
      onReplace={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "招待リンクをコピー" }));
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(screen.getByRole("button", { name: "コピーしました" })).toBeTruthy();
  await act(() => vi.advanceTimersByTimeAsync(2000));
  expect(
    screen.getByRole("button", { name: "招待リンクをコピー" }),
  ).toBeTruthy();
});
