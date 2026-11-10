import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { InviteSection } from "./invite-section";

afterEach(cleanup);

// Japanese time whatever the device zone: the day turns at 15:00 UTC.
it.each([
  [Date.UTC(2026, 0, 4, 14, 59, 59), "2026/1/4 23:59（日本時間）"],
  [Date.UTC(2026, 0, 4, 15), "2026/1/5 00:00（日本時間）"],
  [Date.UTC(2026, 10, 10, 3, 5), "2026/11/10 12:05（日本時間）"],
])("shows when the invite expires in Japanese time", (expiresAt, text) => {
  render(
    <InviteSection
      invite={{ expiresAt }}
      busy={false}
      run={async () => {}}
      onCopied={() => {}}
      onCreate={() => {}}
    />,
  );
  const time = screen.getByText(text);
  expect(time.getAttribute("datetime")).toBe(new Date(expiresAt).toISOString());
});
