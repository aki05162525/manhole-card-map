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
import { AccountPage } from "./account-page";

type Reply = { status?: number; body?: unknown };
type Handler = Reply | ((body: unknown) => Reply);

let routes: Record<string, Handler | Handler[]>;
const calls: string[] = [];

function serve(method: string, path: string, body: unknown) {
  const key = method + " " + path;
  calls.push(key);
  const route = routes[key];
  const handler = Array.isArray(route) ? route.shift() : route;
  if (!handler)
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
    });
  const reply = typeof handler === "function" ? handler(body) : handler;
  return new Response(JSON.stringify(reply.body ?? { ok: true }), {
    status: reply.status ?? 200,
  });
}

const cancel = () => Promise.reject(new DOMException("", "NotAllowedError"));
const credentials = {
  create: vi.fn(async () => ({ toJSON: () => ({ id: "new" }) })),
  get: vi.fn(async () => ({ toJSON: () => ({ id: "old" }) })),
};
const profile = {
  displayName: "たろう",
  passkeys: 2,
  recoveryCodesRemaining: 9,
};
const codes = Array.from({ length: 10 }, (_, i) => `AAAA-BBBB-CCCC-000${i}`);
const passkeys = {
  passkeys: [
    { id: "p1", label: "パスキー 1", createdAt: 0, lastUsedAt: null },
    { id: "p2", label: "パスキー 2", createdAt: 0, lastUsedAt: 0 },
  ],
};

beforeEach(() => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  calls.length = 0;
  routes = {};
  credentials.create.mockClear();
  credentials.get.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) =>
      serve(
        init?.method ?? "GET",
        path,
        init?.body ? JSON.parse(String(init.body)) : undefined,
      ),
    ),
  );
  vi.stubGlobal("PublicKeyCredential", {
    parseCreationOptionsFromJSON: (options: unknown) => options,
    parseRequestOptionsFromJSON: (options: unknown) => options,
  });
  Object.defineProperty(navigator, "credentials", {
    configurable: true,
    value: credentials,
  });
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const signIn = () => (document.cookie = "signed_in=1; Path=/");

it("explains that accounts are unavailable without the build flag", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "false");
  render(<AccountPage />);
  await act(async () => {});
  expect(screen.getByText(/アカウント機能はまだ使えません/)).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it("tells devices without passkeys that browsing still works", async () => {
  vi.stubGlobal("PublicKeyCredential", undefined);
  render(<AccountPage />);
  expect(
    screen.getByText(
      "この端末ではログインできません。閲覧はそのまま使えます。",
    ),
  ).toBeTruthy();
  expect(screen.getByText(/QRコード/)).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "パスキーでログイン" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "回復コードで入る" }));
  expect(screen.getByText("この端末では回復を完了できません。")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});

it("warns before registration and links the terms", () => {
  render(<AccountPage />);
  const signup = screen.getByRole("region", { name: "はじめて使う" });
  expect(
    within(signup).getByText(/パスキーと回復コードを両方失うと/),
  ).toBeTruthy();
  expect(
    within(signup)
      .getByRole("link", { name: /規約とプライバシーポリシー/ })
      .getAttribute("href"),
  ).toBe("/terms.html");
});

it("returns to the sign-in screen without an error when the passkey prompt is cancelled", async () => {
  routes["POST /api/auth/login/options"] = { body: { challenge: "c" } };
  credentials.get.mockImplementationOnce(cancel);
  render(<AccountPage />);
  fireEvent.click(screen.getByRole("button", { name: "パスキーでログイン" }));
  await waitFor(() => expect(credentials.get).toHaveBeenCalled());
  await act(async () => {});
  expect(
    screen.getByRole("button", { name: "パスキーでログイン" }),
  ).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(calls).not.toContain("POST /api/auth/login/verify");
});

it("shows the server's display-name rule next to the field", async () => {
  routes["POST /api/auth/register/options"] = {
    status: 400,
    body: { error: "invalid_display_name" },
  };
  render(<AccountPage />);
  const field = screen.getByLabelText("表示名");
  fireEvent.change(field, { target: { value: "‮abc" } });
  fireEvent.click(screen.getByRole("button", { name: "パスキーを作る" }));
  await waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
  const id = field.getAttribute("aria-describedby")!;
  expect(document.getElementById(id)!.textContent).toMatch(/1〜20文字/);
  expect(credentials.create).not.toHaveBeenCalled();
});

it("keeps new recovery codes on screen until the user confirms saving them", async () => {
  routes["POST /api/auth/register/options"] = { body: { challenge: "c" } };
  routes["POST /api/auth/register/verify"] = (body) => {
    expect(body).toEqual({ displayName: "たろう", response: { id: "new" } });
    signIn();
    return { body: { ...profile, recoveryCodes: codes } };
  };
  routes["GET /api/me"] = { body: profile };
  routes["GET /api/passkeys"] = { body: passkeys };
  render(<AccountPage />);
  fireEvent.change(screen.getByLabelText("表示名"), {
    target: { value: "たろう" },
  });
  fireEvent.click(screen.getByRole("button", { name: "パスキーを作る" }));
  await screen.findByRole("heading", { name: "回復コード" });
  const list = screen.getByRole("list", { name: "回復コード" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(10);
  expect(screen.getByRole("button", { name: "コピー" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "ファイルに保存" })).toBeTruthy();
  const next = screen.getByRole("button", {
    name: "次へ",
  }) as HTMLButtonElement;
  expect(next.disabled).toBe(true);
  fireEvent.click(next);
  expect(screen.getByRole("list", { name: "回復コード" })).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: /控えました/ }));
  expect(next.disabled).toBe(false);
  fireEvent.click(next);
  await screen.findByRole("heading", { name: "アカウント" });
  expect(screen.queryByRole("list", { name: "回復コード" })).toBeNull();
});

it("requires a new passkey after a recovery code before anything else", async () => {
  routes["POST /api/auth/recover"] = (body) => {
    expect(body).toEqual({ code: "aaaa-bbbb-cccc-dddd" });
    return {};
  };
  routes["POST /api/passkeys/register/options"] = [
    { body: { challenge: "c" } },
    { body: { challenge: "c" } },
  ];
  routes["POST /api/passkeys/register/verify"] = () => {
    signIn();
    return { body: profile };
  };
  render(<AccountPage />);
  fireEvent.click(screen.getByRole("button", { name: "回復コードで入る" }));
  fireEvent.change(screen.getByLabelText("回復コード"), {
    target: { value: "aaaa-bbbb-cccc-dddd" },
  });
  fireEvent.click(screen.getByRole("button", { name: "回復する" }));
  await screen.findByRole("heading", { name: "新しいパスキーを登録" });
  const main = screen.getByRole("main");
  expect(within(main).getAllByRole("button")).toHaveLength(1);
  expect(within(main).queryByRole("link")).toBeNull();
  expect(sessionStorage.getItem("account-recovering")).toBe("1");

  // Cancelling the prompt keeps the user on the same step.
  credentials.create.mockImplementationOnce(cancel);
  fireEvent.click(screen.getByRole("button", { name: "パスキーを登録" }));
  await waitFor(() => expect(credentials.create).toHaveBeenCalledTimes(1));
  await act(async () => {});
  expect(
    screen.getByRole("heading", { name: "新しいパスキーを登録" }),
  ).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "パスキーを登録" }));
  await screen.findByText(/回復コードを再発行/);
  expect(sessionStorage.getItem("account-recovering")).toBeNull();
  expect(
    screen.getByRole("button", { name: "回復コードを再発行" }),
  ).toBeTruthy();
});

it("resumes the passkey step when a recovery session is reloaded", async () => {
  sessionStorage.setItem("account-recovering", "1");
  render(<AccountPage />);
  expect(
    screen.getByRole("heading", { name: "新しいパスキーを登録" }),
  ).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});

it("reauthenticates on 403 and retries the reissue", async () => {
  signIn();
  routes["GET /api/me"] = { body: profile };
  routes["GET /api/passkeys"] = { body: passkeys };
  routes["POST /api/recovery-codes"] = [
    { status: 403, body: { error: "reauth_required" } },
    { body: { recoveryCodes: codes } },
  ];
  routes["POST /api/auth/reauth/options"] = { body: { challenge: "c" } };
  routes["POST /api/auth/reauth/verify"] = (body) => {
    expect(body).toEqual({ response: { id: "old" } });
    return {};
  };
  render(<AccountPage />);
  fireEvent.click(
    await screen.findByRole("button", { name: "回復コードを再発行" }),
  );
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "再発行する" }));
  await screen.findByRole("list", { name: "回復コード" });
  expect(
    calls.filter((call) => call === "POST /api/recovery-codes"),
  ).toHaveLength(2);
  expect(calls).toContain("POST /api/auth/reauth/verify");
});

it("keeps the account when reauthentication is cancelled", async () => {
  signIn();
  routes["GET /api/me"] = { body: profile };
  routes["GET /api/passkeys"] = { body: passkeys };
  routes["DELETE /api/me"] = {
    status: 403,
    body: { error: "reauth_required" },
  };
  routes["POST /api/auth/reauth/options"] = { body: { challenge: "c" } };
  credentials.get.mockImplementationOnce(cancel);
  render(<AccountPage />);
  fireEvent.click(
    await screen.findByRole("button", { name: "アカウントを削除" }),
  );
  const dialog = screen.getByRole("dialog");
  for (const item of ["受け取り記録", "フレンド", "パスキー", "回復コード"])
    expect(
      within(dialog).getAllByText(new RegExp(item)).length,
    ).toBeGreaterThan(0);
  fireEvent.click(within(dialog).getByRole("button", { name: "削除する" }));
  await waitFor(() => expect(credentials.get).toHaveBeenCalled());
  await act(async () => {});
  expect(screen.getByRole("heading", { name: "アカウント" })).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(calls.filter((call) => call === "DELETE /api/me")).toHaveLength(1);
});

it("does not offer deleting the last passkey", async () => {
  signIn();
  routes["GET /api/me"] = { body: { ...profile, passkeys: 1 } };
  routes["GET /api/passkeys"] = {
    body: { passkeys: passkeys.passkeys.slice(0, 1) },
  };
  render(<AccountPage />);
  const item = await screen.findByRole("listitem");
  expect(
    (within(item).getByRole("button", { name: /削除/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(screen.getByText(/最後の1本は削除できません/)).toBeTruthy();
});

it("returns to sign-in when the session has expired", async () => {
  signIn();
  routes["GET /api/me"] = { status: 401, body: { error: "unauthorized" } };
  routes["GET /api/passkeys"] = {
    status: 401,
    body: { error: "unauthorized" },
  };
  render(<AccountPage />);
  await screen.findByRole("button", { name: "パスキーでログイン" });
  expect(document.cookie).not.toContain("signed_in=1");
});

it("logs out", async () => {
  signIn();
  routes["GET /api/me"] = { body: profile };
  routes["GET /api/passkeys"] = { body: passkeys };
  routes["POST /api/auth/logout"] = () => {
    document.cookie = "signed_in=; Max-Age=0; Path=/";
    return {};
  };
  render(<AccountPage />);
  fireEvent.click(await screen.findByRole("button", { name: "ログアウト" }));
  await screen.findByRole("button", { name: "パスキーでログイン" });
});
