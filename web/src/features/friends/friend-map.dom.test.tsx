import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import FriendMap from "./friend-map";
import {
  RecordsContext,
  inactive,
  useRecords,
} from "../records/records-context";
import { RecordBadge, RecordFilter } from "../records/record-controls";
import { RecordEditor } from "../records/record-editor";
function Probe() {
  const records = useRecords();
  return (
    <>
      <RecordFilter showFriend />
      <span>{[...(records.records?.keys() ?? [])].join(",")}</span>
      <RecordBadge ids={["friend-card"]} />
      <RecordEditor cardId="friend-card" />
    </>
  );
}
beforeEach(() => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=1; Path=/";
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  document.cookie = "signed_in=; Max-Age=0; Path=/";
});
it("shows unavailable for 404 without loading personal records", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 404 })),
  );
  render(
    <FriendMap friendId="f1" ready aliases={{}}>
      <Probe />
    </FriendMap>,
  );
  await screen.findByText("表示できません");
  expect(screen.queryByText("未回収")).toBeNull();
  expect(fetch).not.toHaveBeenCalledWith("/api/me/records", expect.anything());
});
it("replaces personal records and exposes only friend dates without editing", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            displayName: "はな",
            count: 1,
            records: [{ cardId: "old", receivedOn: "2026-11-01" }],
          }),
        ),
    ),
  );
  render(
    <RecordsContext
      value={{
        ...inactive,
        phase: "ready",
        records: new Map([["mine", { cardId: "mine", receivedOn: null }]]),
      }}
    >
      <FriendMap friendId="f1" ready aliases={{ old: "friend-card" }}>
        <Probe />
      </FriendMap>
    </RecordsContext>,
  );
  await screen.findByText("はなさんの回収マップ");
  await screen.findByText("friend-card");
  expect(screen.queryByText("mine")).toBeNull();
  // Opened to see what the friend has, so it starts on the received cards.
  expect(
    screen.getByRole<HTMLInputElement>("radio", { name: "回収済み" }).checked,
  ).toBe(true);
  expect(screen.getAllByText("回収済み").length).toBeGreaterThan(0);
  expect(screen.getByText("2026年11月1日")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button", { name: "回収した" })).toBeNull();
  expect(screen.getByRole("link", { name: "戻る" }).getAttribute("href")).toBe(
    "/friends",
  );
  expect(vi.mocked(fetch).mock.calls.map(([path]) => path)).toEqual([
    "/api/friends/f1/records",
  ]);
});
it("does not request private data without the cookie", async () => {
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  vi.stubGlobal("fetch", vi.fn());
  render(
    <FriendMap friendId="f1" ready>
      <Probe />
    </FriendMap>,
  );
  expect(screen.getByText("表示できません")).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});
