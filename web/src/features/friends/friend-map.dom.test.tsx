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
import {
  RecordAction,
  RecordBadge,
  RecordFilter,
} from "../records/record-controls";
import { RecordEditor } from "../records/record-editor";
function Probe() {
  const records = useRecords();
  return (
    <>
      <RecordFilter showFriend />
      <span>{[...(records.records?.keys() ?? [])].join(",")}</span>
      <RecordBadge ids={["friend-card"]} />
      <RecordAction ids={["friend-card"]} />
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
  expect(screen.queryByText("未入手")).toBeNull();
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
  await screen.findByText("はなさんの入手マップ");
  await screen.findByText("friend-card");
  expect(screen.queryByText("mine")).toBeNull();
  // Opened to see what the friend has, so it starts on the received cards.
  expect(
    screen.getByRole<HTMLInputElement>("radio", { name: "入手済み" }).checked,
  ).toBe(true);
  expect(screen.getAllByText("入手済み").length).toBeGreaterThan(0);
  expect(screen.getByText("2026年11月1日")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button", { name: "入手した" })).toBeNull();
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
// The same, answered before this page noticed the return.
it.each([
  [
    "an answer",
    200,
    {
      displayName: "はな",
      count: 1,
      records: [{ cardId: "friend-card", receivedOn: "2026-11-01" }],
    },
  ],
  ["a failure", 500, { error: "internal" }],
  ["a 401", 401, { error: "unauthorized" }],
])(
  "drops %s asked for by the user before another signed in, before any return",
  async (_, status, body) => {
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
    await act(async () =>
      answer(new Response(JSON.stringify(body), { status })),
    );
    expect(screen.queryByText(/はな/)).toBeNull();
    expect(screen.queryByText("friend-card")).toBeNull();
    expect(screen.getByText("表示できません")).toBeTruthy();
    expect(document.cookie).toContain("signed_in=1");
    expect(document.cookie).toContain("session_mark=bbbb");
    document.cookie = "session_mark=; Max-Age=0; Path=/";
  },
);
// PF-5: a map left (the screen switched, the map hidden) closes its guard.
it("drops a 401 that comes back once the map is left", async () => {
  let answer!: () => void;
  const behind = new Promise<void>((resolve) => (answer = resolve));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await behind;
      return new Response('{"error":"unauthorized"}', { status: 401 });
    }),
  );
  const view = render(<Friend friendId="f1" ready aliases={{}} />);
  await act(async () => {});
  expect(fetch).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(async () => answer());
  expect(document.cookie).toContain("signed_in=1");
});

// The display cookies outlive the session the Worker keeps: an hour after
// the friend's records were answered, a return takes them off the map and
// asks again.
it("takes a friend's records off the map on a return an hour later and asks again", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    const answers: ((response: Response) => void)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => answers.push(resolve))),
    );
    const records = () =>
      new Response(
        JSON.stringify({
          displayName: "はな",
          count: 1,
          records: [{ cardId: "friend-card", receivedOn: "2026-11-01" }],
        }),
      );
    render(<Friend friendId="f1" ready aliases={{}} />);
    await act(async () => answers[0](records()));
    await screen.findByText("friend-card");
    vi.setSystemTime(Date.now() + 60 * 60 * 1000 + 1000);
    fireEvent(window, new Event("focus"));
    expect(screen.queryByText("friend-card")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => answers[1](records()));
    await screen.findByText("friend-card");
  } finally {
    vi.useRealTimers();
  }
});
