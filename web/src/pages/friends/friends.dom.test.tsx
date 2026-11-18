import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FriendsPage } from "./friends-page";
import { forgetSignedIn } from "../../session/signed-in";
import { StrictMode } from "react";
import { InvitePage, captureInvite } from "./invite-page";

const renderInvite = () =>
  render(
    <StrictMode>
      <InvitePage initialToken={captureInvite()} />
    </StrictMode>,
  );

let replies: Record<string, { status?: number; body?: unknown }>;
// What GET /api/friends answers unless `replies` has it.
let page: Record<"friends" | "requests" | "blocks", unknown[]> & {
  invite: { url: string };
};
/** The headings of the page's sections, top to bottom. */
const sections = () =>
  [...document.querySelectorAll("main section > h2")].map(
    (heading) => heading.textContent,
  );
/** Opens the friend's "その他" menu and returns it. */
const openMore = (name: string) => {
  const summary = screen.getByLabelText(`${name}さんのその他の操作`);
  expect(summary.tagName).toBe("SUMMARY");
  expect(summary.textContent).toBe("その他");
  const menu = summary.parentElement as HTMLDetailsElement;
  expect(within(menu).getByRole("button", { name: "解除" })).toBeTruthy();
  fireEvent.click(summary);
  expect(menu.open).toBe(true);
  return within(menu);
};
const token = "abcdefghijklmnopqrstuv";
const inviteUrl = `https://manhole-techo.com/friends/invite#t=${token}`;
beforeEach(() => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  history.replaceState(null, "", "/friends");
  page = {
    friends: [{ userId: "f1", displayName: "はな", count: 2, since: 0 }],
    requests: [{ userId: "r1", displayName: "たろう", requestedAt: 0 }],
    blocks: [],
    invite: { url: inviteUrl },
  };
  replies = {
    "POST /api/invite/lookup": { body: { displayName: "はな" } },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${path}`;
      const reply =
        replies[key] ?? (key === "GET /api/friends" ? { body: page } : {});
      return new Response(JSON.stringify(reply.body ?? { ok: true }), {
        status: reply.status ?? 200,
      });
    }),
  );
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  // As a logout: nothing read for this test's user stays for the next.
  forgetSignedIn();
  sessionStorage.clear();
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("hides friends when disabled without fetching", () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "false");
  render(<FriendsPage />);
  renderInvite();
  expect(screen.queryByRole("heading", { name: "フレンド" })).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
it("makes no private requests when signed out", () => {
  render(<FriendsPage />);
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "ログイン・登録へ" })).toBeTruthy();
});
it("removes the token immediately and resumes after login using session storage only", async () => {
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  const view = renderInvite();
  expect(location.hash).toBe("");
  await screen.findByText("はなさんからの招待");
  fireEvent.click(screen.getByRole("link", { name: "ログイン・登録へ" }));
  expect(sessionStorage.getItem("friend-invite")).toBe(token);
  expect(
    screen.getByRole("link", { name: "ログイン・登録へ" }).getAttribute("href"),
  ).toBe("/account?returnTo=%2Ffriends%2Finvite");
  view.unmount();
  document.cookie = "signed_in=1; Path=/";
  renderInvite();
  fireEvent.click(await screen.findByRole("button", { name: "申請する" }));
  await screen.findByText("申請しました");
  expect(sessionStorage.getItem("friend-invite")).toBeNull();
  expect(screen.queryByText("はなさんからの招待")).toBeNull();
  expect(fetch).toHaveBeenCalledWith(
    "/api/friend-requests",
    expect.objectContaining({ body: JSON.stringify({ token }) }),
  );
});
it("reads the token from a link that asks LINE to open the default browser", async () => {
  history.replaceState(
    null,
    "",
    `/friends/invite?openExternalBrowser=1#t=${token}`,
  );
  renderInvite();
  expect(location.hash).toBe("");
  await screen.findByText("はなさんからの招待");
  expect(fetch).toHaveBeenCalledWith(
    "/api/invite/lookup",
    expect.objectContaining({ body: JSON.stringify({ token }) }),
  );
});
it("identifies own invites", async () => {
  document.cookie = "signed_in=1; Path=/";
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  replies["POST /api/invite/lookup"] = {
    body: { displayName: "自分", self: true },
  };
  renderInvite();
  await screen.findByText("これはあなたの招待リンクです");
  expect(screen.queryByRole("button", { name: "申請する" })).toBeNull();
});
it("uses the same message for invalid and expired invites", async () => {
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  replies["POST /api/invite/lookup"] = { status: 404 };
  renderInvite();
  await screen.findByText(
    "この招待リンクは使えません。新しいリンクを送ってもらってください。",
  );
  expect(sessionStorage.getItem("friend-invite")).toBeNull();
});
it("puts requests first, then friends, the invite link and blocks", async () => {
  document.cookie = "signed_in=1; Path=/";
  page.blocks = [{ userId: "b1", displayName: "じろう", blockedAt: 0 }];
  render(<FriendsPage />);
  await screen.findByText("はな");
  expect(sections()).toEqual([
    "受け取った申請",
    "フレンド一覧1人",
    "フレンドを招待",
    "ブロック一覧",
  ]);
  expect(screen.queryByText(/送った申請/)).toBeNull();
});
it("reads the whole page with one request, again after a change", async () => {
  document.cookie = "signed_in=1; Path=/";
  render(<FriendsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "承認" }));
  const reads = () =>
    vi
      .mocked(fetch)
      .mock.calls.filter(([, init]) => (init?.method ?? "GET") === "GET")
      .map(([path]) => path);
  await waitFor(() =>
    expect(reads()).toEqual(["/api/friends", "/api/friends"]),
  );
});
it("leaves out the requests section when there are no requests", async () => {
  document.cookie = "signed_in=1; Path=/";
  page.requests = [];
  render(<FriendsPage />);
  await screen.findByText("はな");
  // Nor the blocks section while nobody is blocked.
  expect(sections()).toEqual(["フレンド一覧1人", "フレンドを招待"]);
  expect(screen.queryByText(/申請はありません/)).toBeNull();
});
it("puts the invite link above an empty friend list, below any requests", async () => {
  document.cookie = "signed_in=1; Path=/";
  page.friends = [];
  render(<FriendsPage />);
  await screen.findByText("たろう");
  expect(sections()).toEqual([
    "受け取った申請",
    "フレンドを招待",
    "フレンド一覧",
  ]);
  const friends = screen.getByRole("region", { name: "フレンド一覧" });
  expect(friends.querySelector("h2 + div")!.textContent).toBe(
    "フレンドはまだいません。",
  );
});
it("keeps removal in each friend's menu, confirms it, and offers no blocking", async () => {
  document.cookie = "signed_in=1; Path=/";
  page.requests = [];
  page.friends = [
    { userId: "f1", displayName: "はな", count: 2, since: 0 },
    { userId: "f2", displayName: "さくら", count: 0, since: 0 },
  ];
  render(<FriendsPage />);
  await screen.findByText("はな");
  expect(sections()[0]).toBe("フレンド一覧2人");
  // Only the menus hold the buttons; every one of them starts closed.
  const menus = [...document.querySelectorAll("details")];
  expect(menus.map((menu) => menu.open)).toEqual([false, false]);
  expect(
    screen
      .getAllByRole("button", { name: "解除" })
      .every((button) => button.closest("details")),
  ).toBe(true);
  expect(screen.queryByRole("button", { name: "ブロック" })).toBeNull();
  fireEvent.click(openMore("さくら").getByRole("button", { name: "解除" }));
  let dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByRole("heading", {
      name: "さくらさんとのフレンドを解除しますか？",
    }),
  ).toBeTruthy();
  expect(fetch).not.toHaveBeenCalledWith(
    "/api/friends/f2",
    expect.objectContaining({ method: "DELETE" }),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "やめる" }));
  fireEvent.click(openMore("はな").getByRole("button", { name: "解除" }));
  dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "解除する" }));
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      "/api/friends/f1",
      expect.objectContaining({ method: "DELETE" }),
    ),
  );
});
it("copies the invite link at once, and replaces it only after confirmation", async () => {
  document.cookie = "signed_in=1; Path=/";
  const replaced = inviteUrl.replace(token, "B".repeat(22));
  replies["POST /api/invite"] = { body: { url: replaced } };
  const writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(<FriendsPage />);
  const posts = () =>
    vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST");
  // No request stands between the press and the clipboard: Safari refuses
  // a write that waits for one.
  fireEvent.click(
    await screen.findByRole("button", { name: "招待リンクをコピー" }),
  );
  expect(writeText).toHaveBeenCalledWith(inviteUrl);
  await screen.findByRole("button", { name: "コピーしました" });
  expect(posts()).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "リンクを作り直す" }));
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByText("前の招待リンクは使えなくなります。"),
  ).toBeTruthy();
  expect(posts()).toEqual([]);
  fireEvent.click(within(dialog).getByRole("button", { name: "作り直す" }));
  await waitFor(() => expect((dialog as HTMLDialogElement).open).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: /コピー/ }));
  expect(writeText).toHaveBeenLastCalledWith(replaced);
});
// The loading line only for a wait that is long enough to notice.
it.each([
  [399, false],
  [400, true],
])(
  "after %ims without the lists, shows the loading line: %s",
  async (wait, shown) => {
    vi.useFakeTimers();
    try {
      document.cookie = "signed_in=1; Path=/";
      let release: (response: Response) => void = () => {};
      vi.mocked(fetch).mockImplementationOnce(
        () => new Promise<Response>((resolve) => (release = resolve)),
      );
      render(<FriendsPage />);
      expect(
        screen.getByRole("heading", { level: 1, name: "フレンド" }),
      ).toBeTruthy();
      expect(screen.queryByText("読み込み中…")).toBeNull();
      await act(() => vi.advanceTimersByTimeAsync(wait));
      expect(screen.queryByText("読み込み中…") !== null).toBe(shown);
      await act(async () => release(new Response(JSON.stringify(page))));
      expect(screen.getByText("はな")).toBeTruthy();
      await act(() => vi.advanceTimersByTimeAsync(1000));
      expect(screen.queryByText("読み込み中…")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  },
);
it("clears lists and returns to login after a 401", async () => {
  document.cookie = "signed_in=1; Path=/";
  replies["GET /api/friends"] = { status: 401 };
  render(<FriendsPage />);
  await screen.findByRole("link", { name: "ログイン・登録へ" });
  expect(document.cookie).not.toContain("signed_in=1");
  expect(screen.queryByText("たろう")).toBeNull();
});
it("drops the list of the user before and reads the new one's when the user changes", async () => {
  document.cookie = "signed_in=1; Path=/";
  document.cookie = "session_mark=a1; Path=/";
  render(<FriendsPage />);
  await screen.findByText("はな");
  page = {
    ...page,
    friends: [{ userId: "f2", displayName: "じろう", count: 1, since: 0 }],
    requests: [{ userId: "r2", displayName: "さぶろう", requestedAt: 0 }],
  };
  document.cookie = "session_mark=b2; Path=/";
  fireEvent.focus(window);
  expect(screen.queryByText("はな")).toBeNull();
  expect(screen.queryByText("たろう")).toBeNull();
  await screen.findByText("じろう");
  // Changed again without a return: a write is not sent for the user before.
  document.cookie = "session_mark=c3; Path=/";
  fireEvent.click(screen.getByRole("button", { name: "承認" }));
  expect(
    (await screen.findAllByText(/利用者が替わった/)).length,
  ).toBeGreaterThan(0);
  expect(
    vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST"),
  ).toEqual([]);
  document.cookie = "session_mark=; Max-Age=0; Path=/";
});
// Another tab signed B in while A's request was on its way, and it came back
// before this page noticed the return.
const outcomes: [string, { status?: number; body?: unknown } | null][] = [
  ["an answer", null],
  ["a failure", { status: 500, body: { error: "internal" } }],
  ["a 401", { status: 401, body: { error: "unauthorized" } }],
];
const route = (path: RequestInfo | URL, init?: RequestInit) =>
  `${init?.method ?? "GET"} ${typeof path === "string" ? path : path instanceof URL ? path.href : path.url}`;
/** Holds the first `key` request until `answer`, then replies as A's would. */
function holdFirst(key: string, reply: { status?: number; body?: unknown }) {
  let answer!: () => void;
  const behind = new Promise<void>((resolve) => (answer = resolve));
  const serve = vi.mocked(fetch).getMockImplementation()!;
  let held = false;
  vi.mocked(fetch).mockImplementation(async (path, init) => {
    if (held || route(path, init) !== key) return serve(path, init);
    held = true;
    await behind;
    return new Response(JSON.stringify(reply.body ?? { ok: true }), {
      status: reply.status ?? 200,
    });
  });
  return () => act(async () => answer());
}
const sent = (key: string) =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([path, init]) => route(path, init) === key);
it.each(outcomes)(
  "drops %s read for the user before another signed in",
  async (_, reply) => {
    document.cookie = "signed_in=1; Path=/";
    document.cookie = "session_mark=a1; Path=/";
    const answer = holdFirst("GET /api/friends", reply ?? { body: page });
    render(<FriendsPage />);
    await waitFor(() => expect(sent("GET /api/friends")).toHaveLength(1));
    page = {
      ...page,
      friends: [{ userId: "f2", displayName: "じろう", count: 1, since: 0 }],
      requests: [],
    };
    document.cookie = "session_mark=b2; Path=/";
    await answer();
    expect(screen.queryByText("はな")).toBeNull();
    await screen.findByText("じろう");
    expect(screen.queryByText("はな")).toBeNull();
    expect(document.cookie).toContain("signed_in=1");
    expect(document.cookie).toContain("session_mark=b2");
    document.cookie = "session_mark=; Max-Age=0; Path=/";
  },
);
it.each(outcomes)(
  "drops %s to an invitation's request for the user before another signed in",
  async (_, reply) => {
    document.cookie = "signed_in=1; Path=/";
    document.cookie = "session_mark=a1; Path=/";
    history.replaceState(null, "", `/friends/invite#t=${token}`);
    const answer = holdFirst("POST /api/friend-requests", reply ?? {});
    renderInvite();
    fireEvent.click(await screen.findByRole("button", { name: "申請する" }));
    await waitFor(() =>
      expect(sent("POST /api/friend-requests")).toHaveLength(1),
    );
    document.cookie = "session_mark=b2; Path=/";
    await answer();
    expect(screen.queryByText("申請しました")).toBeNull();
    expect((await screen.findByRole("alert")).textContent).toContain(
      "利用者が替わった",
    );
    expect(screen.getByRole("button", { name: "申請する" })).toBeTruthy();
    expect(document.cookie).toContain("signed_in=1");
    expect(document.cookie).toContain("session_mark=b2");
    document.cookie = "session_mark=; Max-Age=0; Path=/";
  },
);
it("accepts and deletes received requests and unblocks without restoring friendships", async () => {
  document.cookie = "signed_in=1; Path=/";
  page.blocks = [{ userId: "b1", displayName: "じろう", blockedAt: 0 }];
  render(<FriendsPage />);
  fireEvent.click(await screen.findByRole("button", { name: "承認" }));
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      "/api/friend-requests/r1/accept",
      expect.objectContaining({ method: "POST" }),
    ),
  );
  fireEvent.click(await screen.findByRole("button", { name: "削除" }));
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      "/api/friend-requests/r1",
      expect.objectContaining({ method: "DELETE" }),
    ),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "ブロックを解除" }),
  );
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      "/api/blocks/b1",
      expect.objectContaining({ method: "DELETE" }),
    ),
  );
  expect(
    screen.getByText(/ブロックを解除してもフレンドには戻りません/),
  ).toBeTruthy();
});

it.each([
  ["remove", "解除", "解除する", "DELETE /api/friends/f1"],
  ["replace", "リンクを作り直す", "作り直す", "POST /api/invite"],
])(
  "announces %s failures inside the modal and permits retry",
  async (_, open, confirm, path) => {
    document.cookie = "signed_in=1; Path=/";
    replies[path] = { status: 500 };
    render(<FriendsPage />);
    await screen.findByText("はな");
    fireEvent.click(
      open === "リンクを作り直す"
        ? screen.getByRole("button", { name: open })
        : openMore("はな").getByRole("button", { name: open }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: confirm }));
    const error = await within(dialog).findByRole("alert");
    expect(error.textContent).toBe("通信を確認してやり直してください。");
    expect((dialog as HTMLDialogElement).open).toBe(true);
    await waitFor(() =>
      expect(
        within(dialog).getByRole<HTMLButtonElement>("button", {
          name: confirm,
        }).disabled,
      ).toBe(false),
    );
  },
);
it("closes a failed confirmation on 401 and focuses the login guidance", async () => {
  document.cookie = "signed_in=1; Path=/";
  replies["DELETE /api/friends/f1"] = { status: 401 };
  render(<FriendsPage />);
  await screen.findByText("はな");
  fireEvent.click(openMore("はな").getByRole("button", { name: "解除" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "解除する",
    }),
  );
  const link = await screen.findByRole("link", { name: "ログイン・登録へ" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(link));
  expect(screen.getByRole("alert").textContent).toBe(
    "ログインし直してください。",
  );
});
it("consumes the saved invite on return and never restores it for another account", async () => {
  document.cookie = "signed_in=1; Path=/";
  sessionStorage.setItem("friend-invite", token);
  const view = renderInvite();
  expect(sessionStorage.getItem("friend-invite")).toBeNull();
  await screen.findByRole("button", { name: "申請する" });
  view.unmount();
  forgetSignedIn();
  document.cookie = "signed_in=1; Path=/";
  renderInvite();
  await screen.findByText(
    "この招待リンクは使えません。新しいリンクを送ってもらってください。",
  );
  expect(screen.queryByRole("button", { name: "申請する" })).toBeNull();
});
it("stores the in-memory invite again only when starting re-login", async () => {
  document.cookie = "signed_in=1; Path=/";
  sessionStorage.setItem("friend-invite", token);
  replies["POST /api/friend-requests"] = { status: 401 };
  renderInvite();
  fireEvent.click(await screen.findByRole("button", { name: "申請する" }));
  const link = await screen.findByRole("link", { name: "ログイン・登録へ" });
  expect(sessionStorage.getItem("friend-invite")).toBeNull();
  fireEvent.click(link);
  expect(sessionStorage.getItem("friend-invite")).toBe(token);
});

it("consumes the stored invite on persisted pageshow without remounting", async () => {
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  renderInvite();
  fireEvent.click(
    await screen.findByRole("link", { name: "ログイン・登録へ" }),
  );
  document.cookie = "signed_in=1; Path=/";
  fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
  expect(sessionStorage.getItem("friend-invite")).toBeNull();
  await screen.findByRole("button", { name: "申請する" });
  expect(screen.queryByRole("link", { name: "ログイン・登録へ" })).toBeNull();
});
it("refreshes invitation actions on focus after login in another tab", async () => {
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  renderInvite();
  await screen.findByRole("link", { name: "ログイン・登録へ" });
  document.cookie = "signed_in=1; Path=/";
  fireEvent.focus(window);
  await screen.findByRole("button", { name: "申請する" });
  expect(screen.queryByRole("link", { name: "ログイン・登録へ" })).toBeNull();
});
it("discards stored and in-memory invitations on focus after logout in another tab", async () => {
  document.cookie = "signed_in=1; Path=/";
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  renderInvite();
  await screen.findByRole("button", { name: "申請する" });
  sessionStorage.setItem("friend-invite", token);
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  fireEvent.focus(window);
  expect(sessionStorage.getItem("friend-invite")).toBeNull();
  await screen.findByText("もう一度招待リンクを開いてください");
  expect(screen.queryByRole("button", { name: "申請する" })).toBeNull();
  document.cookie = "signed_in=1; Path=/";
  fireEvent.focus(window);
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "申請する" })).toBeNull(),
  );
  expect(screen.queryByRole("link", { name: "ログイン・登録へ" })).toBeNull();
});

it("continues invite lookup when a saved token is consumed during an in-flight lookup", async () => {
  const finish: (() => void)[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) =>
          finish.push(() =>
            resolve(new Response(JSON.stringify({ displayName: "はな" }))),
          ),
        ),
    ),
  );
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  renderInvite();
  sessionStorage.setItem("friend-invite", token);
  fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
  await act(async () => {
    finish.forEach((resolve) => resolve());
  });
  await screen.findByRole("link", { name: "ログイン・登録へ" });
  expect(sessionStorage.getItem("friend-invite")).toBeNull();
});
it("checks authentication only when visibility returns to visible", async () => {
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  renderInvite();
  await screen.findByRole("link", { name: "ログイン・登録へ" });
  document.cookie = "signed_in=1; Path=/";
  const visibility = vi.spyOn(document, "visibilityState", "get");
  visibility.mockReturnValue("hidden");
  fireEvent(document, new Event("visibilitychange"));
  expect(screen.queryByRole("button", { name: "申請する" })).toBeNull();
  visibility.mockReturnValue("visible");
  fireEvent(document, new Event("visibilitychange"));
  await screen.findByRole("button", { name: "申請する" });
  visibility.mockRestore();
});
it("removes invitation lifecycle listeners on unmount", async () => {
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  const view = renderInvite();
  await screen.findByRole("link", { name: "ログイン・登録へ" });
  view.unmount();
  sessionStorage.setItem("friend-invite", token);
  fireEvent.focus(window);
  fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
  fireEvent(document, new Event("visibilitychange"));
  expect(sessionStorage.getItem("friend-invite")).toBe(token);
});
it("links each friend's collection map and shows the card count and since-date", async () => {
  document.cookie = "signed_in=1; Path=/";
  render(<FriendsPage />);
  await screen.findByText("はな");
  const row = screen.getByText("はな").closest("li")!;
  expect(
    within(row)
      .getByRole("link", { name: "入手マップを見る" })
      .getAttribute("href"),
  ).toBe("/?friend=f1");
  expect(within(row).getByText(/^2枚/).textContent).toBe(
    "2枚 · フレンドになった日：1970/1/1",
  );
});

// An invitation looked up as A tells A whether it is A's own: once B is
// signed in, it is looked up again as B.
it("looks an invitation up again when another user signed in as it was answered", async () => {
  document.cookie = "signed_in=1; Path=/";
  document.cookie = "session_mark=a1; Path=/";
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  // Answered as the session the request carried: A's own invite for A.
  let open!: () => void;
  const gate = new Promise<void>((resolve) => (open = resolve));
  const serve = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (path, init) => {
    if (route(path, init) !== "POST /api/invite/lookup")
      return serve(path, init);
    const asA = document.cookie.includes("session_mark=a1");
    await gate;
    return new Response(
      JSON.stringify(
        asA ? { displayName: "自分", self: true } : { displayName: "はな" },
      ),
    );
  });
  renderInvite();
  await waitFor(() => expect(sent("POST /api/invite/lookup")).not.toEqual([]));
  const asked = sent("POST /api/invite/lookup").length;
  document.cookie = "session_mark=b2; Path=/";
  await act(async () => open());
  await screen.findByText("はなさんからの招待");
  expect(screen.queryByText("これはあなたの招待リンクです")).toBeNull();
  expect(screen.getByRole("button", { name: "申請する" })).toBeTruthy();
  expect(sent("POST /api/invite/lookup").length).toBeGreaterThan(asked);
  document.cookie = "session_mark=; Max-Age=0; Path=/";
});
it("looks an invitation up again when the page returns to another user", async () => {
  document.cookie = "signed_in=1; Path=/";
  document.cookie = "session_mark=a1; Path=/";
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  replies["POST /api/invite/lookup"] = {
    body: { displayName: "自分", self: true },
  };
  renderInvite();
  await screen.findByText("これはあなたの招待リンクです");
  replies["POST /api/invite/lookup"] = { body: { displayName: "はな" } };
  document.cookie = "session_mark=b2; Path=/";
  await act(async () => fireEvent(window, new Event("focus")));
  await screen.findByText("はなさんからの招待");
  expect(screen.queryByText("これはあなたの招待リンクです")).toBeNull();
  document.cookie = "session_mark=; Max-Age=0; Path=/";
});
it("does not tell a request answered after another tab logged out as made", async () => {
  document.cookie = "signed_in=1; Path=/";
  document.cookie = "session_mark=a1; Path=/";
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  const answer = holdFirst("POST /api/friend-requests", {});
  renderInvite();
  fireEvent.click(await screen.findByRole("button", { name: "申請する" }));
  await waitFor(() =>
    expect(sent("POST /api/friend-requests")).toHaveLength(1),
  );
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  document.cookie = "session_mark=; Max-Age=0; Path=/";
  await answer();
  expect(
    await screen.findByRole("link", { name: "ログイン・登録へ" }),
  ).toBeTruthy();
  expect(screen.queryByText("申請しました")).toBeNull();
});
it("drops a 401 to a request once the invitation page is left", async () => {
  document.cookie = "signed_in=1; Path=/";
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  const answer = holdFirst("POST /api/friend-requests", {
    status: 401,
    body: { error: "unauthorized" },
  });
  const view = renderInvite();
  fireEvent.click(await screen.findByRole("button", { name: "申請する" }));
  await waitFor(() =>
    expect(sent("POST /api/friend-requests")).toHaveLength(1),
  );
  view.unmount();
  await answer();
  expect(document.cookie).toContain("signed_in=1");
});

// The display cookies outlive the session the Worker keeps (an inactive
// 30 days, a recovery or a deletion elsewhere): an hour after the friends
// were last answered, they are not shown again before being asked for.
const anHour = 60 * 60 * 1000;
/** Holds the next GET /api/friends until `answer`, which replies `reply`. */
function holdNext(reply: { status?: number; body?: unknown }) {
  let answer!: () => void;
  const behind = new Promise<void>((resolve) => (answer = resolve));
  const serve = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation(async (path, init) => {
    if (route(path, init) !== "GET /api/friends") return serve(path, init);
    vi.mocked(fetch).mockImplementation(serve);
    await behind;
    return new Response(JSON.stringify(reply.body ?? { ok: true }), {
      status: reply.status ?? 200,
    });
  });
  return () => act(async () => answer());
}
it("hides the friends on a return an hour after their last answer, and asks again", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    document.cookie = "signed_in=1; Path=/";
    render(<FriendsPage />);
    await screen.findByText("はな");
    vi.setSystemTime(Date.now() + anHour - 60 * 1000);
    fireEvent.focus(window);
    expect(sent("GET /api/friends")).toHaveLength(1);
    vi.setSystemTime(Date.now() + 2 * 60 * 1000);
    const answer = holdNext({ status: 401, body: { error: "unauthorized" } });
    fireEvent.focus(window);
    expect(screen.queryByText("はな")).toBeNull();
    expect(screen.queryByText("たろう")).toBeNull();
    await answer();
    await screen.findByRole("link", { name: "ログイン・登録へ" });
    expect(sent("GET /api/friends")).toHaveLength(2);
    expect(document.cookie).not.toContain("signed_in=1");
  } finally {
    vi.useRealTimers();
  }
});
it("does not draw friends kept from over an hour ago when the screen is entered again", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    document.cookie = "signed_in=1; Path=/";
    const view = render(<FriendsPage />);
    await screen.findByText("はな");
    view.unmount();
    vi.setSystemTime(Date.now() + anHour + 1000);
    const answer = holdNext({ body: page });
    render(<FriendsPage />);
    expect(screen.queryByText("はな")).toBeNull();
    await answer();
    await screen.findByText("はな");
    expect(sent("GET /api/friends")).toHaveLength(2);
  } finally {
    vi.useRealTimers();
  }
});
// A read on its way is shared, but what was read before is drawn only while
// it is under an hour old: entered again as the read goes on, the screen
// draws nothing of it, and a failed read leaves nothing behind.
it("does not draw friends over an hour old when entered again while they are read again", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    document.cookie = "signed_in=1; Path=/";
    const first = render(<FriendsPage />);
    await screen.findByText("はな");
    first.unmount();
    vi.setSystemTime(Date.now() + anHour - 60 * 1000);
    let fail!: () => void;
    const behind = new Promise<void>((resolve) => (fail = resolve));
    const serve = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (path, init) => {
      if (route(path, init) !== "GET /api/friends") return serve(path, init);
      vi.mocked(fetch).mockImplementation(serve);
      await behind;
      throw new TypeError("Failed to fetch");
    });
    const second = render(<FriendsPage />);
    expect(screen.getByText("はな")).toBeTruthy();
    await waitFor(() => expect(sent("GET /api/friends")).toHaveLength(2));
    second.unmount();
    vi.setSystemTime(Date.now() + 2 * 60 * 1000);
    render(<FriendsPage />);
    expect(screen.queryByText("はな")).toBeNull();
    await act(async () => fail());
    await screen.findByRole("alert");
    expect(screen.queryByText("はな")).toBeNull();
    expect(screen.queryByText("たろう")).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
// Leaving the tab is not a return: an hour after the last answer, the
// friends are read again when the tab is shown, not as it is hidden.
it("reads the friends again an hour later only when the tab is shown again", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  const visibility = vi.spyOn(document, "visibilityState", "get");
  try {
    document.cookie = "signed_in=1; Path=/";
    render(<FriendsPage />);
    await screen.findByText("はな");
    vi.setSystemTime(Date.now() + anHour + 1000);
    visibility.mockReturnValue("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(sent("GET /api/friends")).toHaveLength(1);
    expect(screen.getByText("はな")).toBeTruthy();
    visibility.mockReturnValue("visible");
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(sent("GET /api/friends")).toHaveLength(2));
  } finally {
    visibility.mockRestore();
    vi.useRealTimers();
  }
});

// A's request made, then B signed in: what the page told A is not B's.
it("does not tell another user who signed in since that the request was made", async () => {
  document.cookie = "signed_in=1; Path=/";
  document.cookie = "session_mark=a1; Path=/";
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  renderInvite();
  fireEvent.click(await screen.findByRole("button", { name: "申請する" }));
  await screen.findByText("申請しました");
  document.cookie = "session_mark=b2; Path=/";
  await act(async () => fireEvent(window, new Event("focus")));
  expect(screen.queryByText("申請しました")).toBeNull();
  await screen.findByText("はなさんからの招待");
  expect(screen.getByRole("button", { name: "申請する" })).toBeTruthy();
  document.cookie = "session_mark=; Max-Age=0; Path=/";
});
// The invitation was looked up as A; B signed in before the page heard of
// it. Pressed now, it is looked up again as B, and nothing is sent.
it("looks the invitation up again instead of requesting as another user than it was looked up for", async () => {
  document.cookie = "signed_in=1; Path=/";
  document.cookie = "session_mark=a1; Path=/";
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  renderInvite();
  const press = await screen.findByRole("button", { name: "申請する" });
  const asked = sent("POST /api/invite/lookup").length;
  document.cookie = "session_mark=b2; Path=/";
  fireEvent.click(press);
  await waitFor(() =>
    expect(sent("POST /api/invite/lookup").length).toBeGreaterThan(asked),
  );
  await screen.findByRole("button", { name: "申請する" });
  expect(sent("POST /api/friend-requests")).toEqual([]);
  expect(screen.queryByText("申請しました")).toBeNull();
  document.cookie = "session_mark=; Max-Age=0; Path=/";
});

// Issue #360: the invitation's link is the user's whose lists are shown.
// Another tab signed B in, and this page has not heard of it yet: the link
// is neither copied nor shared as A's, and B's lists are read instead.
it.each(["招待リンクをコピー", "共有"])(
  "takes no invitation of the user before out once another has signed in (%s)",
  async (name) => {
    document.cookie = "signed_in=1; Path=/";
    document.cookie = "session_mark=aaaa; Path=/";
    const writeText = vi.fn(async () => {});
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    try {
      render(<FriendsPage />);
      await screen.findByRole("button", { name: "招待リンクをコピー" });
      page = {
        ...page,
        friends: [{ userId: "f2", displayName: "じろう", count: 1, since: 0 }],
        invite: { url: inviteUrl.replace(token, "B".repeat(22)) },
      };
      document.cookie = "session_mark=bbbb; Path=/";
      fireEvent.click(screen.getByRole("button", { name }));
      expect(await screen.findByText("じろう")).toBeTruthy();
      await act(async () => {});
      expect(writeText).not.toHaveBeenCalled();
      expect(share).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(navigator, "share");
      document.cookie = "session_mark=; Max-Age=0; Path=/";
    }
  },
);
