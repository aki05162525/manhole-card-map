import {
  forgetSignedIn,
  onPageReturn,
  signedIn,
} from "../../shared/browser/signed-in";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Receipt, ReceiptFilter } from "../../domain/records";
import { painted } from "../../shared/browser/painted";
import {
  RecordsContext,
  inactive,
  emptyDetail,
  type Records,
  type Phase,
  type RecordDetail,
  type ReceiptDetail,
} from "./records-context";
class RecordsError extends Error {
  constructor(public status: number) {
    super(String(status));
  }
}
function recordErrorMessage(error: unknown) {
  return error instanceof RecordsError && error.status === 403
    ? "パスキーでログインし直してから操作してください。"
    : error instanceof RecordsError && error.status === 429
      ? "操作が多いため保存できませんでした。しばらく待ってからやり直してください。"
      : "保存できませんでした。通信を確認してやり直してください。";
}
const EMPTY_ALIASES: Record<string, string> = {};
function EnabledRecordsProvider({
  ready,
  aliases = EMPTY_ALIASES,
  children,
}: {
  ready: boolean;
  aliases?: Record<string, string> | undefined;
  children: ReactNode;
}) {
  const enabled = import.meta.env.VITE_ACCOUNTS_ENABLED === "true";
  const [phase, setPhase] = useState<Phase>(() =>
    enabled && signedIn() ? "loading" : "signed-out",
  );
  const [records, setRecords] = useState<Map<string, Receipt> | null>(null);
  const [details, setDetails] = useState<ReadonlyMap<string, RecordDetail>>(
    new Map(),
  );
  const detailRef = useRef(new Map<string, RecordDetail>());
  const generations = useRef(new Map<string, number>());
  const rollbacks = useRef(
    new Map<string, { detail: RecordDetail; receipt: Receipt | null }>(),
  );
  const summaries = useRef<Map<string, Receipt> | null>(null);
  const [notification, setNotification] = useState("");
  const [filter, setFilter] = useState<ReceiptFilter>("all");
  const started = useRef(false);
  const active = useRef(true);
  const aliasesRef = useRef(aliases);
  aliasesRef.current = aliases;
  const expire = useCallback(() => {
    active.current = false;
    forgetSignedIn();
    summaries.current = null;
    detailRef.current.clear();
    generations.current.clear();
    rollbacks.current.clear();
    setDetails(new Map());
    setNotification("");
    setRecords(null);
    setFilter("all");
    setPhase("signed-out");
  }, []);
  const request = useCallback(
    async (path: string, init?: RequestInit) => {
      if (!active.current || !signedIn()) {
        expire();
        throw new RecordsError(401);
      }
      const response = await fetch(path, {
        ...init,
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!active.current || !signedIn() || response.status === 401) {
        expire();
        throw new RecordsError(401);
      }
      if (!response.ok && response.status !== 404)
        throw new RecordsError(response.status);
      return response;
    },
    [expire],
  );
  useEffect(() => {
    active.current = true;
    const currentDetails = detailRef.current;
    const currentGenerations = generations.current;
    const currentRollbacks = rollbacks.current;
    const stop = onPageReturn(() => {
      if (enabled && !signedIn()) expire();
    });
    return () => {
      active.current = false;
      currentDetails.clear();
      currentGenerations.clear();
      currentRollbacks.clear();
      summaries.current = null;
      stop();
    };
  }, [enabled, expire]);
  useEffect(() => {
    if (!enabled || !ready || phase !== "loading") return;
    let cancelled = false;
    void painted().then(async () => {
      if (cancelled || started.current) return;
      started.current = true;
      try {
        const response = await request("/api/me/records");
        if (!response.ok) throw new RecordsError(response.status);
        const rows: Receipt[] = await response.json();
        if (
          !Array.isArray(rows) ||
          rows.some(
            (row) =>
              !row ||
              typeof row.cardId !== "string" ||
              !(row.receivedOn === null || typeof row.receivedOn === "string"),
          )
        )
          throw new Error("invalid records");
        if (!active.current) return;
        const next = new Map(
          rows.map((row) => {
            const cardId = aliasesRef.current[row.cardId] ?? row.cardId;
            return [cardId, { cardId, receivedOn: row.receivedOn }];
          }),
        );
        summaries.current = next;
        setRecords(next);
        setPhase("ready");
      } catch {
        if (active.current) {
          setRecords(null);
          setPhase("failed");
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, ready, phase, request]);
  const update = useCallback((id: string, record: Receipt | null) => {
    if (!active.current || !summaries.current) return;
    const previous = summaries.current;
    const old = previous.get(id);
    if (record ? old?.receivedOn === record.receivedOn : !old) return;
    const next = new Map(previous);
    if (record) next.set(id, { cardId: id, receivedOn: record.receivedOn });
    else next.delete(id);
    summaries.current = next;
    setRecords(next);
  }, []);
  const publishDetail = useCallback((id: string, detail: RecordDetail) => {
    detailRef.current.set(id, {
      ...detail,
      revision: generations.current.get(id) ?? 0,
    });
    setDetails(new Map(detailRef.current));
  }, []);
  const nextGeneration = useCallback((id: string) => {
    const generation = (generations.current.get(id) ?? 0) + 1;
    generations.current.set(id, generation);
    return generation;
  }, []);
  const load = useCallback(
    async (id: string) => {
      const previous = detailRef.current.get(id) ?? emptyDetail;
      // A reopened detail uses the in-flight optimistic value and cannot read it away.
      if (previous.pending) return;
      const generation = nextGeneration(id);
      publishDetail(id, { ...previous, loadError: "" });
      try {
        const response = await request(
          `/api/me/records/${encodeURIComponent(id)}`,
        );
        const record: ReceiptDetail | null =
          response.status === 404 ? null : await response.json();
        if (
          record &&
          (typeof record.cardId !== "string" ||
            !(record.memo === null || typeof record.memo === "string") ||
            !(
              record.receivedOn === null ||
              typeof record.receivedOn === "string"
            ))
        )
          throw new Error("invalid record");
        if (!active.current || generations.current.get(id) !== generation)
          return;
        publishDetail(id, { ...emptyDetail, record, loaded: true });
        update(id, record);
      } catch {
        if (!active.current || generations.current.get(id) !== generation)
          return;
        publishDetail(id, {
          ...previous,
          loadError: "記録を読み込めませんでした",
        });
      }
    },
    [nextGeneration, publishDetail, request, update],
  );
  const save = useCallback(
    async (id: string, record: ReceiptDetail | null) => {
      if (detailRef.current.get(id)?.pending) return;
      const previous = rollbacks.current.get(id) ?? {
        detail: detailRef.current.get(id) ?? emptyDetail,
        receipt: summaries.current?.get(id) ?? null,
      };
      rollbacks.current.set(id, previous);
      const generation = nextGeneration(id);
      setNotification("");
      publishDetail(id, {
        ...emptyDetail,
        record,
        loaded: true,
        pending: true,
        status: "保存中…",
      });
      update(id, record);
      try {
        const response = await request(
          `/api/me/records/${encodeURIComponent(id)}`,
          record
            ? {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  receivedOn: record.receivedOn,
                  memo: record.memo,
                }),
              }
            : { method: "DELETE" },
        );
        if (!response.ok) throw new Error(String(response.status));
        let confirmed = record;
        if (record) {
          const saved: Receipt = await response.json();
          if (
            !(saved.receivedOn === null || typeof saved.receivedOn === "string")
          )
            throw new Error("invalid record");
          confirmed = { ...record, receivedOn: saved.receivedOn };
        }
        if (!active.current || generations.current.get(id) !== generation)
          return;
        rollbacks.current.delete(id);
        update(id, confirmed);
        publishDetail(id, {
          ...emptyDetail,
          record: confirmed,
          loaded: true,
          status: record ? "保存しました" : "未回収に戻しました",
        });
      } catch (cause) {
        if (!active.current || generations.current.get(id) !== generation)
          return;
        rollbacks.current.delete(id);
        update(id, previous.receipt);
        const saveError = recordErrorMessage(cause);
        publishDetail(id, {
          ...previous.detail,
          pending: false,
          status: "",
          saveError,
        });
        setNotification(`${id}：${saveError}`);
      }
    },
    [nextGeneration, publishDetail, request, update],
  );
  const matches = useCallback(
    (id: string) =>
      !records ||
      filter === "all" ||
      records.has(id) === (filter === "received"),
    [records, filter],
  );
  const value = useMemo<Records>(
    () => ({
      phase,
      records,
      filter,
      setFilter,
      details,
      load,
      save,
      notification,
      matches,
    }),
    [phase, records, filter, details, load, save, notification, matches],
  );
  return (
    <RecordsContext value={enabled ? value : inactive}>
      {children}
    </RecordsContext>
  );
}

export function RecordsProvider(
  props: Parameters<typeof EnabledRecordsProvider>[0],
) {
  return import.meta.env.VITE_ACCOUNTS_ENABLED === "true" ? (
    <EnabledRecordsProvider {...props} />
  ) : (
    props.children
  );
}
