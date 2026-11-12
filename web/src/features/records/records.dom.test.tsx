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
import { japanToday } from "../../domain/records";
import { useRecords } from "./records-context";
import { RecordsProvider } from "./records-provider";
import { RecordFilter, RecordBadge, RecordAction } from "./record-controls";
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
  // The button is there before the card's read answers, and a press then
  // is held for that answer: let the read finish, so this save is sent.
  await waitFor(() =>
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/me/records/a",
      expect.anything(),
    ),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
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
    body: JSON.stringify({ receivedOn: japanToday(), memo: null }),
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
it("keeps the summary's receipt but permits no edits when detail loading fails", async () => {
  vi.mocked(fetch).mockImplementation(async (url) =>
    url === "/api/me/records"
      ? new Response('[{"cardId":"old","receivedOn":"2026-11-01"}]')
      : new Response(null, { status: 503 }),
  );
  mount();
  await screen.findByRole("button", { name: "記録を再読み込み" });
  expect(screen.getByText("2026年11月1日")).toBeTruthy();
  edit();
  expect(screen.queryByRole("textbox")).toBeNull();
  vi.mocked(fetch).mockResolvedValue(
    new Response('{"cardId":"a","receivedOn":"2026-11-01","memo":"元のメモ"}'),
  );
  fireEvent.click(screen.getByRole("button", { name: "記録を再読み込み" }));
  await screen.findByText("元のメモ");
  expect(screen.queryByRole("button", { name: "記録を再読み込み" })).toBeNull();
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
  // The button shows before the read; one sent by then is dropped by the save.
  const reads = () =>
    vi
      .mocked(fetch)
      .mock.calls.filter(
        ([url, init]) => url === "/api/me/records/a" && !init?.method,
      ).length;
  fireEvent.click(await screen.findByRole("button", { name: "回収した" }));
  await act(async () => {});
  const before = reads();
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
  // A reopened pending card reads nothing that could take its value away.
  expect(reads()).toBe(before);
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

// The list renders its first view before the data; a suspended frame there
// would paint an empty page.
it("renders the content in the first commit once the entry has loaded the feature", async () => {
  vi.stubEnv("VITE_ACCOUNTS_ENABLED", "true");
  document.cookie = "signed_in=1; Path=/";
  const entry = await import("./records-entry");
  await entry.preloadRecords();
  render(
    <entry.RecordsBoundary ready={false}>
      <p>一覧の内容</p>
    </entry.RecordsBoundary>,
  );
  expect(screen.getByText("一覧の内容")).toBeTruthy();
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
  // Read first, so the save of "b" is sent rather than held for its read.
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));
  await act(async () => {
    await store.load("b");
  });
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
  "does not offer the record action while records are %s",
  async (phase) => {
    const { RecordsContext, inactive } = await import("./records-context");
    render(
      <RecordsContext value={{ ...inactive, phase }}>
        <RecordAction ids={["a"]} />
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
  const value = {
    ...inactive,
    phase: "ready" as const,
    records: new Map([["a", { cardId: "a", receivedOn: null }]]),
  };
  const view = render(
    <RecordsContext value={value}>
      <div className="card-detail-content">
        <RecordAction ids={["a"]} onExpand={expand} />
        <section className="record-editor" aria-label="回収の記録" />
      </div>
    </RecordsContext>,
  );
  const jump = screen.getByRole("button", { name: "回収済み、回収の記録へ" });
  fireEvent.click(jump);
  expect(expand).toHaveBeenCalledWith("record");
  expect(scroll).not.toHaveBeenCalled();
  view.rerender(
    <RecordsContext value={value}>
      <div className="card-detail-content">
        <RecordAction ids={["a"]} />
        <section className="record-editor" aria-label="回収の記録" />
      </div>
    </RecordsContext>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "回収済み、回収の記録へ" }),
  );
  expect(scroll).toHaveBeenCalledWith({ block: "start" });
});
it("records an unreceived card with today's date in one press and offers to take it back", async () => {
  const { RecordsContext, inactive } = await import("./records-context");
  const save = vi.fn(async () => {});
  const ready = { ...inactive, phase: "ready" as const, save };
  const view = render(
    <RecordsContext value={{ ...ready, records: new Map() }}>
      <RecordAction ids={["a"]} />
    </RecordsContext>,
  );
  expect(screen.queryByRole("button", { name: "取り消す" })).toBeNull();
  const receive = screen.getByRole("button", { name: "回収した" });
  receive.focus();
  fireEvent.click(receive);
  expect(save).toHaveBeenCalledWith("a", {
    cardId: "a",
    receivedOn: japanToday(),
    memo: null,
  });
  view.rerender(
    <RecordsContext
      value={{
        ...ready,
        records: new Map([["a", { cardId: "a", receivedOn: japanToday() }]]),
      }}
    >
      <RecordAction ids={["a"]} />
    </RecordsContext>,
  );
  // The pressed button stays mounted, so focus is not lost.
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "回収済み、回収の記録へ" }),
  );
  expect(screen.getByRole("status").textContent).toBe("回収済みにしました");
  fireEvent.click(screen.getByRole("button", { name: "取り消す" }));
  expect(save).toHaveBeenLastCalledWith("a", null);
  view.rerender(
    <RecordsContext value={{ ...ready, records: new Map() }}>
      <RecordAction ids={["a"]} />
    </RecordsContext>,
  );
  expect(screen.queryByRole("button", { name: "取り消す" })).toBeNull();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "回収した" }),
  );
});
it("only shows a friend's state and never saves from it", async () => {
  const { RecordsContext, inactive } = await import("./records-context");
  const save = vi.fn(async () => {});
  const scroll = vi.fn();
  HTMLElement.prototype.scrollIntoView = scroll;
  render(
    <RecordsContext
      value={{
        ...inactive,
        phase: "ready",
        friendName: "はな",
        records: new Map(),
        save,
      }}
    >
      <div className="card-detail-content">
        <RecordAction ids={["a"]} />
        <section className="record-editor" />
      </div>
    </RecordsContext>,
  );
  fireEvent.click(screen.getByRole("button", { name: "未回収、回収の記録へ" }));
  expect(save).not.toHaveBeenCalled();
  expect(scroll).toHaveBeenCalledWith({ block: "start" });
});
it("returns focus to the reopened form when a save fails while its button had focus", async () => {
  mount();
  await screen.findByText("元のメモ");
  edit();
  fireEvent.change(screen.getByLabelText("メモ（自分だけに表示）"), {
    target: { value: "失敗しても残る" },
  });
  const write = deferredResponse();
  vi.mocked(fetch).mockReturnValue(write.promise);
  fireEvent.click(screen.getByRole("button", { name: "保存する" }));
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "日付・メモを編集" }),
  );
  await act(async () => write.resolve(new Response(null, { status: 500 })));
  expect(document.activeElement).toBe(
    screen.getByLabelText("回収した日（任意）"),
  );
});
it("does not take focus back after a failed save when the user moved on", async () => {
  mount();
  await screen.findByText("元のメモ");
  edit();
  const write = deferredResponse();
  vi.mocked(fetch).mockReturnValue(write.promise);
  fireEvent.click(screen.getByRole("button", { name: "保存する" }));
  const elsewhere = screen.getByRole("radio", { name: "未回収" });
  elsewhere.focus();
  await act(async () => write.resolve(new Response(null, { status: 500 })));
  expect(screen.getByLabelText("回収した日（任意）")).toBeTruthy();
  expect(document.activeElement).toBe(elsewhere);
});

it("sends every records request same-origin and uncached", async () => {
  mount();
  await screen.findByText("元のメモ");
  undo();
  await screen.findByText("未回収に戻しました");
  const calls = vi.mocked(fetch).mock.calls;
  expect(calls.map(([url, init]) => [url, init?.method])).toEqual([
    ["/api/me/records", undefined],
    ["/api/me/records/a", undefined],
    ["/api/me/records/a", "DELETE"],
  ]);
  for (const [, init] of calls)
    expect(init).toMatchObject({
      credentials: "same-origin",
      cache: "no-store",
    });
});
it.each<[string, () => Promise<Response>, string]>([
  [
    "403",
    async () => new Response('{"error":"reauth_required"}', { status: 403 }),
    "パスキーでログインし直してから操作してください。",
  ],
  [
    "429",
    async () => new Response('{"error":"too_many_requests"}', { status: 429 }),
    "操作が多いため保存できませんでした。しばらく待ってからやり直してください。",
  ],
  [
    "404",
    async () => new Response(null, { status: 404 }),
    "保存できませんでした。通信を確認してやり直してください。",
  ],
  [
    "500",
    async () => new Response("<html>", { status: 500 }),
    "保存できませんでした。通信を確認してやり直してください。",
  ],
  [
    "a network failure",
    () => Promise.reject(new TypeError("Failed to fetch")),
    "保存できませんでした。通信を確認してやり直してください。",
  ],
])(
  "words a save that fails with %s and stays signed in",
  async (_, respond, text) => {
    mount();
    await screen.findByText("元のメモ");
    vi.mocked(fetch).mockImplementation(respond);
    undo();
    const alert = await within(
      screen.getByRole("region", { name: "回収の記録" }),
    ).findByRole("alert");
    expect(alert.textContent).toBe(text);
    expect(screen.getByText("元のメモ")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "回収済み" })).toBeTruthy();
    expect(document.cookie).toContain("signed_in=1");
  },
);
it.each<[string, () => Promise<Response>]>([
  ["404", async () => new Response(null, { status: 404 })],
  ["a network failure", () => Promise.reject(new TypeError("Failed to fetch"))],
])(
  "does not label unknown records as unreceived after %s on the summary",
  async (_, respond) => {
    vi.mocked(fetch).mockImplementation(respond);
    mount();
    await screen.findAllByText("記録を読み込めませんでした");
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByText("未回収")).toBeNull();
    expect(document.cookie).toContain("signed_in=1");
  },
);
it("offers a reload when the detail cannot be reached", async () => {
  vi.mocked(fetch).mockImplementation((url) =>
    url === "/api/me/records"
      ? Promise.resolve(new Response("[]"))
      : Promise.reject(new TypeError("Failed to fetch")),
  );
  mount();
  await screen.findByRole("button", { name: "記録を再読み込み" });
  expect(screen.queryByRole("button", { name: "回収した" })).toBeNull();
});
it("signs out instead of reporting a failure when the session ended during a write", async () => {
  mount();
  await screen.findByText("元のメモ");
  const write = deferredResponse();
  vi.mocked(fetch).mockReturnValue(write.promise);
  undo();
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  await act(async () => write.resolve(new Response(null, { status: 500 })));
  expect(screen.queryByRole("radio")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByText("元のメモ")).toBeNull();
});

it.each([
  ["true", true, true],
  ["true", false, false],
  ["false", true, false],
])(
  "shows the entry controls only with a session (enabled=%s, cookie=%s)",
  async (enabled, cookie, shown) => {
    vi.stubEnv("VITE_ACCOUNTS_ENABLED", enabled);
    if (!cookie) document.cookie = "signed_in=; Max-Age=0; Path=/";
    const entry = await import("./records-entry");
    render(
      <entry.RecordsBoundary ready aliases={{ old: "a" }}>
        <entry.RecordFilter />
        <entry.RecordBadge ids={["a", "b"]} />
        <entry.RecordAction ids={["a"]} />
        <entry.RecordEditor cardId="a" />
        <p>地図の内容</p>
      </entry.RecordsBoundary>,
    );
    await screen.findByText("地図の内容");
    if (shown) {
      await screen.findByText("元のメモ");
      expect(screen.getByRole("radio", { name: "回収済み" })).toBeTruthy();
      expect(screen.getByText("一部回収済み")).toBeTruthy();
      expect(screen.getByRole("region", { name: "回収の記録" })).toBeTruthy();
      expect(document.querySelector("button.record-quick")).toBeTruthy();
      expect(
        screen.queryByRole("link", { name: "ログインして記録" }),
      ).toBeNull();
    } else {
      await act(async () => {});
      expect(fetch).not.toHaveBeenCalled();
      expect(screen.queryByRole("radio")).toBeNull();
      expect(screen.queryByRole("region", { name: "回収の記録" })).toBeNull();
      // Without a session the only entry is a link to sign in and come back.
      const signIn = screen.queryByRole("link", { name: "ログインして記録" });
      if (enabled === "true") {
        expect(signIn!.getAttribute("href")).toBe(
          `/account?${new URLSearchParams({ returnTo: location.pathname + location.search })}`,
        );
      } else expect(signIn).toBeNull();
      expect(document.querySelector("[class^='record']")).toBeNull();
    }
  },
);

// Another tab signed out and in as someone else: the session mark changed.
it("drops one user's records when another signs in elsewhere, and ignores the late answer", async () => {
  const replies = new Map<string, (rows: unknown) => void>();
  const mark = () => /session_mark=(\w+)/.exec(document.cookie)?.[1] ?? "";
  vi.mocked(fetch).mockImplementation(
    (url) =>
      new Promise((resolve) => {
        if (url === "/api/me/records")
          replies.set(mark(), (rows) =>
            resolve(new Response(JSON.stringify(rows))),
          );
      }),
  );
  function Received() {
    const { records, phase } = useRecords();
    return (
      <output aria-label="受け取り">
        {phase}:{[...(records?.keys() ?? [])].join(",")}
      </output>
    );
  }
  const shown = () => screen.getByRole("status", { name: "受け取り" });
  const signIn = (value: string) => {
    document.cookie = `session_mark=${value}; Path=/`;
  };
  signIn("aaaa");
  render(
    <RecordsProvider ready>
      <Received />
    </RecordsProvider>,
  );
  await waitFor(() => expect(replies.has("aaaa")).toBe(true));
  signIn("bbbb");
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(replies.has("bbbb")).toBe(true));
  await act(async () =>
    replies.get("aaaa")!([{ cardId: "a", receivedOn: null }]),
  );
  expect(shown().textContent).toBe("loading:");
  await act(async () =>
    replies.get("bbbb")!([{ cardId: "b", receivedOn: null }]),
  );
  expect(shown().textContent).toBe("ready:b");
  signIn("cccc");
  fireEvent(window, new Event("focus"));
  expect(shown().textContent).toBe("loading:");
  await waitFor(() => expect(replies.has("cccc")).toBe(true));
  await act(async () =>
    replies.get("cccc")!([{ cardId: "c", receivedOn: null }]),
  );
  expect(shown().textContent).toBe("ready:c");
  // The same user returning changes nothing.
  fireEvent(window, new Event("focus"));
  expect(shown().textContent).toBe("ready:c");
  document.cookie = "session_mark=; Max-Age=0; Path=/";
});

// Each request waits until the test answers it, as a slow network does.
function heldRequests() {
  const held: {
    url: string;
    method: string;
    mark: string;
    answer(status: number, body?: unknown): Promise<void>;
  }[] = [];
  vi.mocked(fetch).mockImplementation(
    (url, init) =>
      new Promise((resolve) => {
        held.push({
          url: String(url),
          method: init?.method ?? "GET",
          mark: /session_mark=(\w+)/.exec(document.cookie)?.[1] ?? "",
          answer: async (status, body) => {
            await act(async () =>
              resolve(
                new Response(body === undefined ? null : JSON.stringify(body), {
                  status,
                }),
              ),
            );
          },
        });
      }),
  );
  return held;
}
function Received() {
  const { records, phase, notification } = useRecords();
  return (
    <>
      <output aria-label="受け取り">
        {phase}:{[...(records?.keys() ?? [])].join(",")}
      </output>
      <output aria-label="通知">{notification}</output>
    </>
  );
}
const received = () => screen.getByRole("status", { name: "受け取り" });
const markAs = (value: string) => {
  document.cookie = `session_mark=${value}; Path=/`;
};
const summaries = (held: ReturnType<typeof heldRequests>) =>
  held.filter((request) => request.url === "/api/me/records");

it("sends no save once another user has signed in, and starts again as that user", async () => {
  const held = heldRequests();
  markAs("aaaa");
  render(
    <RecordsProvider ready>
      <Received />
      <RecordAction ids={["a"]} />
    </RecordsProvider>,
  );
  await waitFor(() => expect(summaries(held)).toHaveLength(1));
  await held[0].answer(200, []);
  expect(received().textContent).toBe("ready:");
  // The other tab's sign-in finished while this one showed the old detail.
  markAs("bbbb");
  fireEvent.click(screen.getByRole("button", { name: "回収した" }));
  await waitFor(() => expect(received().textContent).toBe("loading:"));
  expect(held.filter((request) => request.method !== "GET")).toEqual([]);
  expect(screen.getByRole("status", { name: "通知" }).textContent).toContain(
    "保存しませんでした",
  );
  await waitFor(() => expect(summaries(held)).toHaveLength(2));
  expect(summaries(held)[1].mark).toBe("bbbb");
  document.cookie = "session_mark=; Max-Age=0; Path=/";
});
it("comes back for the user who signed in after a sign-out was noticed", async () => {
  const held = heldRequests();
  markAs("aaaa");
  render(
    <RecordsProvider ready>
      <Received />
    </RecordsProvider>,
  );
  await waitFor(() => expect(summaries(held)).toHaveLength(1));
  await held[0].answer(200, [{ cardId: "a", receivedOn: null }]);
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  document.cookie = "session_mark=; Max-Age=0; Path=/";
  fireEvent(window, new Event("focus"));
  expect(received().textContent).toBe("signed-out:");
  document.cookie = "signed_in=1; Path=/";
  markAs("bbbb");
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(summaries(held)).toHaveLength(2));
  await summaries(held)[1].answer(200, [{ cardId: "b", receivedOn: null }]);
  expect(received().textContent).toBe("ready:b");
  expect(document.cookie).toContain("signed_in=1");
  document.cookie = "session_mark=; Max-Age=0; Path=/";
});
it("ignores a 401 asked for by the user before, once another has signed in", async () => {
  const held = heldRequests();
  markAs("aaaa");
  render(
    <RecordsProvider ready>
      <Received />
    </RecordsProvider>,
  );
  await waitFor(() => expect(summaries(held)).toHaveLength(1));
  markAs("bbbb");
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(summaries(held)).toHaveLength(2));
  await summaries(held)[1].answer(200, [{ cardId: "b", receivedOn: null }]);
  await summaries(held)[0].answer(401);
  expect(received().textContent).toBe("ready:b");
  expect(document.cookie).toContain("signed_in=1");
  expect(document.cookie).toContain("session_mark=bbbb");
  document.cookie = "session_mark=; Max-Age=0; Path=/";
});

// Opens and closes the detail of one card after the summary has arrived.
function DetailHarness() {
  const [open, setOpen] = useState(false);
  const { phase } = useRecords();
  return (
    <>
      <output aria-label="記録の状態">{phase}</output>
      <button onClick={() => setOpen(!open)}>
        {open ? "詳細を閉じる" : "詳細を開く"}
      </button>
      {open && (
        <>
          <RecordAction ids={["a"]} />
          <RecordEditor cardId="a" />
        </>
      )}
    </>
  );
}
/** The summary answers at once; each detail read waits for `answer`. */
function heldDetails(summary: unknown) {
  const reads: ((status: number, body?: unknown) => Promise<void>)[] = [];
  vi.mocked(fetch).mockImplementation((url, init) =>
    init?.method === "PUT"
      ? Promise.resolve(
          new Response(
            JSON.stringify({ cardId: "a", receivedOn: japanToday() }),
          ),
        )
      : url === "/api/me/records"
        ? Promise.resolve(new Response(JSON.stringify(summary)))
        : new Promise((resolve) => {
            reads.push(async (status, body) => {
              await act(async () =>
                resolve(
                  new Response(
                    body === undefined ? null : JSON.stringify(body),
                    {
                      status,
                    },
                  ),
                ),
              );
            });
          }),
  );
  return reads;
}
async function mountDetail(summary: unknown) {
  const reads = heldDetails(summary);
  render(
    <RecordsProvider ready>
      <DetailHarness />
    </RecordsProvider>,
  );
  await waitFor(() =>
    expect(screen.getByRole("status", { name: "記録の状態" }).textContent).toBe(
      "ready",
    ),
  );
  return reads;
}
const panel = () => screen.getByRole("region", { name: "回収の記録" });
it("shows a listed card's receipt at once and fills in only the memo", async () => {
  const reads = await mountDetail([{ cardId: "a", receivedOn: "2026-11-01" }]);
  fireEvent.click(screen.getByRole("button", { name: "詳細を開く" }));
  expect(within(panel()).getByText("回収済み")).toBeTruthy();
  expect(within(panel()).getByText("2026年11月1日")).toBeTruthy();
  expect(screen.queryByText("記録を読み込み中…")).toBeNull();
  // The form would start from a memo that has not arrived yet.
  const edit = screen.getByRole("button", { name: "日付・メモを編集" });
  expect(edit.getAttribute("aria-disabled")).toBe("true");
  fireEvent.click(edit);
  expect(screen.queryByRole("textbox")).toBeNull();
  await reads[0]!(200, {
    cardId: "a",
    receivedOn: "2026-11-01",
    memo: "届いたメモ",
  });
  expect(within(panel()).getByText("届いたメモ")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "日付・メモを編集" }));
  expect(screen.getByDisplayValue("届いたメモ")).toBeTruthy();
});
it("shows an unlisted card as unreceived without waiting for the read", async () => {
  const reads = await mountDetail([{ cardId: "b", receivedOn: null }]);
  fireEvent.click(screen.getByRole("button", { name: "詳細を開く" }));
  expect(within(panel()).getByText("未回収")).toBeTruthy();
  expect(
    within(panel()).getByRole("button", { name: "回収した" }),
  ).toBeTruthy();
  expect(screen.queryByText("記録を読み込み中…")).toBeNull();
  // A record made in another tab still shows once the read answers.
  await reads[0]!(200, { cardId: "a", receivedOn: "2026-11-02", memo: null });
  expect(within(panel()).getByText("回収済み")).toBeTruthy();
  expect(within(panel()).getByText("2026年11月2日")).toBeTruthy();
});
it("shows a detail opened before at once when it is reopened", async () => {
  const reads = await mountDetail([{ cardId: "a", receivedOn: "2026-11-01" }]);
  fireEvent.click(screen.getByRole("button", { name: "詳細を開く" }));
  await reads[0]!(200, {
    cardId: "a",
    receivedOn: "2026-11-01",
    memo: "前のメモ",
  });
  fireEvent.click(screen.getByRole("button", { name: "詳細を閉じる" }));
  vi.useFakeTimers();
  try {
    fireEvent.click(screen.getByRole("button", { name: "詳細を開く" }));
    act(() => vi.advanceTimersByTime(1000));
    expect(within(panel()).getByText("前のメモ")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "日付・メモを編集" })
        .getAttribute("aria-disabled"),
    ).toBeNull();
    expect(screen.queryByText("記録を読み込み中…")).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
it("says the memo is loading only once it is 0.4 seconds late", async () => {
  const reads = await mountDetail([{ cardId: "a", receivedOn: "2026-11-01" }]);
  vi.useFakeTimers();
  try {
    fireEvent.click(screen.getByRole("button", { name: "詳細を開く" }));
    act(() => vi.advanceTimersByTime(399));
    expect(screen.queryByText("記録を読み込み中…")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText("記録を読み込み中…")).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
  await reads[0]!(200, { cardId: "a", receivedOn: "2026-11-01", memo: null });
  expect(screen.queryByText("記録を読み込み中…")).toBeNull();
});

const writes = () =>
  vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "PUT");
const receiveInPanel = () =>
  fireEvent.click(within(panel()).getByRole("button", { name: "回収した" }));
it("holds a receipt pressed before the read and sends none for a card recorded elsewhere", async () => {
  const reads = await mountDetail([]);
  fireEvent.click(screen.getByRole("button", { name: "詳細を開く" }));
  receiveInPanel();
  expect(within(panel()).getByText("回収済み")).toBeTruthy();
  await act(async () => {});
  expect(writes()).toHaveLength(0);
  await reads[0]!(200, {
    cardId: "a",
    receivedOn: "2026-11-02",
    memo: "別のタブのメモ",
  });
  expect(within(panel()).getByText("別のタブのメモ")).toBeTruthy();
  expect(within(panel()).getByText("2026年11月2日")).toBeTruthy();
  await act(async () => {});
  expect(writes()).toHaveLength(0);
});
it("sends a held receipt once the read finds no record, and only once", async () => {
  const reads = await mountDetail([]);
  fireEvent.click(screen.getByRole("button", { name: "詳細を開く" }));
  const [quick] = screen.getAllByRole("button", { name: "回収した" });
  fireEvent.click(quick!);
  fireEvent.click(screen.getByRole("button", { name: "取り消す" }));
  fireEvent.click(screen.getAllByRole("button", { name: "回収した" })[0]!);
  await act(async () => {});
  expect(writes()).toHaveLength(0);
  await reads[0]!(404);
  await screen.findByText("保存しました");
  expect(writes()).toHaveLength(1);
  expect(writes()[0]![1]).toMatchObject({
    body: JSON.stringify({ receivedOn: japanToday(), memo: null }),
  });
});
it("drops a held receipt when the read fails and offers no receipt until reloaded", async () => {
  const reads = await mountDetail([]);
  fireEvent.click(screen.getByRole("button", { name: "詳細を開く" }));
  receiveInPanel();
  await reads[0]!(503);
  expect(writes()).toHaveLength(0);
  expect(within(panel()).getByText("未回収")).toBeTruthy();
  expect(screen.getByRole("button", { name: "記録を再読み込み" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "回収した" })).toBeNull();
});
it("drops a held receipt when the detail closes", async () => {
  const reads = await mountDetail([]);
  fireEvent.click(screen.getByRole("button", { name: "詳細を開く" }));
  receiveInPanel();
  fireEvent.click(screen.getByRole("button", { name: "詳細を閉じる" }));
  await reads[0]!(404);
  await act(async () => {});
  expect(writes()).toHaveLength(0);
});
it("drops a held receipt when another user signs in", async () => {
  document.cookie = "session_mark=aaaa; Path=/";
  try {
    const reads = await mountDetail([]);
    fireEvent.click(screen.getByRole("button", { name: "詳細を開く" }));
    receiveInPanel();
    document.cookie = "session_mark=bbbb; Path=/";
    fireEvent(window, new Event("focus"));
    await reads[0]!(404);
    await act(async () => {});
    expect(writes()).toHaveLength(0);
  } finally {
    document.cookie = "session_mark=; Max-Age=0; Path=/";
  }
});
