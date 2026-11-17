import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const roots = vi.hoisted(() => [] as import("react-dom/client").Root[]);
vi.mock("react-dom/client", async (original) => {
  const client = await original<typeof import("react-dom/client")>();
  return {
    ...client,
    createRoot: (...args: Parameters<typeof client.createRoot>) => {
      const root = client.createRoot(...args);
      roots.push(root);
      return root;
    },
  };
});

// The id of a real card needs no escaping; this one shows that the path does.
const cardId = "13-100-F001 x";
const recordPath = "/api/me/records/13-100-F001%20x";
const loginHref = "/account?returnTo=%2Fcard%2F13-100-F001%2520x%2F";
const requests: { call: string; body: unknown }[] = [];
const calls = () => requests.map((request) => request.call);
let listStatus = 200;
let stored: {
  cardId: string;
  receivedOn: string | null;
  memo: string | null;
}[];

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  history.replaceState({ kept: true }, "", "/card/13-100-F001%20x/");
  // As the generated page: the public text, and the link that stands where
  // the record goes for a visitor who is not signed in.
  document.body.innerHTML = `<main><h1>公開本文</h1><div id="card-record" data-card-id="${cardId}" data-card-aliases='{"old-1":"${cardId}"}'><a href="${loginHref}">ログインして入手を記録</a></div><p>配布時間 9:00</p></main>`;
  requests.length = 0;
  listStatus = 200;
  stored = [];
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      requests.push({ call: `${method} ${url}`, body });
      if (url === "/api/me/records")
        return new Response(
          JSON.stringify(
            stored.map(({ cardId, receivedOn }) => ({ cardId, receivedOn })),
          ),
          { status: listStatus },
        );
      if (method === "PUT") {
        stored = [{ cardId, ...body }];
        return new Response(JSON.stringify(body));
      }
      if (method === "DELETE") {
        stored = [];
        return new Response(null, { status: 204 });
      }
      return stored[0]
        ? new Response(JSON.stringify(stored[0]))
        : new Response(null, { status: 404 });
    }),
  );
});
afterEach(() => {
  act(() => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  document.cookie = "session_mark=; Max-Age=0; Path=/";
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const publicText = () => {
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
    "公開本文",
  );
  expect(screen.getByText("配布時間 9:00")).toBeTruthy();
};
const record = () =>
  within(document.getElementById("card-record") as HTMLElement);

it("records, edits and takes back this card for a signed-in visitor, beside the public text", async () => {
  document.cookie = "signed_in=1; Path=/";
  await import("./card-record-main");
  fireEvent.click(await record().findByRole("button", { name: "入手した" }));
  // Sent once the card's read has answered; slow when the whole suite runs.
  await waitFor(() => expect(calls()).toContain(`PUT ${recordPath}`), {
    timeout: 5000,
  });
  expect(
    requests.find((request) => request.call.startsWith("PUT"))!.body,
  ).toMatchObject({ memo: null });
  expect(record().queryByRole("link", { name: /ログイン/ })).toBeNull();
  fireEvent.click(
    await record().findByRole("button", { name: "日付・メモを編集" }),
  );
  fireEvent.change(record().getByLabelText("メモ（自分だけに表示）"), {
    target: { value: "窓口は2階" },
  });
  fireEvent.click(record().getByRole("button", { name: "保存する" }));
  await waitFor(() =>
    expect(
      requests.filter((request) => request.call === `PUT ${recordPath}`).at(-1)!
        .body,
    ).toMatchObject({ memo: "窓口は2階" }),
  );
  fireEvent.click(
    await record().findByRole("button", { name: "未入手に戻す" }),
  );
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "未入手に戻す",
    }),
  );
  await waitFor(() => expect(calls()).toContain(`DELETE ${recordPath}`));
  // Every request names this card or the list; none of it is kept here.
  expect(
    calls().filter(
      (call) => !call.endsWith(recordPath) && call !== "GET /api/me/records",
    ),
  ).toEqual([]);
  expect(localStorage.length + sessionStorage.length).toBe(0);
  expect(history.state).toEqual({ kept: true });
  publicText();
});

it("counts a record under the card's earlier number", async () => {
  document.cookie = "signed_in=1; Path=/";
  stored = [{ cardId: "old-1", receivedOn: "2026-11-01", memo: null }];
  await import("./card-record-main");
  expect(await record().findByText("入手済み")).toBeTruthy();
});

it("leaves the sign-in link and asks nothing while signed out", async () => {
  await import("./card-record-main");
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(
    record().getByRole("link", { name: "ログインして入手を記録" }),
  ).toHaveProperty("href", location.origin + loginHref);
  expect(fetch).not.toHaveBeenCalled();
  publicText();
});

it("starts the record when a signed-out page returns after sign-in elsewhere", async () => {
  await import("./card-record-main");
  expect(fetch).not.toHaveBeenCalled();
  document.cookie = "signed_in=1; Path=/";
  document.cookie = "session_mark=first; Path=/";
  fireEvent(window, new Event("pageshow"));
  expect(
    await record().findByRole("button", { name: "入手した" }),
  ).toBeTruthy();
  fireEvent(window, new Event("focus"));
  expect(roots).toHaveLength(1);
  expect(calls().filter((call) => call === "GET /api/me/records")).toHaveLength(
    1,
  );
  publicText();
});

it("drops the previous visitor's memo on return and never saves it for the next visitor", async () => {
  document.cookie = "signed_in=1; Path=/";
  document.cookie = "session_mark=first; Path=/";
  stored = [{ cardId, receivedOn: "2026-11-01", memo: "前の利用者のメモ" }];
  await import("./card-record-main");
  expect(await record().findByText("前の利用者のメモ")).toBeTruthy();
  document.cookie = "session_mark=second; Path=/";
  stored = [];
  fireEvent(window, new Event("pageshow"));
  expect(record().queryByText("前の利用者のメモ")).toBeNull();
  expect(
    await record().findByRole("button", { name: "入手した" }),
  ).toBeTruthy();
  expect(calls().filter((call) => call.startsWith("PUT "))).toEqual([]);
  expect(calls().filter((call) => call === "GET /api/me/records")).toHaveLength(
    2,
  );
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  fireEvent(window, new Event("focus"));
  expect(
    record().getByRole("link", { name: "ログインして入手を記録" }),
  ).toBeTruthy();
  expect(record().queryByRole("button", { name: "入手した" })).toBeNull();
  publicText();
});

it("does nothing in a build without accounts, even with a session cookie", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "false");
  document.cookie = "signed_in=1; Path=/";
  const before = document.body.innerHTML;
  await import("./card-record-main");
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(fetch).not.toHaveBeenCalled();
  expect(document.body.innerHTML).toBe(before);
});

it("says so when the records cannot be read, and keeps the public text", async () => {
  document.cookie = "signed_in=1; Path=/";
  listStatus = 500;
  await import("./card-record-main");
  expect(await record().findByText("記録を読み込めませんでした")).toBeTruthy();
  expect(record().queryByRole("button", { name: "入手した" })).toBeNull();
  publicText();
});

it("offers to sign in again, back to this card, once the session has ended", async () => {
  document.cookie = "signed_in=1; Path=/";
  listStatus = 401;
  await import("./card-record-main");
  await waitFor(() =>
    expect(
      record().getByRole("link", { name: "ログインして入手を記録" }),
    ).toHaveProperty("href", location.origin + loginHref),
  );
  publicText();
});
