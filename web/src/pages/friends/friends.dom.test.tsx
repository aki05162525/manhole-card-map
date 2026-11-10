import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FriendsPage } from "./friends-page";
import { InvitePage } from "./invite-page";

let replies: Record<string, { status?: number; body?: unknown }>;
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
  render(<InvitePage />);
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
  const view = render(<InvitePage />);
  expect(location.hash).toBe("");
  await screen.findByText("はなさんからの招待");
  fireEvent.click(screen.getByRole("link", { name: "ログイン・登録へ" }));
  expect(sessionStorage.getItem("friend-invite")).toBe(token);
  expect(
    screen.getByRole("link", { name: "ログイン・登録へ" }).getAttribute("href"),
  ).toBe("/account.html?returnTo=%2Ffriends%2Finvite");
  view.unmount();
  document.cookie = "signed_in=1; Path=/";
  render(<InvitePage />);
  fireEvent.click(await screen.findByRole("button", { name: "申請する" }));
  await screen.findByText("申請しました");
  expect(sessionStorage.getItem("friend-invite")).toBeNull();
  expect(screen.queryByText("はなさんからの招待")).toBeNull();
  expect(fetch).toHaveBeenCalledWith(
    "/api/friend-requests",
    expect.objectContaining({ body: JSON.stringify({ token }) }),
  );
});
it("identifies own invites", async () => {
  document.cookie = "signed_in=1; Path=/";
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  replies["POST /api/invite/lookup"] = {
    body: { displayName: "自分", self: true },
  };
  render(<InvitePage />);
  await screen.findByText("これはあなたの招待リンクです");
  expect(screen.queryByRole("button", { name: "申請する" })).toBeNull();
});
it("uses the same message for invalid and expired invites", async () => {
  history.replaceState(null, "", `/friends/invite#t=${token}`);
  replies["POST /api/invite/lookup"] = { status: 404 };
  render(<InvitePage />);
  await screen.findByText(
    "この招待リンクは使えません。新しいリンクを送ってもらってください。",
  );
  expect(sessionStorage.getItem("friend-invite")).toBeNull();
});
it("shows received requests only and confirms removal and blocking", async () => {
  document.cookie = "signed_in=1; Path=/";
  render(<FriendsPage />);
  await screen.findByText("はな");
  expect(screen.getByRole("heading", { name: "受け取った申請" })).toBeTruthy();
  expect(screen.queryByText(/送った申請/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "解除" }));
  let dialog = screen.getByRole("dialog");
  expect(fetch).not.toHaveBeenCalledWith(
    "/api/friends/f1",
    expect.objectContaining({ method: "DELETE" }),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "やめる" }));
  fireEvent.click(screen.getAllByRole("button", { name: "ブロック" })[1]);
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
