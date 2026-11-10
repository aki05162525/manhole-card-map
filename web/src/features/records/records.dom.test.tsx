import { StrictMode, useState, useEffect } from "react";
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
import { useRecords } from "./records-context";
import { RecordsProvider } from "./records-provider";
import { RecordFilter, RecordBadge, RecordJump } from "./record-controls";
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
/** Undo a received card; a record with a memo asks first. */
function undo() {
  fireEvent.click(screen.getByRole("button", { name: "未回収に戻す" }));
  const dialog = screen.queryByRole("dialog");
  if (dialog)
    fireEvent.click(
      within(dialog).getByRole("button", { name: "未回収に戻す" }),
    );
}
function edit() {
  fireEvent.click(screen.getByRole("button", { name: "日付・メモを編集" }));
}
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
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
  expect(screen.queryByText("回収した")).toBeNull();
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
  await screen.findByText("一部回収済み");
  expect(
    vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/me/records"),
  ).toHaveLength(1);
  fireEvent.click(screen.getByRole("radio", { name: "回収済み" }));
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
  await screen.findByText("元のメモ");
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  undo();
  expect(screen.getByText("保存中…")).toBeTruthy();
  expect(screen.queryByText("一部回収済み")).toBeNull();
  await act(async () => finish(new Response(null, { status: 429 })));
  expect(screen.getByText("一部回収済み")).toBeTruthy();
  expect(screen.getByText("元のメモ")).toBeTruthy();
  expect(
    within(screen.getByRole("region", { name: "回収の記録" })).getByRole(
      "alert",
    ).textContent,
  ).toContain("保存できませんでした");
});
it("updates date and memo optimistically, rolls the record back and keeps the typed draft", async () => {
  mount();
  await screen.findByText("元のメモ");
  edit();
  fireEvent.change(screen.getByLabelText("回収した日（任意）"), {
    target: { value: "2026-01-02" },
  });
  fireEvent.change(screen.getByLabelText("メモ（自分だけに表示）"), {
    target: { value: "変更" },
  });
  const write = deferredResponse();
  vi.mocked(fetch).mockReturnValue(write.promise);
  fireEvent.click(screen.getByRole("button", { name: "保存する" }));
  expect(screen.getByText("変更")).toBeTruthy();
  expect(screen.getByText("2026年1月2日")).toBeTruthy();
  await act(async () => write.resolve(new Response(null, { status: 500 })));
  const panel = screen.getByRole("region", { name: "回収の記録" });
  expect(within(panel).getByRole("alert").textContent).toContain(
    "保存できませんでした",
  );
  // The saved record returns to the server value, but the form keeps what was typed.
  expect(screen.getByDisplayValue("変更")).toBeTruthy();
  expect(
    (screen.getByLabelText("回収した日（任意）") as HTMLInputElement).value,
  ).toBe("2026-01-02");
  fireEvent.click(screen.getByRole("button", { name: "やめる" }));
  expect(screen.getByText("元のメモ")).toBeTruthy();
  expect(screen.queryByText("変更")).toBeNull();
});

it("registers immediately and confirms a date-less receipt", async () => {
  vi.mocked(fetch).mockImplementation(
    async (url) =>
      new Response(url === "/api/me/records" ? "[]" : null, {
        status: url === "/api/me/records" ? 200 : 404,
      }),
  );
  mount();
  await screen.findByRole("button", { name: "回収した" });
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.click(screen.getByRole("button", { name: "回収した" }));
  expect(screen.getByText("一部回収済み")).toBeTruthy();
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
  await screen.findByText("元のメモ");
  fireEvent.click(screen.getByRole("radio", { name: "回収済み" }));
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));
  undo();
  await waitFor(() => expect(screen.queryByRole("radio")).toBeNull());
  expect(screen.queryByText("元のメモ")).toBeNull();
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
  expect(screen.queryByRole("button", { name: "回収した" })).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
});
it("removes private state after logout in another page", async () => {
  mount();
  await screen.findByText("元のメモ");
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  fireEvent(window, new Event("focus"));
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("radio")).toBeNull();
});
it("counts 500 graphemes, rejects 501, and rejects future or invalid dates", async () => {
  mount();
  await screen.findByText("元のメモ");
  edit();
  const memo = screen.getByLabelText("メモ（自分だけに表示）");
  const form = memo.closest("form")!;
  const date = screen.getByLabelText("回収した日（任意）");
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
  await screen.findByText("一部回収済み");
  expect(
    vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/me/records"),
  ).toHaveLength(1);
});

function ReopenHarness() {
  const [open, setOpen] = useState(true);
  const records = useRecords();
  return (
    <>
      <RecordFilter />
      <output aria-label="記録のカード">
        {[...(records.records?.keys() ?? [])].join(",")}
      </output>
      <button onClick={() => setOpen(!open)}>
        {open ? "詳細を閉じる" : "詳細を開く"}
      </button>
      {open && <RecordEditor cardId="a" />}
    </>
  );
}
function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
it("keeps a card pending across close and reopen and confirms the original save", async () => {
  const write = deferredResponse();
  vi.mocked(fetch).mockImplementation(async (url, init) => {
    if (init?.method === "PUT") return write.promise;
    return url === "/api/me/records"
      ? new Response("[]")
      : new Response(null, { status: 404 });
  });
  render(
    <RecordsProvider ready aliases={{ old: "a" }}>
      <ReopenHarness />
    </RecordsProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "回収した" }));
  fireEvent.click(screen.getByRole("button", { name: "詳細を閉じる" }));
  fireEvent.click(screen.getByRole("button", { name: "詳細を開く" }));
  await act(async () => {});
  expect(screen.getByRole("status", { name: "記録のカード" }).textContent).toBe(
    "a",
  );
  expect(
    screen
      .getByRole("button", { name: "日付・メモを編集" })
      .getAttribute("aria-disabled"),
  ).toBe("true");
  expect(
    screen
      .getByRole("region", { name: "回収の記録" })
      .getAttribute("aria-busy"),
  ).toBe("true");
  expect(
    vi
      .mocked(fetch)
      .mock.calls.filter(
        ([url, init]) => url === "/api/me/records/a" && !init?.method,
      ),
  ).toHaveLength(1);
  await act(async () =>
    write.resolve(new Response('{"cardId":"a","receivedOn":"2026-01-02"}')),
  );
  expect(screen.getByText("保存しました")).toBeTruthy();
  expect(
    screen
      .getByText("2026年1月2日", { selector: "time" })
      .getAttribute("datetime"),
  ).toBe("2026-01-02");
});
it("announces a failed save after leaving the detail and restores its receipt", async () => {
  const write = deferredResponse();
  render(
    <RecordsProvider ready aliases={{ old: "a" }}>
      <ReopenHarness />
    </RecordsProvider>,
  );
  await screen.findByText("元のメモ");
  vi.mocked(fetch).mockReturnValue(write.promise);
  undo();
  fireEvent.click(screen.getByRole("button", { name: "詳細を閉じる" }));
  await act(async () => write.resolve(new Response(null, { status: 500 })));
  expect(screen.getByRole("alert").textContent).toContain(
    "保存できませんでした",
  );
  expect(screen.getByRole("status", { name: "記録のカード" }).textContent).toBe(
    "a",
  );
});

let store!: ReturnType<typeof useRecords>;
function StoreProbe() {
  const records = useRecords();
  useEffect(() => {
    store = records;
  }, [records]);
  return null;
}
function mountProbe() {
  return render(
    <RecordsProvider ready aliases={{ old: "a" }}>
      <StoreProbe />
      <Harness />
    </RecordsProvider>,
  );
}
it.each([404, 500, 200])(
  "ignores a detail response started before the current save (stale status=%i)",
  async (status) => {
    mountProbe();
    await screen.findByText("元のメモ");
    const stale = deferredResponse(),
      write = deferredResponse();
    vi.mocked(fetch)
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(write.promise);
    let reading!: Promise<void>, saving!: Promise<void>;
    act(() => {
      reading = store.load("a");
    });
    act(() => {
      saving = store.save("a", {
        cardId: "a",
        receivedOn: "2026-01-02",
        memo: "保存を優先",
      });
    });
    await act(async () => {
      write.resolve(new Response('{"cardId":"a","receivedOn":"2026-01-02"}'));
      await saving;
    });
    const confirmed = store.records;
    await act(async () => {
      stale.resolve(
        new Response(
          status === 200
            ? '{"cardId":"a","receivedOn":null,"memo":"古い取得"}'
            : null,
          { status },
        ),
      );
      await reading;
    });
    expect(store.records).toBe(confirmed);
    expect(store.details.get("a")).toMatchObject({
      pending: false,
      record: { receivedOn: "2026-01-02", memo: "保存を優先" },
      loadError: "",
    });
  },
);
it("retains the summary Map when a detail returns the same receipt", async () => {
  mountProbe();
  await screen.findByText("元のメモ");
  const summary = store.records;
  await act(async () => {
    await store.load("a");
  });
  expect(store.records).toBe(summary);
});

it.each([false, true])(
  "does not install account listeners at the import boundary when signed out (enabled=%s)",
  async (enabled) => {
    vi.stubEnv("VITE_ACCOUNTS_ENABLED", String(enabled));
    document.cookie = "signed_in=; Max-Age=0; Path=/";
    const windowEvents = vi.spyOn(window, "addEventListener");
    const documentEvents = vi.spyOn(document, "addEventListener");
    const { RecordsBoundary } = await import("./records-entry");
    render(
      <RecordsBoundary ready>
        <p>地図の内容</p>
      </RecordsBoundary>,
    );
    await act(async () => {});
    expect(screen.getByText("地図の内容")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    expect(
      windowEvents.mock.calls.filter(
        ([event]) => event === "focus" || event === "pageshow",
      ),
    ).toHaveLength(0);
    expect(
      documentEvents.mock.calls.filter(
        ([event]) => event === "visibilitychange",
      ),
    ).toHaveLength(0);
    windowEvents.mockRestore();
    documentEvents.mockRestore();
  },
);

it("rejects a second save while the same card is pending and retains the first success", async () => {
  mountProbe();
  await screen.findByText("元のメモ");
  const firstResponse = deferredResponse();
  vi.mocked(fetch)
    .mockReturnValueOnce(firstResponse.promise)
    .mockResolvedValueOnce(new Response(null, { status: 500 }));
  let first!: Promise<void>, second!: Promise<void>;
  act(() => {
    first = store.save("a", {
      cardId: "a",
      receivedOn: "2026-01-01",
      memo: "保存A",
    });
  });
  act(() => {
    second = store.save("a", {
      cardId: "a",
      receivedOn: "2026-01-02",
      memo: "保存B",
    });
  });
  await act(async () => {
    firstResponse.resolve(
      new Response('{"cardId":"a","receivedOn":"2026-01-01"}'),
    );
    await first;
    await second;
  });
  expect(
    vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "PUT"),
  ).toHaveLength(1);
  expect(store.details.get("a")).toMatchObject({
    pending: false,
    record: { receivedOn: "2026-01-01", memo: "保存A" },
  });
  expect(store.records?.get("a")?.receivedOn).toBe("2026-01-01");
  expect(screen.queryByRole("alert")).toBeNull();
});

it("allows an explicit retry after the pending save fails and clears its card error", async () => {
  mountProbe();
  await screen.findByText("元のメモ");
  const failed = deferredResponse();
  vi.mocked(fetch)
    .mockReturnValueOnce(failed.promise)
    .mockResolvedValueOnce(
      new Response('{"cardId":"a","receivedOn":"2026-01-02"}'),
    );
  let first!: Promise<void>;
  act(() => {
    first = store.save("a", {
      cardId: "a",
      receivedOn: "2026-01-01",
      memo: "保存A",
    });
  });
  await act(async () => {
    await store.save("a", {
      cardId: "a",
      receivedOn: "2026-01-02",
      memo: "保存B",
    });
  });
  await act(async () => {
    failed.resolve(new Response(null, { status: 500 }));
    await first;
  });
  expect(store.details.get("a")).toMatchObject({
    pending: false,
    record: { receivedOn: null, memo: "元のメモ" },
    saveError: expect.stringContaining("保存できませんでした"),
  });
  expect(
    vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "PUT"),
  ).toHaveLength(1);
  await act(async () => {
    await store.save("a", {
      cardId: "a",
      receivedOn: "2026-01-02",
      memo: "明示的な再試行",
    });
  });
  expect(store.details.get("a")).toMatchObject({
    pending: false,
    saveError: "",
    record: { memo: "明示的な再試行" },
  });
  expect(screen.queryByRole("alert")).toBeNull();
});

it("keeps save failures separate for cards that are saved concurrently", async () => {
  mountProbe();
  await screen.findByText("元のメモ");
  const failed = deferredResponse();
  vi.mocked(fetch)
    .mockReturnValueOnce(failed.promise)
    .mockResolvedValueOnce(new Response('{"cardId":"b","receivedOn":null}'));
  let first!: Promise<void>;
  act(() => {
    first = store.save("a", {
      cardId: "a",
      receivedOn: null,
      memo: "失敗する保存",
    });
  });
  await act(async () => {
    await store.save("b", {
      cardId: "b",
      receivedOn: null,
      memo: "成功する保存",
    });
  });
  await act(async () => {
    failed.resolve(new Response(null, { status: 500 }));
    await first;
  });
  expect(store.details.get("a")?.saveError).toContain("保存できませんでした");
  expect(store.details.get("b")).toMatchObject({
    saveError: "",
    record: { memo: "成功する保存" },
  });
  expect(store.records?.has("b")).toBe(true);
});

function emptyRecords() {
  vi.mocked(fetch).mockImplementation(
    async (url, init) =>
      new Response(
        init?.method === "PUT"
          ? '{"cardId":"a","receivedOn":null}'
          : url === "/api/me/records"
            ? "[]"
            : null,
        { status: init?.method || url === "/api/me/records" ? 200 : 404 },
      ),
  );
}
it("labels the filter and badges with collected terms and a state attribute", async () => {
  mount();
  const group = await screen.findByRole("group", {
    name: "回収状況で絞り込む",
  });
  expect(
    within(group)
      .getAllByRole("radio")
      .map((radio) => radio.closest("label")?.textContent),
  ).toEqual(["すべて", "回収済み", "未回収"]);
  const badge = screen.getByText("一部回収済み");
  expect(badge.getAttribute("data-state")).toBe("some");
  expect(badge.textContent).toBe("一部回収済み");
});
it("adds a caption beside the filter only when asked", async () => {
  render(
    <RecordsProvider ready>
      <RecordFilter caption />
    </RecordsProvider>,
  );
  const group = await screen.findByRole("group", {
    name: "回収状況で絞り込む",
  });
  const caption = group.parentElement?.querySelector(".record-filter-caption");
  expect(caption?.textContent).toBe("回収状況");
  expect(caption?.getAttribute("aria-hidden")).toBe("true");
});
it("shows a received card as a summary and edits it only on request", async () => {
  mount();
  await screen.findByText("元のメモ");
  const panel = screen.getByRole("region", { name: "回収の記録" });
  expect(panel.getAttribute("data-state")).toBe("done");
  expect(panel.hasAttribute("data-fresh")).toBe(false);
  expect(within(panel).getByText("回収済み")).toBeTruthy();
  expect(within(panel).getByText("未設定")).toBeTruthy();
  expect(within(panel).queryByRole("textbox")).toBeNull();
  edit();
  expect(document.activeElement).toBe(
    screen.getByLabelText("回収した日（任意）"),
  );
  expect(screen.getByDisplayValue("元のメモ")).toBeTruthy();
  expect(screen.getByText("4 / 500文字")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "今日" }));
  expect(
    (screen.getByLabelText("回収した日（任意）") as HTMLInputElement).value,
  ).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method)).toBe(
    false,
  );
  fireEvent.click(screen.getByRole("button", { name: "やめる" }));
  expect(within(panel).queryByRole("textbox")).toBeNull();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "日付・メモを編集" }),
  );
});
it("moves focus between the receive and edit buttons and undoes a memo-less record at once", async () => {
  emptyRecords();
  mount();
  const panel = await screen.findByRole("region", { name: "回収の記録" });
  fireEvent.click(await screen.findByRole("button", { name: "回収した" }));
  expect(panel.getAttribute("data-state")).toBe("done");
  expect(panel.hasAttribute("data-fresh")).toBe(true);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "日付・メモを編集" }),
  );
  await screen.findByText("保存しました");
  fireEvent.click(screen.getByRole("button", { name: "未回収に戻す" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(panel.getAttribute("data-state")).toBe("none");
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "回収した" }),
  );
  await screen.findByText("未回収に戻しました");
  expect(
    vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "DELETE"),
  ).toHaveLength(1);
});
it("asks before undoing a record with a memo", async () => {
  mount();
  await screen.findByText("元のメモ");
  fireEvent.click(screen.getByRole("button", { name: "未回収に戻す" }));
  const dialog = screen.getByRole("dialog", { name: "未回収に戻す" });
  expect(dialog.textContent).toContain("メモ");
  fireEvent.click(within(dialog).getByRole("button", { name: "やめる" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText("元のメモ")).toBeTruthy();
  expect(
    vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "DELETE"),
  ).toHaveLength(0);
  undo();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(
    vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "DELETE"),
  ).toHaveLength(1);
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "回収した" }),
  );
});
it("shows the friend's collected state without controls", async () => {
  const { RecordsContext, inactive } = await import("./records-context");
  render(
    <RecordsContext
      value={{
        ...inactive,
        phase: "ready",
        friendName: "はな",
        records: new Map([["a", { cardId: "a", receivedOn: "2026-10-12" }]]),
      }}
    >
      <RecordEditor cardId="a" />
    </RecordsContext>,
  );
  const panel = screen.getByRole("region", { name: "はなさんの回収記録" });
  expect(within(panel).getByText("回収済み")).toBeTruthy();
  expect(within(panel).getByText("回収した日")).toBeTruthy();
  expect(within(panel).getByText("2026年10月12日")).toBeTruthy();
  expect(within(panel).queryByRole("button")).toBeNull();
});
it.each(["loading", "failed"] as const)(
  "does not offer the record jump while records are %s",
  async (phase) => {
    const { RecordsContext, inactive } = await import("./records-context");
    render(
      <RecordsContext value={{ ...inactive, phase }}>
        <RecordJump ids={["a"]} />
      </RecordsContext>,
    );
    expect(screen.queryByRole("button")).toBeNull();
  },
);
it("jumps to the record panel through onExpand or by scrolling", async () => {
  const { RecordsContext, inactive } = await import("./records-context");
  const expand = vi.fn();
  const scroll = vi.fn();
  HTMLElement.prototype.scrollIntoView = scroll;
  const view = render(
    <RecordsContext
      value={{
        ...inactive,
        phase: "ready",
        records: new Map([["a", { cardId: "a", receivedOn: null }]]),
      }}
    >
      <div className="card-detail-content">
        <RecordJump ids={["a"]} onExpand={expand} />
        <section className="record-editor" aria-label="回収の記録" />
      </div>
    </RecordsContext>,
  );
  const jump = screen.getByRole("button", { name: "回収済み、回収の記録へ" });
  fireEvent.click(jump);
  expect(expand).toHaveBeenCalledWith("record");
  expect(scroll).not.toHaveBeenCalled();
  view.rerender(
    <RecordsContext value={{ ...inactive, phase: "ready", records: new Map() }}>
      <div className="card-detail-content">
        <RecordJump ids={["a"]} />
        <section className="record-editor" aria-label="回収の記録" />
      </div>
    </RecordsContext>,
  );
  fireEvent.click(screen.getByRole("button", { name: "未回収、回収の記録へ" }));
  expect(scroll).toHaveBeenCalledWith({ block: "start" });
});
