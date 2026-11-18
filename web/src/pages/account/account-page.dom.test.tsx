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
import { RecoveryCodes } from "./recovery-codes";
import { forgetSignedIn } from "../../shared/browser/signed-in";

// The API takes JSON only: any other body fails the test.
function jsonBody(body: BodyInit) {
  if (typeof body !== "string") throw new Error("body is not JSON text");
  return body;
}

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
// As the Worker answers them: the Signal API takes no other RP ID or user.
const account = { rpId: "manhole-techo.com", userId: "dXNlci0x" };
const profile = {
  displayName: "たろう",
  passkeys: 2,
  recoveryCodesRemaining: 9,
  ...account,
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
        init?.body == null ? undefined : JSON.parse(jsonBody(init.body)),
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
  // As a logout: nothing read for this test's user stays for the next.
  forgetSignedIn();
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  document.cookie = "recovery_mark=; Max-Age=0; Path=/";
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// The session a registration begins in these tests: its answer names the
// mark the Worker set in the cookies with it.
const MARK = "m1";
const begun = { sessionMark: MARK };
const signIn = () => {
  document.cookie = "signed_in=1; Path=/";
  document.cookie = `session_mark=${MARK}; Path=/`;
};
// This tab's recovery, as the Worker names it (`recoveryMark`) in the
// answer and in the `recovery_mark` cookie with the recovery session.
const RECOVERY = "ra";
const inRecovery = () => {
  sessionStorage.setItem("account-recovering", RECOVERY);
  document.cookie = `recovery_mark=${RECOVERY}; Path=/`;
};

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
  fireEvent.click(screen.getByRole("button", { name: "アカウントを作る" }));
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
    return { body: { ...profile, recoveryCodes: codes, ...begun } };
  };
  routes["GET /api/account"] = { body: { profile, ...passkeys } };
  render(<AccountPage />);
  // PR-7: the terms are reachable before registering.
  expect(
    screen
      .getByRole("link", { name: "規約とプライバシーポリシー" })
      .getAttribute("href"),
  ).toBe("/terms");
  fireEvent.change(screen.getByLabelText("表示名"), {
    target: { value: "たろう" },
  });
  fireEvent.click(screen.getByRole("button", { name: "アカウントを作る" }));
  const heading = await screen.findByRole("heading", { name: "回復コード" });
  // The sign-in screen no longer warns: the codes screen is where it counts.
  expect(
    screen.getByText(/両方失うと、アカウントを復旧できません/),
  ).toBeTruthy();
  // The page title is not drawn under a section rule.
  expect(heading.closest(".account-section")).toBeNull();
  const list = screen.getByRole("list", { name: "回復コード" });
  // list-style: none must not drop the list role in Safari.
  expect(list.getAttribute("role")).toBe("list");
  expect(within(list).getAllByRole("listitem")).toHaveLength(10);
  expect(screen.getByRole("button", { name: "コピー" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "ファイルに保存" })).toBeTruthy();
  const next = screen.getByRole<HTMLButtonElement>("button", {
    name: "次へ",
  });
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
    document.cookie = `recovery_mark=${RECOVERY}; Path=/`;
    return { body: { ok: true, recoveryMark: RECOVERY } };
  };
  routes["POST /api/passkeys/register/options"] = [
    { body: { challenge: "c" } },
    { body: { challenge: "c" } },
  ];
  routes["POST /api/passkeys/register/verify"] = () => {
    signIn();
    return { body: { ...profile, ...begun } };
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
  expect(sessionStorage.getItem("account-recovering")).toBe(RECOVERY);

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
  inRecovery();
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
    within(item).getByRole<HTMLButtonElement>("button", { name: /削除/ })
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

// Another tab signed B in while A's read was on its way, and the read came
// back before this page noticed the return.
it.each<[string, Reply]>([
  ["an answer", { body: { profile, ...passkeys } }],
  ["a failure", { status: 500, body: { error: "internal" } }],
  ["a 401", { status: 401, body: { error: "unauthorized" } }],
])("drops %s read for the user before another signed in", async (_, reply) => {
  signIn();
  document.cookie = "session_mark=aaaa; Path=/";
  const behind = deferred<void>();
  routes["GET /api/account"] = {
    body: { profile: { ...profile, displayName: "はなこ" }, ...passkeys },
  };
  vi.mocked(fetch).mockImplementationOnce(async () => {
    await behind.promise;
    return new Response(JSON.stringify(reply.body), {
      status: reply.status ?? 200,
    });
  });
  render(<AccountPage />);
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  document.cookie = "session_mark=bbbb; Path=/";
  await act(async () => behind.resolve());
  expect(screen.queryByDisplayValue("たろう")).toBeNull();
  expect(await screen.findByDisplayValue("はなこ")).toBeTruthy();
  expect(screen.queryByDisplayValue("たろう")).toBeNull();
  expect(document.cookie).toContain("signed_in=1");
  expect(document.cookie).toContain("session_mark=bbbb");
  document.cookie = "session_mark=; Max-Age=0; Path=/";
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
  inRecovery();
  routes["POST /api/passkeys/register/options"] = { body: { challenge: "c" } };
  // As the Worker's: the recovery's name goes with its session (AU-6).
  routes["POST /api/auth/logout"] = () => {
    document.cookie = "recovery_mark=; Max-Age=0; Path=/";
    return {};
  };
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
  const login = await screen.findByRole("button", {
    name: "パスキーでログイン",
  });
  // Given up as asked, not ended as replaced by another tab's recovery.
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(login);
  expect(calls).toContain("POST /api/auth/logout");
  expect(sessionStorage.getItem("account-recovering")).toBeNull();
  await screen.findByRole("heading", { name: "アカウント" });
});

it("keeps the recovery step when giving up fails", async () => {
  inRecovery();
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
  expect(sessionStorage.getItem("account-recovering")).toBe(RECOVERY);
});

// Each switch replaces the button that was pressed, so focus moves to the
// new heading and screen readers announce it.
it("moves focus to the heading of each new screen", async () => {
  routes["POST /api/auth/register/options"] = { body: { challenge: "c" } };
  routes["POST /api/auth/register/verify"] = () => {
    signIn();
    return { body: { ...profile, recoveryCodes: codes, ...begun } };
  };
  routes["GET /api/account"] = { body: { profile, ...passkeys } };
  routes["POST /api/auth/logout"] = () => {
    document.cookie = "signed_in=; Max-Age=0; Path=/";
    return {};
  };
  routes["POST /api/auth/recover"] = () => {
    document.cookie = `recovery_mark=${RECOVERY}; Path=/`;
    return { body: { ok: true, recoveryMark: RECOVERY } };
  };
  render(<AccountPage />);
  // Nothing is focused on load.
  expect(document.activeElement).toBe(document.body);
  fireEvent.change(screen.getByLabelText("表示名"), {
    target: { value: "たろう" },
  });
  fireEvent.click(screen.getByRole("button", { name: "アカウントを作る" }));
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
    return { body: { ...profile, recoveryCodes: codes, ...begun } };
  };
  render(<AccountPage />);
  fireEvent.change(screen.getByLabelText("表示名"), {
    target: { value: "たろう" },
  });
  fireEvent.click(screen.getByRole("button", { name: "アカウントを作る" }));
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
    return { body: { ...profile, recoveryCodes: codes, ...begun } };
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
  fireEvent.click(screen.getByRole("button", { name: "アカウントを作る" }));
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
  screen.getByRole<HTMLButtonElement>("button", { name });
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
  expect(button("アカウントを作る").disabled).toBe(true);
  expect(button("回復コードで入る").disabled).toBe(false);
  await dropsFocus();

  first.reject(new DOMException("", "SecurityError"));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toBe("このアドレスではパスキーを使えません。");
  expect(button("パスキーでログイン").disabled).toBe(false);
  expect(button("アカウントを作る").disabled).toBe(false);
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
  fireEvent.click(button("アカウントを作る"));
  await waitFor(() => expect(credentials.create).toHaveBeenCalledTimes(1));
  await settle();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(field.getAttribute("aria-invalid")).toBeNull();
  expect(button("アカウントを作る").disabled).toBe(false);
  expect(button("パスキーでログイン").disabled).toBe(false);
  expect(calls).not.toContain("POST /api/auth/register/verify");

  fireEvent.click(button("アカウントを作る"));
  expect((await screen.findByRole("alert")).textContent).toBe(TOO_MANY);
  expect(field.getAttribute("aria-invalid")).toBeNull();

  // The name rule replaces the line and is not announced as an alert.
  fireEvent.click(button("アカウントを作る"));
  await waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(button("アカウントを作る").disabled).toBe(false);

  fireEvent.click(button("アカウントを作る"));
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
  inRecovery();
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
  expect(sessionStorage.getItem("account-recovering")).toBe(RECOVERY);
});

it("returns to sign-in with a notice when the recovery session has expired", async () => {
  inRecovery();
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
  inRecovery();
  routes["POST /api/passkeys/register/options"] = { body: { challenge: "c" } };
  routes["POST /api/passkeys/register/verify"] = () => {
    signIn();
    return { body: { ...profile, ...begun } };
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
  const field =
    within(first).getByLabelText<HTMLInputElement>("パスキーの名前");
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
    "入手の記録とメモ",
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

// The settings' read is refused as a recovery's: another tab entered a
// recovery code, as `recovery_mark` names it. This tab never began that
// recovery, so the refusal only closes the settings: it does not make this
// tab the recovery's step, which could register a passkey or give it up.
it("closes the settings on a recovery's refusal without taking the recovery as this tab's", async () => {
  signIn();
  document.cookie = `recovery_mark=${RECOVERY}; Path=/`;
  routes["GET /api/account"] = {
    status: 403,
    body: { error: "recovery_session" },
  };
  render(<AccountPage />);
  expect((await screen.findByRole("alert")).textContent).toBe(
    "回復の途中のセッションになっているため、設定を閉じました。回復を始めたタブで続けるか、パスキーでログインするか、回復コードで入り直してください。",
  );
  expect(
    screen.getByRole("button", { name: "パスキーでログイン" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "新しいパスキーを登録" }),
  ).toBeNull();
  expect(sessionStorage.getItem("account-recovering")).toBeNull();
  // A recovery session has no display cookies (AU-9): the ones left are
  // not a session's.
  expect(document.cookie).not.toContain("signed_in=1");
  expect(calls).toEqual(["GET /api/account"]);
});

// The browser's own bubble ("このフィールドを入力してください") is not the
// app's: an empty field is reported in the page, next to the field.
it("reports an empty display name in the page when registering", async () => {
  render(<AccountPage />);
  const field = screen.getByLabelText("表示名");
  fireEvent.change(field, { target: { value: "　 " } });
  fireEvent.click(button("アカウントを作る"));
  await waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
  expect(
    document.getElementById(field.getAttribute("aria-describedby")!)!
      .textContent,
  ).toBe("表示名を入力してください。");
  expect(document.activeElement).toBe(field);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.change(field, { target: { value: "た" } });
  expect(field.getAttribute("aria-invalid")).toBeNull();
});

it("reports an empty recovery code in the page without spending a request", async () => {
  render(<AccountPage />);
  fireEvent.click(button("回復コードで入る"));
  const field = screen.getByLabelText("回復コード");
  fireEvent.click(button("回復する"));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "回復コードを入力してください。",
  );
  expect(document.activeElement).toBe(field);
  expect(fetch).not.toHaveBeenCalled();
});

it("reports an emptied display name in the settings without sending it", async () => {
  settingsRoutes();
  render(<AccountPage />);
  const field = await screen.findByLabelText("表示名");
  fireEvent.change(field, { target: { value: "" } });
  fireEvent.click(button("変更する"));
  await waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
  expect(
    document.getElementById(field.getAttribute("aria-describedby")!)!
      .textContent,
  ).toBe("表示名を入力してください。");
  expect(calls).not.toContain("PATCH /api/me");
});

// The WebAuthn Signal API: what the passkey manager is told. The other
// tests run as a browser without it (Firefox) and never call it.
function signals() {
  const api = {
    parseCreationOptionsFromJSON: (options: unknown) => options,
    parseRequestOptionsFromJSON: (options: unknown) => options,
    signalUnknownCredential: vi.fn<(options: unknown) => Promise<void>>(
      async () => {},
    ),
    signalAllAcceptedCredentials: vi.fn<(options: unknown) => Promise<void>>(
      async () => {},
    ),
    signalCurrentUserDetails: vi.fn<(options: unknown) => Promise<void>>(
      async () => {},
    ),
  };
  vi.stubGlobal("PublicKeyCredential", api);
  return api;
}
const loginOptions = { body: { challenge: "c", rpId: account.rpId } };
const creationOptions = {
  body: { challenge: "c", rp: { id: account.rpId, name: "rp" } },
};

it("has the manager drop a passkey the server does not know, at sign-in only", async () => {
  const api = signals();
  const unknown = { status: 404, body: { error: "unknown_credential" } };
  routes["POST /api/auth/login/options"] = loginOptions;
  routes["POST /api/auth/login/verify"] = [
    { status: 400, body: { error: "invalid_credential" } },
    // An API that is not there (a preview) is not a missing passkey.
    { status: 404, body: { error: "not_found" } },
    unknown,
  ];
  render(<AccountPage />);
  fireEvent.click(button("パスキーでログイン"));
  await screen.findByRole("alert");
  fireEvent.click(button("パスキーでログイン"));
  await waitFor(() => expect(calls).toHaveLength(4));
  await screen.findByRole("alert");
  expect(api.signalUnknownCredential).not.toHaveBeenCalled();

  fireEvent.click(button("パスキーでログイン"));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe(
      "このパスキーは登録されていません。削除したパスキーかもしれません。別のパスキーで試してください。",
    ),
  );
  expect(api.signalUnknownCredential.mock.calls).toEqual([
    [{ rpId: account.rpId, credentialId: "old" }],
  ]);
  expect(button("パスキーでログイン").disabled).toBe(false);
});

it("tells a signed-in user of a deleted passkey without signalling", async () => {
  const api = signals();
  settingsRoutes();
  routes["POST /api/recovery-codes"] = {
    status: 403,
    body: { error: "reauth_required" },
  };
  routes["POST /api/auth/reauth/options"] = loginOptions;
  routes["POST /api/auth/reauth/verify"] = {
    status: 404,
    body: { error: "unknown_credential" },
  };
  render(<AccountPage />);
  fireEvent.click(
    await screen.findByRole("button", { name: "回復コードを再発行" }),
  );
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "再発行する",
    }),
  );
  expect((await screen.findByRole("alert")).textContent).toMatch(
    /^このパスキーは登録されていません。/,
  );
  expect(api.signalUnknownCredential).not.toHaveBeenCalled();
});

it("has the manager drop a new passkey only when the server refused it", async () => {
  const api = signals();
  routes["POST /api/auth/register/options"] = creationOptions;
  routes["POST /api/auth/register/verify"] = [
    // Unknown outcome: the account may exist, and the passkey is its key.
    { status: 500, body: { error: "internal" } },
    { status: 429, body: { error: "registration_paused" } },
  ];
  render(<AccountPage />);
  fireEvent.change(screen.getByLabelText("表示名"), {
    target: { value: "たろう" },
  });
  fireEvent.click(button("アカウントを作る"));
  await screen.findByRole("alert");
  expect(api.signalUnknownCredential).not.toHaveBeenCalled();
  fireEvent.click(button("アカウントを作る"));
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toMatch(/^新しい登録が集中/),
  );
  expect(api.signalUnknownCredential.mock.calls).toEqual([
    [{ rpId: account.rpId, credentialId: "new" }],
  ]);
});

it("keeps a passkey added after a reauthentication, and drops one whose reauthentication is refused", async () => {
  const api = signals();
  settingsRoutes();
  const reauth = { status: 403, body: { error: "reauth_required" } };
  routes["POST /api/passkeys/register/options"] = creationOptions;
  routes["POST /api/passkeys/register/verify"] = [
    reauth,
    { body: profile },
    reauth,
  ];
  routes["POST /api/auth/reauth/options"] = loginOptions;
  routes["POST /api/auth/reauth/verify"] = [
    {},
    { status: 400, body: { error: "invalid_credential" } },
  ];
  render(<AccountPage />);
  fireEvent.click(
    await screen.findByRole("button", { name: "パスキーを追加" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe(
      "パスキーを追加しました。",
    ),
  );
  expect(api.signalUnknownCredential).not.toHaveBeenCalled();

  fireEvent.click(button("パスキーを追加"));
  await screen.findByRole("alert");
  expect(api.signalUnknownCredential.mock.calls).toEqual([
    [{ rpId: account.rpId, credentialId: "new" }],
  ]);
});

it("tells the manager the passkeys and the name of the account as the settings read them", async () => {
  const api = signals();
  // A refusal by the manager is not the page's failure.
  api.signalAllAcceptedCredentials.mockRejectedValue(new Error("refused"));
  api.signalCurrentUserDetails.mockImplementation(() => {
    throw new TypeError("refused");
  });
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  settingsRoutes();
  routes["GET /api/account"] = [
    { body: { profile, ...passkeys } },
    { body: { profile, passkeys: [passkeys.passkeys[0]] } },
  ];
  routes["DELETE /api/passkeys/p2"] = {};
  render(<AccountPage />);
  const list = await screen.findByRole("list", { name: "パスキー" });
  expect(api.signalAllAcceptedCredentials.mock.calls).toEqual([
    [{ ...account, allAcceptedCredentialIds: ["p1", "p2"] }],
  ]);
  // The passkeys made before the name was theirs take it now.
  expect(api.signalCurrentUserDetails.mock.calls).toEqual([
    [{ ...account, name: "たろう", displayName: "たろう" }],
  ]);
  await waitFor(() => expect(warn).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("alert")).toBeNull();

  fireEvent.click(
    within(within(list).getAllByRole("listitem")[1]).getByRole("button", {
      name: "削除",
    }),
  );
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "削除する",
    }),
  );
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe(
      "パスキーを削除しました。",
    ),
  );
  expect(api.signalAllAcceptedCredentials.mock.lastCall).toEqual([
    { ...account, allAcceptedCredentialIds: ["p1"] },
  ]);
  warn.mockRestore();
});

it("never tells the manager a list read before a passkey was added", async () => {
  const api = signals();
  settingsRoutes();
  render(<AccountPage />);
  await screen.findByRole("button", { name: "パスキーを追加" });
  cleanup();
  api.signalAllAcceptedCredentials.mockClear();

  // Back on the settings: what was read is drawn, and read again behind.
  const behind = deferred<Reply>();
  const added = {
    profile: { ...profile, passkeys: 3 },
    passkeys: [
      ...passkeys.passkeys,
      { id: "new", label: "パスキー 3", createdAt: 0, lastUsedAt: null },
    ],
  };
  const read = vi.fn<() => Reply | Promise<Reply>>(() => ({ body: added }));
  read.mockImplementationOnce(() => behind.promise);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method !== "GET") return serve(method, path, undefined);
      calls.push("GET " + path);
      return new Response(JSON.stringify((await read()).body));
    }),
  );
  routes["POST /api/passkeys/register/options"] = creationOptions;
  routes["POST /api/passkeys/register/verify"] = { body: added.profile };
  render(<AccountPage />);
  fireEvent.click(button("パスキーを追加"));
  await waitFor(() =>
    expect(calls).toContain("POST /api/passkeys/register/verify"),
  );
  await settle();
  // The read from before the passkey existed answers only now.
  behind.resolve({ body: { profile, ...passkeys } });
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe(
      "パスキーを追加しました。",
    ),
  );
  expect(read).toHaveBeenCalledTimes(2);
  for (const [options] of api.signalAllAcceptedCredentials.mock.calls)
    expect(options).toEqual({
      ...account,
      allAcceptedCredentialIds: ["p1", "p2", "new"],
    });
  expect(api.signalAllAcceptedCredentials).toHaveBeenCalled();
  expect(
    within(screen.getByRole("list", { name: "パスキー" })).getAllByRole(
      "listitem",
    ),
  ).toHaveLength(3);
});

it("sends no read once the settings are left while an earlier read is awaited", async () => {
  settingsRoutes();
  render(<AccountPage />);
  await screen.findByRole("button", { name: "パスキーを追加" });
  cleanup();

  const behind = deferred<Reply>();
  const read = vi.fn<() => Reply | Promise<Reply>>(() => ({
    body: { profile, ...passkeys },
  }));
  read.mockImplementationOnce(() => behind.promise);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method !== "GET") return serve(method, path, undefined);
      calls.push("GET " + path);
      return new Response(JSON.stringify((await read()).body));
    }),
  );
  routes["POST /api/passkeys/register/options"] = creationOptions;
  routes["POST /api/passkeys/register/verify"] = { body: profile };
  render(<AccountPage />);
  fireEvent.click(button("パスキーを追加"));
  await waitFor(() =>
    expect(calls).toContain("POST /api/passkeys/register/verify"),
  );
  await settle();
  // The read after the addition waits on the one behind; the screen goes.
  cleanup();
  behind.resolve({ body: { profile, ...passkeys } });
  await settle();
  expect(read).toHaveBeenCalledTimes(1);
});

it("renames the passkeys in the manager with the display name", async () => {
  const api = signals();
  settingsRoutes();
  routes["PATCH /api/me"] = [
    { status: 400, body: { error: "invalid_display_name" } },
    { body: { ...profile, displayName: "はなこ" } },
  ];
  render(<AccountPage />);
  const field = await screen.findByLabelText("表示名");
  api.signalCurrentUserDetails.mockClear();
  fireEvent.change(field, { target: { value: " はなこ " } });
  fireEvent.click(button("変更する"));
  await waitFor(() => expect(field.getAttribute("aria-invalid")).toBe("true"));
  expect(api.signalCurrentUserDetails).not.toHaveBeenCalled();
  fireEvent.click(button("変更する"));
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe(
      "表示名を変更しました。",
    ),
  );
  // The name as the Worker stored it, not as it was typed.
  expect(api.signalCurrentUserDetails.mock.calls).toEqual([
    [{ ...account, name: "はなこ", displayName: "はなこ" }],
  ]);
});

it("empties the manager of the passkeys of a deleted account", async () => {
  const api = signals();
  settingsRoutes();
  routes["DELETE /api/me"] = [
    { status: 429, body: { error: "too_many_requests" } },
    { body: { ok: true, ...account } },
  ];
  render(<AccountPage />);
  const remove = async () => {
    fireEvent.click(
      await screen.findByRole("button", { name: "アカウントを削除" }),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "削除する",
      }),
    );
  };
  await remove();
  await screen.findByRole("alert");
  api.signalAllAcceptedCredentials.mockClear();
  await remove();
  await screen.findByRole("heading", { name: "アカウントを削除しました" });
  expect(api.signalAllAcceptedCredentials.mock.calls).toEqual([
    [{ ...account, allAcceptedCredentialIds: [] }],
  ]);
});

// PF-5: what comes back for one session is shown only while the cookies
// still name it. Another tab's logout or sign-in lands while the answer is
// on its way (a route's handler runs as the request is answered), or while
// the result is on screen (a return).
const otherTabSignsOut = () => {
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  document.cookie = "session_mark=; Max-Age=0; Path=/";
};
const otherTabSignsIn = (mark: string) => {
  document.cookie = "signed_in=1; Path=/";
  document.cookie = `session_mark=${mark}; Path=/`;
};
const returnToPage = () => act(() => fireEvent(window, new Event("focus")));
const reissue = async () => {
  fireEvent.click(
    await screen.findByRole("button", { name: "回復コードを再発行" }),
  );
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "再発行する",
    }),
  );
};
const register = () => {
  fireEvent.change(screen.getByLabelText("表示名"), {
    target: { value: "たろう" },
  });
  fireEvent.click(screen.getByRole("button", { name: "アカウントを作る" }));
};

it("shows no codes reissued for the user before another tab logged out", async () => {
  settingsRoutes();
  document.cookie = "session_mark=aaaa; Path=/";
  routes["POST /api/recovery-codes"] = () => {
    otherTabSignsOut();
    return { body: { recoveryCodes: codes } };
  };
  render(<AccountPage />);
  await reissue();
  await screen.findByRole("button", { name: "パスキーでログイン" });
  expect(screen.queryByRole("list", { name: "回復コード" })).toBeNull();
  expect(screen.queryByText(codes[0])).toBeNull();
});
it("announces no display name changed for the user before another tab logged out", async () => {
  settingsRoutes();
  document.cookie = "session_mark=aaaa; Path=/";
  routes["PATCH /api/me"] = () => {
    otherTabSignsOut();
    return { body: { ...profile, displayName: "はなこ" } };
  };
  render(<AccountPage />);
  fireEvent.change(await screen.findByLabelText("表示名"), {
    target: { value: "はなこ" },
  });
  fireEvent.click(button("変更する"));
  await screen.findByRole("button", { name: "パスキーでログイン" });
  expect(screen.queryByText("表示名を変更しました。")).toBeNull();
});

it("closes reissued codes once another user signs in", async () => {
  settingsRoutes();
  document.cookie = "session_mark=aaaa; Path=/";
  routes["POST /api/recovery-codes"] = { body: { recoveryCodes: codes } };
  render(<AccountPage />);
  await reissue();
  await screen.findByRole("list", { name: "回復コード" });
  routes["GET /api/account"] = {
    body: { profile: { ...profile, displayName: "はなこ" }, ...passkeys },
  };
  otherTabSignsIn("bbbb");
  await returnToPage();
  expect(screen.queryByRole("list", { name: "回復コード" })).toBeNull();
  expect(await screen.findByDisplayValue("はなこ")).toBeTruthy();
  expect(screen.queryByText(codes[0])).toBeNull();
});
it("closes the codes of a registration once another tab logs out", async () => {
  routes["POST /api/auth/register/options"] = { body: { challenge: "c" } };
  routes["POST /api/auth/register/verify"] = () => {
    otherTabSignsIn("aaaa");
    return { body: { ...profile, recoveryCodes: codes, sessionMark: "aaaa" } };
  };
  render(<AccountPage />);
  register();
  await screen.findByRole("list", { name: "回復コード" });
  otherTabSignsOut();
  await returnToPage();
  expect(screen.queryByRole("list", { name: "回復コード" })).toBeNull();
  expect(screen.getByRole("alert").textContent).toContain(
    "回復コードの表示を閉じました",
  );
  expect(button("パスキーでログイン")).toBeTruthy();
});
it("shows no codes of a registration when another user signs in as they are read", async () => {
  routes["POST /api/auth/register/options"] = { body: { challenge: "c" } };
  const serveAll = vi.mocked(fetch).getMockImplementation()!;
  let finish!: () => void;
  vi.mocked(fetch).mockImplementation(async (path, init) => {
    if (path !== "/api/auth/register/verify") return serveAll(path, init);
    otherTabSignsIn("aaaa");
    const text = new TextEncoder().encode(
      JSON.stringify({ ...profile, recoveryCodes: codes, sessionMark: "aaaa" }),
    );
    // The answer's cookies are in; its body is still being read.
    return new Response(
      new ReadableStream({
        start(controller) {
          finish = () => {
            controller.enqueue(text);
            controller.close();
          };
        },
      }),
    );
  });
  render(<AccountPage />);
  register();
  await waitFor(() => expect(finish).toBeDefined());
  otherTabSignsIn("bbbb");
  await act(async () => finish());
  await settle();
  expect(screen.queryByRole("list", { name: "回復コード" })).toBeNull();
  expect(screen.queryByText(codes[0])).toBeNull();
  expect(screen.getByRole("alert").textContent).toContain(
    "回復コードを表示できませんでした",
  );
});

// The registration's answer names the session it began (`sessionMark`):
// another session in the cookies as it comes in (another tab's sign-in,
// whose cookies replaced its own) does not get its codes.
it("shows no codes of a registration answered once the cookies name another session", async () => {
  routes["POST /api/auth/register/options"] = { body: { challenge: "c" } };
  routes["POST /api/auth/register/verify"] = () => {
    otherTabSignsIn("bbbb");
    return { body: { ...profile, recoveryCodes: codes, sessionMark: "aaaa" } };
  };
  render(<AccountPage />);
  register();
  expect((await screen.findByRole("alert")).textContent).toContain(
    "回復コードを表示できませんでした",
  );
  expect(screen.queryByRole("list", { name: "回復コード" })).toBeNull();
  expect(screen.queryByText(codes[0])).toBeNull();
});
// Shown once, and never fetched again: an hour on, the session may have
// ended on the Worker's side alone, so the codes go rather than being
// checked and shown again.
it("discards the codes on a return an hour after they were shown, and asks for a reissue", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    routes["POST /api/auth/register/options"] = { body: { challenge: "c" } };
    routes["POST /api/auth/register/verify"] = () => {
      signIn();
      return { body: { ...profile, recoveryCodes: codes, ...begun } };
    };
    render(<AccountPage />);
    register();
    await screen.findByRole("list", { name: "回復コード" });
    vi.setSystemTime(Date.now() + 59 * 60 * 1000);
    await returnToPage();
    expect(screen.getByRole("list", { name: "回復コード" })).toBeTruthy();
    vi.setSystemTime(Date.now() + 2 * 60 * 1000);
    await returnToPage();
    expect(screen.queryByRole("list", { name: "回復コード" })).toBeNull();
    expect(screen.queryByText(codes[0])).toBeNull();
    expect(screen.queryByRole("button", { name: "コピー" })).toBeNull();
    expect(screen.getByText(/再発行してください/)).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});
it("never draws codes for a session the cookies no longer name, not even once", () => {
  otherTabSignsIn("bbbb");
  const onLost = vi.fn();
  render(
    <RecoveryCodes
      codes={codes}
      mark="aaaa"
      onDone={() => {}}
      onLost={onLost}
      onDiscard={() => {}}
    />,
  );
  expect(screen.queryByText(codes[0])).toBeNull();
  expect(onLost).toHaveBeenCalledTimes(1);
});

// A recovery session has no display cookies (AU-9): one that shows up is
// another user's sign-in, which has replaced the recovery.
it("ends the recovery step once another tab signs a user in", async () => {
  inRecovery();
  routes["GET /api/account"] = { body: { profile, ...passkeys } };
  render(<AccountPage />);
  otherTabSignsIn("bbbb");
  await returnToPage();
  expect(await screen.findByDisplayValue("たろう")).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "新しいパスキーを登録" }),
  ).toBeNull();
  expect(sessionStorage.getItem("account-recovering")).toBeNull();
});
it("keeps the cookies of a user who signed in while a recovery request was answered", async () => {
  inRecovery();
  routes["POST /api/passkeys/register/options"] = () => {
    otherTabSignsIn("bbbb");
    return { status: 401, body: { error: "unauthorized" } };
  };
  routes["GET /api/account"] = { body: { profile, ...passkeys } };
  render(<AccountPage />);
  fireEvent.click(button("パスキーを登録"));
  expect(await screen.findByDisplayValue("たろう")).toBeTruthy();
  expect(document.cookie).toContain("signed_in=1");
  expect(document.cookie).toContain("session_mark=bbbb");
  expect(sessionStorage.getItem("account-recovering")).toBeNull();
});
// Two tabs of one recovery: the other's registration promoted it first, and
// this one's is refused, with a 401 that clears no cookie, once that
// session's cookies are set.
it("keeps the session another tab's recovery began when this tab's registration is refused", async () => {
  inRecovery();
  routes["POST /api/passkeys/register/options"] = { body: { rp: account } };
  routes["POST /api/passkeys/register/verify"] = () => {
    otherTabSignsIn("cccc");
    return { status: 401, body: { error: "unauthorized" } };
  };
  routes["GET /api/account"] = { body: { profile, ...passkeys } };
  render(<AccountPage />);
  fireEvent.click(button("パスキーを登録"));
  expect(await screen.findByDisplayValue("たろう")).toBeTruthy();
  expect(document.cookie).toContain("signed_in=1");
  expect(document.cookie).toContain("session_mark=cccc");
  expect(screen.queryByText(/回復の期限/)).toBeNull();
  expect(sessionStorage.getItem("account-recovering")).toBeNull();
});
// A recovery's registration is taken as the session it began only when its
// answer names the session the cookies hold.
it("does not take a recovery's registration answered as another session's as its own", async () => {
  inRecovery();
  routes["POST /api/passkeys/register/options"] = { body: { rp: account } };
  routes["POST /api/passkeys/register/verify"] = () => {
    otherTabSignsIn("bbbb");
    return { body: { ...profile, sessionMark: "cccc" } };
  };
  routes["GET /api/account"] = {
    body: { profile: { ...profile, displayName: "はなこ" }, ...passkeys },
  };
  render(<AccountPage />);
  fireEvent.click(button("パスキーを登録"));
  expect(await screen.findByDisplayValue("はなこ")).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "パスキーを登録しました" }),
  ).toBeNull();
  expect(document.cookie).toContain("session_mark=bbbb");
  expect(sessionStorage.getItem("account-recovering")).toBeNull();
});
// The recovery flag of this tab is left from before (a recovery given up
// in another way): a signed-in user gets their settings, never a recovery
// step that would log them out or add a passkey as them.
it("opens the settings, not a recovery step left from before, for a signed-in user", async () => {
  inRecovery();
  otherTabSignsIn("bbbb");
  routes["GET /api/account"] = { body: { profile, ...passkeys } };
  render(<AccountPage />);
  expect(await screen.findByDisplayValue("たろう")).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "新しいパスキーを登録" }),
  ).toBeNull();
  expect(sessionStorage.getItem("account-recovering")).toBeNull();
});
it("sends no logout for a recovery given up after another user signed in", async () => {
  inRecovery();
  routes["GET /api/account"] = { body: { profile, ...passkeys } };
  render(<AccountPage />);
  otherTabSignsIn("bbbb");
  fireEvent.click(button("回復をやめてログインに戻る"));
  expect(await screen.findByDisplayValue("たろう")).toBeTruthy();
  expect(calls).not.toContain("POST /api/auth/logout");
  expect(document.cookie).toContain("session_mark=bbbb");
});

// The display cookies outlive the session the Worker keeps (an inactive
// 30 days, a recovery or a deletion elsewhere): a return an hour after the
// settings were last answered asks again before showing them (PF-5).
it("hides the settings on a return an hour after their last answer, and asks again", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    settingsRoutes();
    render(<AccountPage />);
    expect(await screen.findByDisplayValue("たろう")).toBeTruthy();
    vi.setSystemTime(Date.now() + 59 * 60 * 1000);
    await returnToPage();
    expect(calls.filter((call) => call === "GET /api/account")).toHaveLength(1);
    expect(screen.getByDisplayValue("たろう")).toBeTruthy();
    vi.setSystemTime(Date.now() + 2 * 60 * 1000);
    routes["GET /api/account"] = {
      status: 401,
      body: { error: "unauthorized" },
    };
    await returnToPage();
    expect(screen.queryByDisplayValue("たろう")).toBeNull();
    await screen.findByRole("button", { name: "パスキーでログイン" });
    expect(calls.filter((call) => call === "GET /api/account")).toHaveLength(2);
    expect(document.cookie).not.toContain("signed_in=1");
  } finally {
    vi.useRealTimers();
  }
});

// Each recovery is named (`recoveryMark`, which the Worker also sets in the
// `recovery_mark` cookie with the recovery session): a recovery session
// has no display cookies (AU-9), so the name is how a tab tells its own
// recovery from one another tab began since (PF-5).
const recoverWithCode = async (mark = RECOVERY) => {
  routes["POST /api/auth/recover"] = () => {
    document.cookie = `recovery_mark=${mark}; Path=/`;
    return { body: { ok: true, recoveryMark: mark } };
  };
  render(<AccountPage />);
  fireEvent.click(button("回復コードで入る"));
  fireEvent.change(screen.getByLabelText("回復コード"), {
    target: { value: "aaaa-bbbb-cccc-dddd" },
  });
  fireEvent.click(button("回復する"));
  await screen.findByRole("heading", { name: "新しいパスキーを登録" });
};
const otherTabRecovers = (mark: string) => {
  otherTabSignsOut();
  document.cookie = `recovery_mark=${mark}; Path=/`;
};
const recoveredRoutes = () => {
  routes["POST /api/passkeys/register/options"] = { body: { rp: account } };
  routes["POST /api/passkeys/register/verify"] = () => {
    signIn();
    return { body: { ...profile, ...begun } };
  };
  routes["POST /api/recovery-codes"] = { body: { recoveryCodes: codes } };
  routes["GET /api/account"] = {
    body: { profile: { ...profile, displayName: "はなこ" }, ...passkeys },
  };
};

it("closes the recovery's done screen once another user signs in", async () => {
  recoveredRoutes();
  await recoverWithCode();
  fireEvent.click(button("パスキーを登録"));
  await screen.findByRole("heading", { name: "パスキーを登録しました" });
  otherTabSignsIn("bbbb");
  await returnToPage();
  expect(await screen.findByDisplayValue("はなこ")).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "パスキーを登録しました" }),
  ).toBeNull();
  expect(calls).not.toContain("POST /api/recovery-codes");
});
it("reissues no codes from the recovery's done screen as a user who signed in since", async () => {
  recoveredRoutes();
  await recoverWithCode();
  fireEvent.click(button("パスキーを登録"));
  await screen.findByRole("heading", { name: "パスキーを登録しました" });
  otherTabSignsIn("bbbb");
  fireEvent.click(button("回復コードを再発行"));
  expect(await screen.findByDisplayValue("はなこ")).toBeTruthy();
  expect(calls).not.toContain("POST /api/recovery-codes");
  expect(document.cookie).toContain("session_mark=bbbb");
});

it.each([
  ["回復をやめてログインに戻る", "POST /api/auth/logout"],
  ["パスキーを登録", "POST /api/passkeys/register/options"],
])(
  "sends nothing for this tab's recovery once another tab began another (%s)",
  async (name, sent) => {
    await recoverWithCode("ra");
    otherTabRecovers("rb");
    fireEvent.click(button(name));
    expect(
      await screen.findByRole("button", { name: "パスキーでログイン" }),
    ).toBeTruthy();
    expect(calls).not.toContain(sent);
    expect(sessionStorage.getItem("account-recovering")).toBeNull();
  },
);
it("does not resume this tab's recovery once another tab began another", async () => {
  await recoverWithCode("ra");
  cleanup();
  otherTabRecovers("rb");
  render(<AccountPage />);
  expect(
    screen.queryByRole("heading", { name: "新しいパスキーを登録" }),
  ).toBeNull();
  expect(button("パスキーでログイン")).toBeTruthy();
  expect(sessionStorage.getItem("account-recovering")).toBeNull();
});

// The registration's answer names the session it began; with no session in
// the cookies by then (another tab's logout), it is not taken as begun.
it("does not take a recovery's registration as begun while the cookies name no session", async () => {
  routes["POST /api/passkeys/register/options"] = { body: { rp: account } };
  routes["POST /api/passkeys/register/verify"] = {
    body: { ...profile, ...begun },
  };
  await recoverWithCode();
  fireEvent.click(button("パスキーを登録"));
  expect(
    await screen.findByRole("button", { name: "パスキーでログイン" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: "パスキーを登録しました" }),
  ).toBeNull();
  expect(sessionStorage.getItem("account-recovering")).toBeNull();
});

// The settings' read is refused as a recovery's (403 `recovery_session`),
// and another tab signs B in at some point on its way to the screen: before
// the guard sees it, or after. Either way B's cookies stay and no recovery
// step opens: the settings close only while the cookies are still those
// the read was sent with (then B signed in after the sign-in screen came
// up), and otherwise B's settings are read.
it.each(Array.from({ length: 20 }, (_, ticks) => ticks))(
  "keeps the cookies of a user who signed in as a recovery's refusal reached the settings (%i ticks)",
  async (ticks) => {
    settingsRoutes();
    // The recovery session the refusal is from, as the Worker names it.
    document.cookie = `recovery_mark=${RECOVERY}; Path=/`;
    const serveAll = vi.mocked(fetch).getMockImplementation()!;
    let first = true;
    vi.mocked(fetch).mockImplementation(async (path, init) => {
      if (path !== "/api/account" || !first) return serveAll(path, init);
      first = false;
      return {
        ok: false,
        status: 403,
        json() {
          const later = (left: number) => {
            if (left === 0) otherTabSignsIn("bbbb");
            else queueMicrotask(() => later(left - 1));
          };
          later(ticks);
          return Promise.resolve({ error: "recovery_session" });
        },
      } as Response;
    });
    routes["GET /api/account"] = {
      body: { profile: { ...profile, displayName: "はなこ" }, ...passkeys },
    };
    render(<AccountPage />);
    // B signed in by now, whenever it came; this page then hears of it.
    await act(() => new Promise((resolve) => setTimeout(resolve)));
    await returnToPage();
    await waitFor(() =>
      expect(
        screen.queryByDisplayValue("はなこ") ??
          screen.queryByText(/回復の途中のセッションになっているため/),
      ).toBeTruthy(),
    );
    expect(document.cookie).toContain("signed_in=1");
    expect(document.cookie).toContain("session_mark=bbbb");
    expect(
      screen.queryByRole("heading", { name: "新しいパスキーを登録" }),
    ).toBeNull();
  },
);
