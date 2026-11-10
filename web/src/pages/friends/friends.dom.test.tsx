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
import { forgetSignedIn } from "../../shared/browser/signed-in";
import { StrictMode } from "react";
import { InvitePage, captureInvite } from "./invite-page";

const renderInvite = () =>
  render(
    <StrictMode>
      <InvitePage initialToken={captureInvite()} />
    </StrictMode>,
  );

let replies: Record<string, { status?: number; body?: unknown }>;
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
beforeEach(() => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  history.replaceState(null, "", "/friends");
  replies = {
    "GET /api/invite": { body: { expiresAt: null } },
    "GET /api/friends": {
      body: {
        friends: [{ userId: "f1", displayName: "はな", count: 2, since: 0 }],
      },
    },
    "GET /api/friend-requests": {
      body: {
        requests: [{ userId: "r1", displayName: "たろう", requestedAt: 0 }],
      },
    },
    "GET /api/blocks": { body: { blocks: [] } },
    "POST /api/invite/lookup": { body: { displayName: "はな" } },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      const reply = replies[`${init?.method ?? "GET"} ${path}`] ?? {};
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
  ).toBe("/account.html?returnTo=%2Ffriends%2Finvite");
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
  render(<FriendsPage />);
  await screen.findByText("はな");
  expect(sections()).toEqual([
    "受け取った申請",
    "フレンド一覧1人",
    "招待リンク",
    "ブロック一覧",
  ]);
  expect(screen.queryByText(/送った申請/)).toBeNull();
});
it("leaves out the requests section when there are no requests", async () => {
  document.cookie = "signed_in=1; Path=/";
  replies["GET /api/friend-requests"] = { body: { requests: [] } };
  render(<FriendsPage />);
  await screen.findByText("はな");
  expect(sections()).toEqual(["フレンド一覧1人", "招待リンク", "ブロック一覧"]);
  expect(screen.queryByText(/申請はありません/)).toBeNull();
});
it("puts the invite link above an empty friend list, below any requests", async () => {
  document.cookie = "signed_in=1; Path=/";
  replies["GET /api/friends"] = { body: { friends: [] } };
  render(<FriendsPage />);
  await screen.findByText("たろう");
  expect(sections()).toEqual([
    "受け取った申請",
    "招待リンク",
    "フレンド一覧",
    "ブロック一覧",
  ]);
  const friends = screen.getByRole("region", { name: "フレンド一覧" });
  expect(friends.querySelector("h2 + div")!.textContent).toBe(
    "フレンドはまだいません。",
  );
});
it("keeps removal and blocking in each friend's menu and confirms both", async () => {
  document.cookie = "signed_in=1; Path=/";
  replies["GET /api/friend-requests"] = { body: { requests: [] } };
  replies["GET /api/friends"] = {
    body: {
      friends: [
        { userId: "f1", displayName: "はな", count: 2, since: 0 },
        { userId: "f2", displayName: "さくら", count: 0, since: 0 },
      ],
    },
  };
  render(<FriendsPage />);
  await screen.findByText("はな");
  expect(sections()[0]).toBe("フレンド一覧2人");
  // Only the menus hold the buttons; every one of them starts closed.
  const menus = [...document.querySelectorAll("details")];
  expect(menus.map((menu) => menu.open)).toEqual([false, false]);
  expect(
    screen
      .getAllByRole("button", { name: /^(解除|ブロック)$/ })
      .every((button) => button.closest("details")),
  ).toBe(true);
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
  fireEvent.click(openMore("はな").getByRole("button", { name: "ブロック" }));
  dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText(/相手には通知されません/)).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "ブロックする" }));
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      "/api/blocks/f1",
      expect.objectContaining({ method: "PUT" }),
    ),
  );
});

it("creates, copies and replaces an invitation only after confirmation", async () => {
  document.cookie = "signed_in=1; Path=/";
  const url = `https://manhole-techo.com/friends/invite#t=${token}`;
  replies["POST /api/invite"] = { body: { url, expiresAt: 1795000000000 } };
  const writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(<FriendsPage />);
  fireEvent.click(
    await screen.findByRole("button", { name: "招待リンクを作る" }),
  );
  const input = await screen.findByLabelText("送るリンク");
  expect((input as HTMLInputElement).value).toBe(url);
  fireEvent.click(screen.getByRole("button", { name: "コピー" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(url));
  await screen.findByText("コピーしました");
  fireEvent.click(screen.getByRole("button", { name: "作り直す" }));
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByText("前の招待リンクは使えなくなります。"),
  ).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "作り直す" }));
  await waitFor(() =>
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(
          ([path, init]) => path === "/api/invite" && init?.method === "POST",
        ),
    ).toHaveLength(2),
  );
});
it("clears lists and returns to login after a 401", async () => {
  document.cookie = "signed_in=1; Path=/";
  replies["GET /api/friends"] = { status: 401 };
  render(<FriendsPage />);
  await screen.findByRole("link", { name: "ログイン・登録へ" });
  expect(document.cookie).not.toContain("signed_in=1");
  expect(screen.queryByText("たろう")).toBeNull();
});
it("accepts and deletes received requests and unblocks without restoring friendships", async () => {
  document.cookie = "signed_in=1; Path=/";
  replies["GET /api/blocks"] = {
    body: { blocks: [{ userId: "b1", displayName: "じろう", blockedAt: 0 }] },
  };
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
  ["block", "ブロック", "ブロックする", "PUT /api/blocks/f1"],
  ["replace", "作り直す", "作り直す", "POST /api/invite"],
])(
  "announces %s failures inside the modal and permits retry",
  async (_, open, confirm, path) => {
    document.cookie = "signed_in=1; Path=/";
    replies["GET /api/invite"] = { body: { expiresAt: 1795000000000 } };
    replies[path] = { status: 500 };
    render(<FriendsPage />);
    await screen.findByText("はな");
    fireEvent.click(
      open === "作り直す"
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
        (
          within(dialog).getByRole("button", {
            name: confirm,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
  },
);
it("closes a failed confirmation on 401 and focuses the login guidance", async () => {
  document.cookie = "signed_in=1; Path=/";
  replies["PUT /api/blocks/f1"] = { status: 401 };
  render(<FriendsPage />);
  await screen.findByText("はな");
  fireEvent.click(openMore("はな").getByRole("button", { name: "ブロック" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "ブロックする",
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
it("lists what friends can and cannot see and links each friend's collection map", async () => {
  document.cookie = "signed_in=1; Path=/";
  render(<FriendsPage />);
  await screen.findByText("はな");
  const invite = screen.getByRole("region", { name: "招待リンク" });
  const facts = within(invite).getAllByRole("definition");
  expect(facts.map((fact) => fact.textContent)).toEqual([
    "表示名、回収済みのカード、回収した日、枚数",
    "メモ",
  ]);
  const row = screen.getByText("はな").closest("li")!;
  expect(
    within(row)
      .getByRole("link", { name: "回収マップを見る" })
      .getAttribute("href"),
  ).toBe("/?friend=f1");
  expect(within(row).getByText(/^2枚/).textContent).toBe(
    "2枚 · フレンドになった日：1970/1/1",
  );
});
it.each([
  ["friends", () => render(<FriendsPage />)],
  ["invite", renderInvite],
])("keeps the frame of the unavailable %s page", (name, show) => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "false");
  const { container } = show();
  expect([...container.children].map((child) => child.tagName)).toEqual([
    "HEADER",
    "MAIN",
  ]);
  expect(container.querySelector("header")!.getAttribute("data-current")).toBe(
    name === "friends" ? "friends" : null,
  );
  const main = container.querySelector("main")!;
  expect(main.className).toBe("account-page");
  expect(main.innerHTML).toBe("<p>フレンド機能はまだ使えません。</p>");
  expect(document.activeElement).toBe(document.body);
});
it("keeps the frame around the friends and invite screens", async () => {
  const friends = render(<FriendsPage />).container;
  expect([...friends.children].map((child) => child.tagName)).toEqual([
    "HEADER",
    "MAIN",
  ]);
  expect(friends.querySelector("header")!.getAttribute("data-current")).toBe(
    "friends",
  );
  const main = friends.querySelector("main")!;
  expect(main.className).toBe("account-page");
  expect(main.innerHTML).toBe(
    '<h1>フレンド</h1><a href="/account.html?returnTo=%2Ffriends">ログイン・登録へ</a>',
  );
  cleanup();
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  const invite = renderInvite().container;
  await screen.findByText("はなさんからの招待");
  expect([...invite.children].map((child) => child.tagName)).toEqual([
    "HEADER",
    "MAIN",
  ]);
  expect(invite.querySelector("main")!.className).toBe("account-page");
  expect(invite.querySelector("main > h1")!.textContent).toBe("フレンドの招待");
});
