import { StrictMode } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RecordsProvider, useRecords } from "./records-context";
import { RecordFilter, RecordBadge } from "./record-controls";
import { RecordEditor } from "./record-editor";

function Harness() {
  const records = useRecords();
  return (
    <>
      <RecordFilter />
      <RecordBadge ids={["a", "b"]} />
      <output aria-label="絞り込み結果">
        {["a", "b"].filter(records.matches).join(",")}
      </output>
      <RecordEditor cardId="a" />
    </>
  );
}
function mount(ready = true) {
  return render(
    <RecordsProvider ready={ready} aliases={{ old: "a" }}>
      <Harness />
    </RecordsProvider>,
  );
}
beforeEach(() => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=1; Path=/";
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith("/a")
              ? { cardId: "a", receivedOn: null, memo: "元のメモ" }
              : [{ cardId: "old", receivedOn: null }],
          ),
        ),
    ),
  );
});
afterEach(() => {
  cleanup();
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("does not fetch or display records when disabled or signed out", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "false");
  const view = mount();
  await act(async () => {});
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByText("受け取った")).toBeNull();
  expect(screen.queryByRole("group")).toBeNull();
  view.unmount();
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  mount();
  await act(async () => {});
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByRole("group")).toBeNull();
});
it("waits for initial map rendering, fetches the summary once and resolves aliases", async () => {
  const view = mount(false);
  await act(async () => {});
  expect(fetch).not.toHaveBeenCalled();
  view.rerender(
    <RecordsProvider ready aliases={{ old: "a" }}>
      <Harness />
    </RecordsProvider>,
  );
  await screen.findByText("一部受け取り済み");
  expect(
    vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/me/records"),
  ).toHaveLength(1);
  fireEvent.click(screen.getByRole("radio", { name: "受け取り済み" }));
  expect(screen.getByRole("status", { name: "絞り込み結果" }).textContent).toBe(
    "a",
  );
  fireEvent.click(screen.getByRole("radio", { name: "未回収" }));
  expect(screen.getByRole("status", { name: "絞り込み結果" }).textContent).toBe(
    "b",
  );
});
it("clears the cookie and private state on 401", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
  mount();
  await waitFor(() => expect(document.cookie).not.toContain("signed_in=1"));
  expect(screen.queryByRole("group")).toBeNull();
  expect(screen.queryByText("未回収")).toBeNull();
});
it.each([403, 429, 500, 503])(
  "does not label unknown records as unreceived after %i",
  async (status) => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status }));
    mount();
    await screen.findAllByText("記録を読み込めませんでした");
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByText("未回収")).toBeNull();
  },
);
it("optimistically deletes then rolls back on failure, without retrying", async () => {
  mount();
  await screen.findByDisplayValue("元のメモ");
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByRole("button", { name: "受け取りを取り消す" }));
  expect(screen.getByText("保存中…")).toBeTruthy();
  expect(screen.queryByText("一部受け取り済み")).toBeNull();
  await act(async () => finish(new Response(null, { status: 429 })));
  expect(screen.getByText("一部受け取り済み")).toBeTruthy();
  expect(screen.getByDisplayValue("元のメモ")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain(
    "保存できませんでした",
  );
});
it("updates date and memo optimistically and rolls both back", async () => {
  mount();
  await screen.findByDisplayValue("元のメモ");
  fireEvent.change(screen.getByLabelText("受け取った日（未設定可）"), {
    target: { value: "2026-01-02" },
  });
  fireEvent.change(screen.getByLabelText("メモ（自分だけに表示）"), {
    target: { value: "変更" },
  });
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
  fireEvent.click(screen.getByRole("button", { name: "記録を保存" }));
  await screen.findByRole("alert");
  expect(screen.getByDisplayValue("元のメモ")).toBeTruthy();
  expect(
    (screen.getByLabelText("受け取った日（未設定可）") as HTMLInputElement)
      .value,
  ).toBe("");
});

it("registers immediately and confirms a date-less receipt", async () => {
  vi.mocked(fetch).mockImplementation(
    async (url) =>
      new Response(url === "/api/me/records" ? "[]" : null, {
        status: url === "/api/me/records" ? 200 : 404,
      }),
  );
  mount();
  await screen.findByRole("button", { name: "受け取った" });
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByRole("button", { name: "受け取った" }));
  expect(screen.getByText("一部受け取り済み")).toBeTruthy();
  expect(screen.getByText("保存中…")).toBeTruthy();
  expect(vi.mocked(fetch).mock.lastCall?.[1]).toMatchObject({
    method: "PUT",
    body: '{"receivedOn":null,"memo":null}',
    cache: "no-store",
  });
  await act(async () =>
    finish(new Response('{"cardId":"a","receivedOn":null}')),
  );
  expect(screen.getByText("保存しました")).toBeTruthy();
});
it("clears memo, filters and receipts when a write gets 401", async () => {
  mount();
  await screen.findByDisplayValue("元のメモ");
  fireEvent.click(screen.getByRole("radio", { name: "受け取り済み" }));
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
  fireEvent.click(screen.getByRole("button", { name: "受け取りを取り消す" }));
  await waitFor(() => expect(screen.queryByRole("radio")).toBeNull());
  expect(screen.queryByDisplayValue("元のメモ")).toBeNull();
  expect(screen.getByRole("status", { name: "絞り込み結果" }).textContent).toBe(
    "a,b",
  );
});
it("does not show unreceived or permit edits when detail loading fails", async () => {
  vi.mocked(fetch).mockImplementation(async (url) =>
    url === "/api/me/records"
      ? new Response("[]")
      : new Response(null, { status: 503 }),
  );
  mount();
  await screen.findByRole("button", { name: "記録を再読み込み" });
  expect(screen.queryByRole("button", { name: "受け取った" })).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
});
it("removes private state after logout in another page", async () => {
  mount();
  await screen.findByDisplayValue("元のメモ");
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  fireEvent(window, new Event("focus"));
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("radio")).toBeNull();
});
it("counts 500 graphemes, rejects 501, and rejects future or invalid dates", async () => {
  mount();
  const memo = await screen.findByLabelText("メモ（自分だけに表示）");
  const form = memo.closest("form")!;
  const date = screen.getByLabelText("受け取った日（未設定可）");
  vi.mocked(fetch).mockResolvedValue(
    new Response('{"cardId":"a","receivedOn":null}'),
  );
  fireEvent.change(memo, { target: { value: "👨‍👩‍👧‍👦".repeat(501) } });
  fireEvent.submit(form);
  expect(screen.getByRole("alert").textContent).toContain("500文字");
  expect(vi.mocked(fetch).mock.calls).toHaveLength(2);
  fireEvent.change(memo, { target: { value: "👨‍👩‍👧‍👦".repeat(500) } });
  fireEvent.change(date, { target: { value: "9999-12-31" } });
  fireEvent.submit(form);
  expect(screen.getByRole("alert").textContent).toContain("今日以前");
  expect(vi.mocked(fetch).mock.calls).toHaveLength(2);
  fireEvent.change(date, { target: { value: "" } });
  fireEvent.submit(form);
  await screen.findByText("保存しました");
  expect(vi.mocked(fetch).mock.calls).toHaveLength(3);
});

it("deduplicates the initial summary in StrictMode", async () => {
  render(
    <StrictMode>
      <RecordsProvider ready>
        <Harness />
      </RecordsProvider>
    </StrictMode>,
  );
  await screen.findByText("一部受け取り済み");
  expect(
    vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/me/records"),
  ).toHaveLength(1);
});
