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
  expect(within(screen.getByRole("main")).queryByRole("button")).toBeNull();
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
  routes["GET /api/account"] = { body: { profile, ...passkeys } };
  render(<AccountPage />);
  fireEvent.change(screen.getByLabelText("表示名"), {
    target: { value: "たろう" },
  });
  fireEvent.click(screen.getByRole("button", { name: "パスキーを作る" }));
  const heading = await screen.findByRole("heading", { name: "回復コード" });
  // The page title is not drawn under a section rule.
  expect(heading.closest(".account-section")).toBeNull();
  const list = screen.getByRole("list", { name: "回復コード" });
  // list-style: none must not drop the list role in Safari.
  expect(list.getAttribute("role")).toBe("list");
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
  // Registering or giving up the recovery are the only ways on.
  expect(
    within(main)
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual(["パスキーを登録", "回復をやめてログインに戻る"]);
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
  routes["GET /api/account"] = { body: { profile, ...passkeys } };
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
  routes["GET /api/account"] = { body: { profile, ...passkeys } };
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
  fireEvent.click(within(dialog).getByRole("button", { name: "削除する" }));
  await waitFor(() => expect(credentials.get).toHaveBeenCalled());
  await act(async () => {});
  expect(screen.getByRole("heading", { name: "アカウント" })).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(calls.filter((call) => call === "DELETE /api/me")).toHaveLength(1);
});

it("does not offer deleting the last passkey", async () => {
  signIn();
  routes["GET /api/account"] = {
    body: {
      profile: { ...profile, passkeys: 1 },
      passkeys: passkeys.passkeys.slice(0, 1),
    },
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
  routes["GET /api/account"] = {
    status: 401,
    body: { error: "unauthorized" },
  };
  render(<AccountPage />);
  await screen.findByRole("button", { name: "パスキーでログイン" });
  expect(document.cookie).not.toContain("signed_in=1");
});

it("logs out", async () => {
  signIn();
  routes["GET /api/account"] = { body: { profile, ...passkeys } };
  routes["POST /api/auth/logout"] = () => {
    document.cookie = "signed_in=; Max-Age=0; Path=/";
    return {};
  };
  render(<AccountPage />);
  fireEvent.click(await screen.findByRole("button", { name: "ログアウト" }));
  await screen.findByRole("button", { name: "パスキーでログイン" });
});

it("lets a recovery that collides with a passkey on this device give up and sign in", async () => {
  sessionStorage.setItem("account-recovering", "1");
  routes["POST /api/passkeys/register/options"] = { body: { challenge: "c" } };
  routes["POST /api/auth/logout"] = {};
  routes["POST /api/auth/login/options"] = { body: { challenge: "c" } };
  routes["POST /api/auth/login/verify"] = () => {
    signIn();
    return { body: profile };
  };
  routes["GET /api/account"] = { body: { profile, ...passkeys } };
  credentials.create.mockImplementationOnce(() =>
    Promise.reject(new DOMException("", "InvalidStateError")),
  );
  render(<AccountPage />);
  expect(screen.getByText(/使った回復コードは戻りません/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "パスキーを登録" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "この端末にはこのアカウントのパスキーがすでにあります。回復をやめて、そのパスキーでログインしてください。",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "回復をやめてログインに戻る" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "パスキーでログイン" }),
  );
  expect(calls).toContain("POST /api/auth/logout");
  expect(sessionStorage.getItem("account-recovering")).toBeNull();
  await screen.findByRole("heading", { name: "アカウント" });
});

it("keeps the recovery step when giving up fails", async () => {
  sessionStorage.setItem("account-recovering", "1");
  routes["POST /api/auth/logout"] = {
    status: 503,
    body: { error: "api_disabled" },
  };
  render(<AccountPage />);
  fireEvent.click(
    screen.getByRole("button", { name: "回復をやめてログインに戻る" }),
  );
  await screen.findByRole("alert");
  expect(
    screen.getByRole("heading", { name: "新しいパスキーを登録" }),
  ).toBeTruthy();
  expect(sessionStorage.getItem("account-recovering")).toBe("1");
});

// Each switch replaces the button that was pressed, so focus moves to the
// new heading and screen readers announce it.
it("moves focus to the heading of each new screen", async () => {
  routes["POST /api/auth/register/options"] = { body: { challenge: "c" } };
  routes["POST /api/auth/register/verify"] = () => {
    signIn();
    return { body: { ...profile, recoveryCodes: codes } };
  };
  routes["GET /api/account"] = { body: { profile, ...passkeys } };
  routes["POST /api/auth/logout"] = () => {
    document.cookie = "signed_in=; Max-Age=0; Path=/";
    return {};
  };
  routes["POST /api/auth/recover"] = {};
  render(<AccountPage />);
  // Nothing is focused on load.
  expect(document.activeElement).toBe(document.body);
  fireEvent.change(screen.getByLabelText("表示名"), {
    target: { value: "たろう" },
  });
  fireEvent.click(screen.getByRole("button", { name: "パスキーを作る" }));
  const heading = (name: string) =>
    waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { name, level: 1 }),
      ),
    );
  await heading("回復コード");
  fireEvent.click(screen.getByRole("checkbox", { name: /控えました/ }));
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
  await heading("アカウント");
  fireEvent.click(await screen.findByRole("button", { name: "ログアウト" }));
  await heading("ログイン");
  fireEvent.click(screen.getByRole("button", { name: "回復コードで入る" }));
  await heading("回復コードで入る");
  fireEvent.change(screen.getByLabelText("回復コード"), {
    target: { value: "aaaa-bbbb-cccc-dddd" },
  });
  fireEvent.click(screen.getByRole("button", { name: "回復する" }));
  await heading("新しいパスキーを登録");
});

it("returns to the invitation after sign-in", async () => {
  const assign = vi.fn();
  vi.stubGlobal("location", {
    search: "?returnTo=%2Ffriends%2Finvite",
    origin: "http://localhost:3000",
    assign,
  });
  routes["POST /api/auth/login/options"] = { body: { challenge: "c" } };
  routes["POST /api/auth/login/verify"] = () => {
    signIn();
    return { body: profile };
  };
  render(<AccountPage />);
  fireEvent.click(screen.getByRole("button", { name: "パスキーでログイン" }));
  await waitFor(() => expect(assign).toHaveBeenCalledWith("/friends/invite"));
  expect(calls).not.toContain("GET /api/account");
});

it("returns after registration only when recovery codes have been saved", async () => {
  const assign = vi.fn();
  vi.stubGlobal("location", {
    search: "?returnTo=%2Ffriends%2Finvite",
    origin: "http://localhost:3000",
    assign,
  });
  routes["POST /api/auth/register/options"] = { body: { challenge: "c" } };
  routes["POST /api/auth/register/verify"] = () => {
    signIn();
    return { body: { ...profile, recoveryCodes: codes } };
  };
  render(<AccountPage />);
  fireEvent.change(screen.getByLabelText("表示名"), {
    target: { value: "たろう" },
  });
  fireEvent.click(screen.getByRole("button", { name: "パスキーを作る" }));
  await screen.findByRole("list", { name: "回復コード" });
  expect(assign).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox", { name: /控えました/ }));
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
  await waitFor(() => expect(assign).toHaveBeenCalledWith("/friends/invite"));
});

it("updates the header's account link after registering and logging out", async () => {
  routes["POST /api/auth/register/options"] = { body: { challenge: "c" } };
  routes["POST /api/auth/register/verify"] = () => {
    signIn();
    return { body: { ...profile, recoveryCodes: codes } };
  };
  routes["GET /api/account"] = { body: { profile, ...passkeys } };
  routes["POST /api/auth/logout"] = () => {
    document.cookie = "signed_in=; Max-Age=0; Path=/";
    return {};
  };
  render(<AccountPage />);
  const nav = screen.getByRole("navigation", { name: "メインナビゲーション" });
  expect(within(nav).getByRole("link", { name: "ログイン" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("表示名"), {
    target: { value: "たろう" },
  });
  fireEvent.click(screen.getByRole("button", { name: "パスキーを作る" }));
  await screen.findByRole("heading", { name: "回復コード" });
  expect(within(nav).getByRole("link", { name: "アカウント" })).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox", { name: /控えました/ }));
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
  fireEvent.click(await screen.findByRole("button", { name: "ログアウト" }));
  await screen.findByRole("button", { name: "パスキーでログイン" });
  expect(within(nav).getByRole("link", { name: "ログイン" })).toBeTruthy();
});

// The busy flag and the error line of each action. A dismissed passkey
// prompt goes back without an error; an action with no prompt reports the
// same exception as a failed request. No action moves focus itself: where
// it ends up after the pressed button was disabled is left to the browser.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const settle = () => act(async () => {});
// jsdom moves focus off a disabled button on its next rendering update, a
// 1/60 s timer, as browsers do on their next frame. Waiting for it while the
// button is held keeps the outcome from depending on how fast the action ends.
const dropsFocus = () =>
  waitFor(() => expect(document.activeElement).toBe(document.body));
const button = (name: string) =>
  screen.getByRole("button", { name }) as HTMLButtonElement;
const NETWORK = "通信できませんでした。接続を確かめてやり直してください。";
const TOO_MANY = "操作が多すぎます。しばらく待ってからやり直してください。";
const tooMany = { status: 429, body: { error: "too_many_requests" } };

it("holds both sign-in actions while the passkey prompt is open", async () => {
  routes["POST /api/auth/login/options"] = { body: { challenge: "c" } };
  const first = deferred<never>();
  credentials.get.mockImplementationOnce(() => first.promise);
  render(<AccountPage />);
  button("パスキーでログイン").focus();
  fireEvent.click(button("パスキーでログイン"));
  await waitFor(() => expect(credentials.get).toHaveBeenCalledTimes(1));
  expect(button("パスキーでログイン").disabled).toBe(true);
  expect(button("パスキーを作る").disabled).toBe(true);
  expect(button("回復コードで入る").disabled).toBe(false);
  await dropsFocus();

  first.reject(new DOMException("", "SecurityError"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe("このアドレスではパスキーを使えません。");
  expect(button("パスキーでログイン").disabled).toBe(false);
  expect(button("パスキーを作る").disabled).toBe(false);
  expect(document.activeElement).toBe(document.body);

  // A retry clears the error before the prompt returns.
  const second = deferred<never>();
  credentials.get.mockImplementationOnce(() => second.promise);
  fireEvent.click(button("パスキーでログイン"));
  await waitFor(() => expect(credentials.get).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("alert")).toBeNull();
  second.reject(new DOMException("", "AbortError"));
  await settle();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(button("パスキーでログイン").disabled).toBe(false);
  expect(document.activeElement).toBe(document.body);
});

it("keeps registration errors apart: none on cancel, a line for failures, the field for the name", async () => {
  routes["POST /api/auth/register/options"] = [
    { body: { challenge: "c" } },
    tooMany,
    { status: 400, body: { error: "invalid_display_name" } },
    tooMany,
  ];
  credentials.create.mockImplementationOnce(cancel);
  render(<AccountPage />);
  const field = screen.getByLabelText("表示名");
  fireEvent.change(field, { target: { value: "たろう" } });
  fireEvent.click(button("パスキーを作る"));
  await waitFor(() => expect(credentials.create).toHaveBeenCalledTimes(1));
  await settle();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(field.getAttribute("aria-invalid")).toBeNull();
  expect(button("パスキーを作る").disabled).toBe(false);
  expect(button("パスキーでログイン").disabled).toBe(false);
  expect(calls).not.toContain("POST /api/auth/register/verify");

  fireEvent.click(button("パスキーを作る"));
  expect((await screen.findByRole("alert")).textContent).toBe(TOO_MANY);
  expect(field.getAttribute("aria-invalid")).toBeNull();

  // The name rule replaces the line and is not announced as an alert.
  fireEvent.click(button("パスキーを作る"));
  await waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(button("パスキーを作る").disabled).toBe(false);

  fireEvent.click(button("パスキーを作る"));
  await screen.findByRole("alert");
  expect(field.getAttribute("aria-invalid")).toBeNull();
});

it("reports every failed recovery code next to the field, an aborted request included", async () => {
  routes["POST /api/auth/recover"] = {
    status: 400,
    body: { error: "invalid_code" },
  };
  render(<AccountPage />);
  fireEvent.click(button("回復コードで入る"));
  const field = screen.getByLabelText("回復コード");
  fireEvent.change(field, { target: { value: "aaaa-bbbb-cccc-dddd" } });
  // No passkey prompt here: the exception a dismissed prompt throws is a
  // failed request.
  const request = deferred<Response>();
  vi.mocked(fetch).mockImplementationOnce(() => request.promise);
  button("回復する").focus();
  fireEvent.click(button("回復する"));
  await settle();
  expect(button("回復する").disabled).toBe(true);
  expect(button("ログインに戻る").disabled).toBe(false);
  await dropsFocus();
  request.reject(new DOMException("", "AbortError"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe(NETWORK);
  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(field.getAttribute("aria-describedby")).toBe(alert.id);
  expect(button("回復する").disabled).toBe(false);
  expect(document.activeElement).toBe(document.body);
  expect(sessionStorage.getItem("account-recovering")).toBeNull();

  vi.mocked(fetch).mockImplementationOnce(cancel);
  fireEvent.click(button("回復する"));
  await settle();
  expect(screen.getByRole("alert").textContent).toBe(NETWORK);

  fireEvent.click(button("回復する"));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "回復コードが正しくないか、すでに使われています。",
    ),
  );
  expect(
    screen.getByRole("heading", { name: "回復コードで入る" }),
  ).toBeTruthy();
});

it("holds both recovery actions while one runs and reports an aborted logout", async () => {
  sessionStorage.setItem("account-recovering", "1");
  routes["POST /api/passkeys/register/options"] = [
    { body: { challenge: "c" } },
    tooMany,
  ];
  const prompt = deferred<never>();
  credentials.create.mockImplementationOnce(() => prompt.promise);
  render(<AccountPage />);
  const both = () => [
    button("パスキーを登録").disabled,
    button("回復をやめてログインに戻る").disabled,
  ];
  fireEvent.click(button("パスキーを登録"));
  await waitFor(() => expect(credentials.create).toHaveBeenCalledTimes(1));
  expect(both()).toEqual([true, true]);
  prompt.reject(new DOMException("", "NotAllowedError"));
  await settle();
  expect(both()).toEqual([false, false]);
  expect(screen.queryByRole("alert")).toBeNull();

  fireEvent.click(button("パスキーを登録"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe(TOO_MANY);
  expect(both()).toEqual([false, false]);

  // Giving up has no passkey prompt.
  const request = deferred<Response>();
  vi.mocked(fetch).mockImplementationOnce(() => request.promise);
  fireEvent.click(button("回復をやめてログインに戻る"));
  await settle();
  expect(both()).toEqual([true, true]);
  expect(screen.queryByRole("alert")).toBeNull();
  request.reject(new DOMException("", "NotAllowedError"));
  expect((await screen.findByRole("alert")).textContent).toBe(NETWORK);
  expect(both()).toEqual([false, false]);
  expect(sessionStorage.getItem("account-recovering")).toBe("1");
});

it("returns to sign-in with a notice when the recovery session has expired", async () => {
  sessionStorage.setItem("account-recovering", "1");
  routes["POST /api/passkeys/register/options"] = {
    status: 401,
    body: { error: "unauthorized" },
  };
  render(<AccountPage />);
  fireEvent.click(button("パスキーを登録"));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "回復の期限（15分）が切れました。別の回復コードでやり直してください。",
  );
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(button("パスキーでログイン")).toBeTruthy();
  expect(sessionStorage.getItem("account-recovering")).toBeNull();
});

it("offers the reissue after recovery: no error on cancel, a line for failures", async () => {
  sessionStorage.setItem("account-recovering", "1");
  routes["POST /api/passkeys/register/options"] = { body: { challenge: "c" } };
  routes["POST /api/passkeys/register/verify"] = () => {
    signIn();
    return { body: profile };
  };
  routes["POST /api/recovery-codes"] = [
    { status: 403, body: { error: "reauth_required" } },
    tooMany,
    { body: { recoveryCodes: codes } },
  ];
  routes["POST /api/auth/reauth/options"] = { body: { challenge: "c" } };
  const prompt = deferred<never>();
  credentials.get.mockImplementationOnce(() => prompt.promise);
  render(<AccountPage />);
  fireEvent.click(button("パスキーを登録"));
  const heading = await screen.findByRole("heading", {
    name: "パスキーを登録しました",
  });
  // The switch focuses the heading in an effect; let it run before focusing
  // the button, or it takes the focus back.
  await waitFor(() => expect(document.activeElement).toBe(heading));
  button("回復コードを再発行").focus();
  fireEvent.click(button("回復コードを再発行"));
  await waitFor(() => expect(credentials.get).toHaveBeenCalledTimes(1));
  expect(button("回復コードを再発行").disabled).toBe(true);
  // Skipping stays possible while the prompt is open.
  expect(button("あとで").disabled).toBe(false);
  await dropsFocus();
  prompt.reject(new DOMException("", "NotAllowedError"));
  await settle();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(button("回復コードを再発行").disabled).toBe(false);
  expect(document.activeElement).toBe(document.body);

  fireEvent.click(button("回復コードを再発行"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe(TOO_MANY);
  expect(button("回復コードを再発行").disabled).toBe(false);

  fireEvent.click(button("回復コードを再発行"));
  await screen.findByRole("list", { name: "回復コード" });
});

const settingsRoutes = () => {
  signIn();
  routes["GET /api/account"] = { body: { profile, ...passkeys } };
};
const settingsActions = [
  "変更する",
  "パスキーを追加",
  "回復コードを再発行",
  "ログアウト",
  "アカウントを削除",
];

it("reads the settings with one request", async () => {
  settingsRoutes();
  render(<AccountPage />);
  await screen.findByRole("button", { name: "回復コードを再発行" });
  expect(calls.filter((call) => call.startsWith("GET "))).toEqual([
    "GET /api/account",
  ]);
});

it("holds the account actions while a passkey is added and announces the result", async () => {
  settingsRoutes();
  routes["POST /api/passkeys/register/options"] = [
    { body: { challenge: "c" } },
    { body: { challenge: "c" } },
    { status: 400, body: { error: "passkey_limit" } },
  ];
  routes["POST /api/passkeys/register/verify"] = { body: profile };
  const prompt = deferred<never>();
  credentials.create.mockImplementationOnce(() => prompt.promise);
  render(<AccountPage />);
  await screen.findByRole("button", { name: "パスキーを追加" });
  const status = screen.getByRole("status");
  const disabled = () => [
    ...settingsActions.map((name) => button(name).disabled),
    ...screen
      .getAllByRole("button", { name: "削除" })
      .map((item) => (item as HTMLButtonElement).disabled),
  ];
  const all = (value: boolean) => Array<boolean>(7).fill(value);
  expect(disabled()).toEqual(all(false));
  button("パスキーを追加").focus();
  fireEvent.click(button("パスキーを追加"));
  await waitFor(() => expect(credentials.create).toHaveBeenCalledTimes(1));
  expect(disabled()).toEqual(all(true));
  // Opening a name form sends nothing.
  for (const item of screen.getAllByRole("button", { name: "名前を変更" }))
    expect((item as HTMLButtonElement).disabled).toBe(false);
  await dropsFocus();
  prompt.reject(new DOMException("", "NotAllowedError"));
  await settle();
  expect(disabled()).toEqual(all(false));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(status.textContent).toBe("");
  expect(document.activeElement).toBe(document.body);

  fireEvent.click(button("パスキーを追加"));
  await waitFor(() =>
    expect(status.textContent).toBe("パスキーを追加しました。"),
  );
  expect(screen.getByRole("status")).toBe(status);
  expect(calls.filter((call) => call === "GET /api/account")).toHaveLength(2);
  expect(document.activeElement).toBe(document.body);

  // A failure replaces the announcement with the error line above it.
  fireEvent.click(button("パスキーを追加"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe(
    "パスキーは10本まで登録できます。使っていないものを削除してから追加してください。",
  );
  expect(alert.nextElementSibling).toBe(status);
  expect(status.textContent).toBe("");
});

it("renames a passkey in place and shows the server's rule next to the field", async () => {
  settingsRoutes();
  routes["GET /api/account"] = [
    { body: { profile, ...passkeys } },
    {
      body: {
        profile,
        passkeys: [
          { ...passkeys.passkeys[0], label: "スマホ" },
          passkeys.passkeys[1],
        ],
      },
    },
  ];
  routes["PATCH /api/passkeys/p1"] = [
    { status: 400, body: { error: "invalid_label" } },
    (body) => {
      expect(body).toEqual({ label: "スマホ" });
      return {};
    },
  ];
  render(<AccountPage />);
  const list = await screen.findByRole("list", { name: "パスキー" });
  const [first, second] = within(list).getAllByRole("listitem");
  expect(first.textContent).toContain("パスキー 1");
  expect(first.textContent).toContain("未使用");
  expect(second.querySelector(".passkey-dates")!.textContent).toBe(
    "登録 1970/01/01・最後の使用 1970/01/01",
  );
  fireEvent.click(within(second).getByRole("button", { name: "名前を変更" }));
  fireEvent.click(within(second).getByRole("button", { name: "やめる" }));
  expect(within(second).queryByRole("textbox")).toBeNull();

  fireEvent.click(within(first).getByRole("button", { name: "名前を変更" }));
  const field = within(first).getByLabelText(
    "パスキーの名前",
  ) as HTMLInputElement;
  expect(field.value).toBe("パスキー 1");
  expect(field.getAttribute("aria-describedby")).toBeNull();
  // The other passkey keeps its own actions.
  expect(within(second).getByRole("button", { name: "削除" })).toBeTruthy();
  fireEvent.change(field, { target: { value: "‮abc" } });
  fireEvent.click(within(first).getByRole("button", { name: "保存" }));
  await waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
  const rule = document.getElementById(
    field.getAttribute("aria-describedby")!,
  )!;
  expect(rule.textContent).toMatch(/1〜30文字/);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(within(first).getByRole("textbox")).toBe(field);

  // Reopening the form drops the old rule.
  fireEvent.click(within(first).getByRole("button", { name: "やめる" }));
  fireEvent.click(within(first).getByRole("button", { name: "名前を変更" }));
  const again = within(first).getByLabelText("パスキーの名前");
  expect(again.getAttribute("aria-invalid")).toBeNull();
  fireEvent.change(again, { target: { value: "スマホ" } });
  fireEvent.click(within(first).getByRole("button", { name: "保存" }));
  await waitFor(() => expect(first.textContent).toContain("スマホ"));
  expect(within(first).queryByRole("textbox")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("");
});

it("names the passkey in its dialog, closes the dialog either way, and announces the removal", async () => {
  settingsRoutes();
  routes["DELETE /api/passkeys/p2"] = [
    { status: 400, body: { error: "last_passkey" } },
    {},
  ];
  render(<AccountPage />);
  const list = await screen.findByRole("list", { name: "パスキー" });
  const remove = () =>
    within(within(list).getAllByRole("listitem")[1]).getByRole("button", {
      name: "削除",
    });
  const dialogs = () =>
    [...document.querySelectorAll("dialog")].map((dialog) => dialog.open);
  expect(dialogs()).toEqual([false, false, false]);
  fireEvent.click(remove());
  expect(dialogs()).toEqual([true, false, false]);
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("heading").textContent).toBe(
    "パスキーを削除",
  );
  expect(dialog.querySelector("p")!.textContent).toBe(
    "「パスキー 2」をこのアカウントから外します。端末やパスワード管理ツールに残ったパスキーは、そちらで削除してください。",
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "やめる" }));
  expect(dialogs()).toEqual([false, false, false]);
  expect(calls).not.toContain("DELETE /api/passkeys/p2");

  fireEvent.click(remove());
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "削除する",
    }),
  );
  expect((await screen.findByRole("alert")).textContent).toBe(
    "最後の1本のパスキーは削除できません。",
  );
  // The dialog closes in an effect, which React may run after the commit
  // that shows the result.
  await waitFor(() => expect(dialogs()).toEqual([false, false, false]));

  fireEvent.click(remove());
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "削除する",
    }),
  );
  const status = screen.getByRole("status");
  await waitFor(() =>
    expect(status.textContent).toBe("パスキーを削除しました。"),
  );
  expect(screen.queryByRole("alert")).toBeNull();
  await waitFor(() => expect(dialogs()).toEqual([false, false, false]));
  expect(calls.filter((call) => call === "GET /api/account")).toHaveLength(2);
});

it("opens one dialog at a time for the reissue and the deletion", async () => {
  settingsRoutes();
  render(<AccountPage />);
  const dialogs = () =>
    [...document.querySelectorAll("dialog")].map((dialog) => dialog.open);
  fireEvent.click(
    await screen.findByRole("button", { name: "回復コードを再発行" }),
  );
  expect(dialogs()).toEqual([false, true, false]);
  const reissue = screen.getByRole("dialog");
  fireEvent.click(within(reissue).getByRole("button", { name: "やめる" }));
  fireEvent.click(button("アカウントを削除"));
  expect(dialogs()).toEqual([false, false, true]);
  const removal = screen.getByRole("dialog");
  expect(
    within(removal)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual([
    "回収の記録とメモ",
    "フレンド関係・申請・ブロック",
    "登録したパスキー",
    "回復コード",
  ]);
  // The dialogs follow the page's sections.
  expect(document.querySelector(".account-page > :last-child")!.tagName).toBe(
    "DIALOG",
  );
});

it("announces a new display name and keeps the name rule out of the error line", async () => {
  settingsRoutes();
  routes["PATCH /api/me"] = [
    { status: 400, body: { error: "invalid_display_name" } },
    (body) => {
      expect(body).toEqual({ displayName: "はなこ" });
      return { body: { ...profile, displayName: "はなこ" } };
    },
  ];
  render(<AccountPage />);
  const field = await screen.findByLabelText("表示名");
  const hint = field.getAttribute("aria-describedby")!;
  expect(document.getElementById(hint)!.textContent).toBe(
    "フレンドに表示します。",
  );
  fireEvent.change(field, { target: { value: "‮abc" } });
  fireEvent.click(button("変更する"));
  await waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
  expect(
    document.getElementById(field.getAttribute("aria-describedby")!)!
      .textContent,
  ).toMatch(/1〜20文字/);
  expect(document.getElementById(hint)).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("");

  fireEvent.change(field, { target: { value: "はなこ" } });
  fireEvent.click(button("変更する"));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe(
      "表示名を変更しました。",
    ),
  );
  expect(field.getAttribute("aria-invalid")).toBeNull();
});

it("moves a recovery session that reaches the account screen to the passkey step", async () => {
  signIn();
  const recovery = { status: 403, body: { error: "recovery_session" } };
  routes["GET /api/account"] = recovery;
  render(<AccountPage />);
  await screen.findByRole("heading", { name: "新しいパスキーを登録" });
  expect(sessionStorage.getItem("account-recovering")).toBe("1");
  expect(screen.queryByRole("alert")).toBeNull();
});
