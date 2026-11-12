import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { api } from "../../features/account/account-api";
import { PasskeyList } from "./passkey-list";

afterEach(cleanup);

// Japanese dates whatever the device zone: the day turns at 15:00 UTC.
it("shows passkey dates as zero-padded Japanese calendar days", () => {
  render(
    <PasskeyList
      passkeys={[
        {
          id: "p1",
          label: "パスキー 1",
          createdAt: Date.UTC(2026, 0, 4, 14, 59, 59),
          lastUsedAt: null,
        },
        {
          id: "p2",
          label: "パスキー 2",
          createdAt: Date.UTC(2026, 0, 4, 15),
          lastUsedAt: Date.UTC(2026, 10, 10, 15),
        },
      ]}
      session={{ api, signal: new AbortController().signal }}
      busy={false}
      run={async () => {}}
      reload={async () => {}}
      onStatus={() => {}}
      onDelete={() => {}}
    />,
  );
  expect(screen.getByText("登録 2026/01/04・未使用")).toBeTruthy();
  expect(
    screen.getByText("登録 2026/01/05・最後の使用 2026/11/11"),
  ).toBeTruthy();
});
