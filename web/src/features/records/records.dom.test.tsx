import { StrictMode, useState, useEffect } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRecords } from "./records-context";
import { RecordsProvider } from "./records-provider";
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
  fireEvent.click(await screen.findByRole("button", { name: "受け取った" }));
  fireEvent.click(screen.getByRole("button", { name: "詳細を閉じる" }));
  fireEvent.click(screen.getByRole("button", { name: "詳細を開く" }));
  await act(async () => {});
  expect(screen.getByRole("status", { name: "記録のカード" }).textContent).toBe(
    "a",
  );
  expect(screen.getByRole("button", { name: "記録を保存" })).toHaveProperty(
    "disabled",
    true,
  );
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
  expect(screen.getByLabelText("受け取った日（未設定可）")).toHaveProperty(
    "value",
    "2026-01-02",
  );
});
it("announces a failed save after leaving the detail and restores its receipt", async () => {
  const write = deferredResponse();
  render(
    <RecordsProvider ready aliases={{ old: "a" }}>
      <ReopenHarness />
    </RecordsProvider>,
  );
  await screen.findByDisplayValue("元のメモ");
  vi.mocked(fetch).mockReturnValue(write.promise);
  fireEvent.click(screen.getByRole("button", { name: "受け取りを取り消す" }));
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
it.each([200, 500])(
  "ignores an older save response after a newer save succeeds (older status=%i)",
  async (olderStatus) => {
    mountProbe();
    await screen.findByDisplayValue("元のメモ");
    const older = deferredResponse(),
      newer = deferredResponse();
    vi.mocked(fetch)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    let first!: Promise<void>, second!: Promise<void>;
    act(() => {
      first = store.save("a", {
        cardId: "a",
        receivedOn: "2026-01-01",
        memo: "古い保存",
      });
    });
    act(() => {
      second = store.save("a", {
        cardId: "a",
        receivedOn: "2026-01-02",
        memo: "新しい保存",
      });
    });
    await act(async () => {
      newer.resolve(new Response('{"cardId":"a","receivedOn":"2026-01-02"}'));
      await second;
    });
    const confirmed = store.records;
    await act(async () => {
      older.resolve(
        new Response(
          olderStatus === 200
            ? '{"cardId":"a","receivedOn":"2026-01-01"}'
            : null,
          { status: olderStatus },
        ),
      );
      await first;
    });
    expect(store.records).toBe(confirmed);
    expect(store.details.get("a")).toMatchObject({
      pending: false,
      record: { receivedOn: "2026-01-02", memo: "新しい保存" },
    });
    expect(screen.getByDisplayValue("新しい保存")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  },
);
it.each([404, 500, 200])(
  "ignores a detail response started before the current save (stale status=%i)",
  async (status) => {
    mountProbe();
    await screen.findByDisplayValue("元のメモ");
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
  await screen.findByDisplayValue("元のメモ");
  const summary = store.records;
  await act(async () => {
    await store.load("a");
  });
  expect(store.records).toBe(summary);
});

it("rolls overlapping failed saves back to the last confirmed value", async () => {
  mountProbe();
  await screen.findByDisplayValue("元のメモ");
  const older = deferredResponse(),
    newer = deferredResponse();
  vi.mocked(fetch)
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newer.promise);
  let first!: Promise<void>, second!: Promise<void>;
  act(() => {
    first = store.save("a", {
      cardId: "a",
      receivedOn: "2026-01-01",
      memo: "古い保存",
    });
  });
  act(() => {
    second = store.save("a", {
      cardId: "a",
      receivedOn: "2026-01-02",
      memo: "新しい保存",
    });
  });
  await act(async () => {
    newer.resolve(new Response(null, { status: 500 }));
    await second;
  });
  await act(async () => {
    older.resolve(new Response(null, { status: 500 }));
    await first;
  });
  expect(store.details.get("a")).toMatchObject({
    pending: false,
    record: { receivedOn: null, memo: "元のメモ" },
  });
  expect(screen.getByDisplayValue("元のメモ")).toBeTruthy();
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
