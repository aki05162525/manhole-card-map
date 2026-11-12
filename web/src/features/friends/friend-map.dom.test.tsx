import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState, type ComponentProps } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import FriendMap, { type FriendRecords } from "./friend-map";
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
/** As the map holds it: the friend's records in place of the page's own. */
function Friend(props: Omit<ComponentProps<typeof FriendMap>, "onChange">) {
  const own = useRecords();
  const [shown, setShown] = useState<FriendRecords | null>(null);
  return (
    <>
      <FriendMap {...props} onChange={setShown} />
      <RecordsContext value={shown?.value ?? own}>
        <Probe />
      </RecordsContext>
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
  render(<Friend friendId="f1" ready aliases={{}} />);
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
      <Friend friendId="f1" ready aliases={{ old: "friend-card" }} />
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
  render(<Friend friendId="f1" ready />);
  expect(screen.getByText("表示できません")).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});

it("keeps a friend's records asked for by the user before off the map once another has signed in", async () => {
  let answer!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    ),
  );
  document.cookie = "session_mark=aaaa; Path=/";
  render(<Friend friendId="f1" ready aliases={{}} />);
  document.cookie = "session_mark=bbbb; Path=/";
  fireEvent(window, new Event("focus"));
  await act(async () =>
    answer(
      new Response(
        JSON.stringify({
          displayName: "はな",
          count: 1,
          records: [{ cardId: "friend-card", receivedOn: "2026-11-01" }],
        }),
      ),
    ),
  );
  expect(screen.queryByText(/はな/)).toBeNull();
  expect(screen.queryByText("friend-card")).toBeNull();
  document.cookie = "session_mark=; Max-Age=0; Path=/";
});
