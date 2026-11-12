import {
  forgetSignedIn,
  onPageReturn,
  signedIn,
} from "../../shared/browser/signed-in";
import { sessionGuard } from "../../shared/browser/session-guard";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  isReceipt,
  matchesReceiptFilter,
  receiptsByCard,
  type Receipt,
  type ReceiptFilter,
} from "../../domain/records";
import { ApiError, apiFetch, refusalMessage } from "../../shared/browser/api";
import { painted } from "../../shared/browser/painted";
import {
  RecordsContext,
  NO_ALIASES,
  inactive,
  emptyDetail,
  type Records,
  type Phase,
  type RecordDetail,
  type ReceiptDetail,
} from "./records-context";
function recordErrorMessage(error: unknown) {
  return (
    refusalMessage(error, "保存できませんでした") ??
    "保存できませんでした。通信を確認してやり直してください。"
  );
}
const NOT_SAVED =
  "別のタブで利用者が替わったため、保存しませんでした。記録を読み込み直しています。";
function EnabledRecordsProvider({
  ready,
  aliases = NO_ALIASES,
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
  // Read by the session checks, which run outside a render.
  const signedOut = useRef(phase === "signed-out");
  signedOut.current = phase === "signed-out";
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
  // The generation of each card's read in flight.
  const reading = useRef(new Map<string, number>());
  // A receipt pressed before the card's read answered, and the summary's
  // receipt before it. It is sent only once the read finds no record: an
  // explicit null memo would clear one saved elsewhere.
  const holds = useRef(
    new Map<string, { record: ReceiptDetail; receipt: Receipt | null }>(),
  );
  const [notification, setNotification] = useState("");
  const [filter, setFilter] = useState<ReceiptFilter>("all");
  // Moves on with each change of user, to ask for the new user's records.
  const [round, setRound] = useState(0);
  const started = useRef(false);
  // Mounted. A sign-out or a change of user restarts the guard instead.
  const active = useRef(true);
  // Whose records these are; every request goes through it (`request`).
  const [guard] = useState(sessionGuard);
  const aliasesRef = useRef(aliases);
  aliasesRef.current = aliases;
  const clear = useCallback(() => {
    guard.restart();
    summaries.current = null;
    detailRef.current.clear();
    generations.current.clear();
    rollbacks.current.clear();
    reading.current.clear();
    holds.current.clear();
    setDetails(new Map());
    setNotification("");
    setRecords(null);
    setFilter("all");
  }, [guard]);
  const expire = useCallback(() => {
    // Before `forgetSignedIn` tells the checks, this one among them.
    signedOut.current = true;
    forgetSignedIn();
    clear();
    setPhase("signed-out");
  }, [clear]);
  // Another user signed in elsewhere: start again as that user.
  const changeUser = useCallback(
    (notice = "") => {
      signedOut.current = false;
      // A receipt held for its read is a save not made, too.
      const dropped = holds.current.size > 0;
      clear();
      setNotification(notice || (dropped ? NOT_SAVED : ""));
      started.current = false;
      setPhase("loading");
      setRound((round) => round + 1);
    },
    [clear],
  );
  // Uncached, and 404 comes back as a response: a card without a record.
  // Every caller drops the outcome once the guard's epoch has moved on.
  const request = useCallback(
    async (path: string, init?: RequestInit) => {
      const sent = await guard.send(() =>
        apiFetch(path, { ...init, cache: "no-store" }),
      );
      if (sent.kind === "changed")
        changeUser(init?.method && init.method !== "GET" ? NOT_SAVED : "");
      if (
        sent.kind === "signed-out" ||
        (sent.kind === "answer" && (sent.value.status === 401 || !signedIn()))
      )
        expire();
      if (sent.kind !== "answer" || sent.value.status === 401)
        throw new ApiError(401);
      const response = sent.value;
      if (!response.ok && response.status !== 404)
        throw new ApiError(response.status);
      return response;
    },
    [guard, expire, changeUser],
  );
  useEffect(() => {
    active.current = true;
    const currentDetails = detailRef.current;
    const currentGenerations = generations.current;
    const currentRollbacks = rollbacks.current;
    const currentReading = reading.current;
    const currentHolds = holds.current;
    // Signed in or out on another screen or tab: the records follow. A
    // session that has none yet starts loading as a change of user.
    const stop = onPageReturn(() => {
      if (!enabled) return;
      if (!signedIn()) {
        if (!signedOut.current) expire();
      } else if (signedOut.current || !guard.current()) changeUser();
    });
    return () => {
      active.current = false;
      currentDetails.clear();
      currentGenerations.clear();
      currentRollbacks.clear();
      currentReading.clear();
      currentHolds.clear();
      summaries.current = null;
      stop();
    };
  }, [enabled, expire, changeUser, guard]);
  useEffect(() => {
    if (!enabled || !ready || phase !== "loading") return;
    let cancelled = false;
    void painted().then(async () => {
      if (cancelled || started.current) return;
      started.current = true;
      const { epoch } = guard;
      try {
        const response = await request("/api/me/records");
        if (!response.ok) throw new ApiError(response.status);
        const rows: Receipt[] = await response.json();
        if (!Array.isArray(rows) || !rows.every(isReceipt))
          throw new Error("invalid records");
        if (!active.current || epoch !== guard.epoch) return;
        const next = receiptsByCard(rows, aliasesRef.current);
        summaries.current = next;
        setRecords(next);
        setPhase("ready");
      } catch {
        if (active.current && epoch === guard.epoch) {
          setRecords(null);
          setPhase("failed");
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, ready, phase, request, round, guard]);
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
  const send = useCallback(
    async (id: string, record: ReceiptDetail | null) => {
      if (detailRef.current.get(id)?.pending) return;
      const previous = rollbacks.current.get(id) ?? {
        detail: detailRef.current.get(id) ?? emptyDetail,
        receipt: summaries.current?.get(id) ?? null,
      };
      rollbacks.current.set(id, previous);
      const generation = nextGeneration(id);
      const { epoch } = guard;
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
        if (
          !active.current ||
          epoch !== guard.epoch ||
          generations.current.get(id) !== generation
        )
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
        if (
          !active.current ||
          epoch !== guard.epoch ||
          generations.current.get(id) !== generation
        )
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
    [guard, nextGeneration, publishDetail, request, update],
  );
  const load = useCallback(
    async (id: string) => {
      const previous = detailRef.current.get(id) ?? emptyDetail;
      // A reopened detail uses the in-flight optimistic value and cannot read it away.
      if (previous.pending) return;
      const generation = nextGeneration(id);
      reading.current.set(id, generation);
      const { epoch } = guard;
      publishDetail(id, { ...previous, loadError: "" });
      try {
        const response = await request(
          `/api/me/records/${encodeURIComponent(id)}`,
        );
        const record: ReceiptDetail | null =
          response.status === 404 ? null : await response.json();
        if (
          record &&
          !(
            isReceipt(record) &&
            (record.memo === null || typeof record.memo === "string")
          )
        )
          throw new Error("invalid record");
        if (
          !active.current ||
          epoch !== guard.epoch ||
          generations.current.get(id) !== generation
        )
          return;
        reading.current.delete(id);
        const held = holds.current.get(id);
        holds.current.delete(id);
        publishDetail(id, { ...emptyDetail, record, loaded: true });
        update(id, record);
        // Already received: the press has nothing left to do.
        if (held && !record) void send(id, held.record);
      } catch {
        if (
          !active.current ||
          epoch !== guard.epoch ||
          generations.current.get(id) !== generation
        )
          return;
        reading.current.delete(id);
        const held = holds.current.get(id);
        holds.current.delete(id);
        if (held) update(id, held.receipt);
        publishDetail(id, {
          ...previous,
          loadError: "記録を読み込めませんでした",
        });
      }
    },
    [guard, nextGeneration, publishDetail, request, update, send],
  );
  const save = useCallback(
    async (id: string, record: ReceiptDetail | null) => {
      const held = holds.current.get(id);
      if (held) {
        // A second press waits with the first; taking it back sends nothing.
        if (!record) {
          holds.current.delete(id);
          update(id, held.receipt);
        }
        return;
      }
      if (record && !detailRef.current.get(id)?.loaded) {
        // Checked as a write would be, though nothing is sent yet.
        if (!guard.current()) {
          if (signedIn()) changeUser(NOT_SAVED);
          else expire();
          return;
        }
        holds.current.set(id, {
          record,
          receipt: summaries.current?.get(id) ?? null,
        });
        setNotification("");
        update(id, record);
        const read = reading.current.get(id);
        if (read === undefined || read !== generations.current.get(id))
          void load(id);
        return;
      }
      return send(id, record);
    },
    [guard, changeUser, expire, load, send, update],
  );
  // The detail has closed: a held receipt is never sent.
  const abandon = useCallback(
    (id: string) => {
      const held = holds.current.get(id);
      if (!held) return;
      holds.current.delete(id);
      update(id, held.receipt);
    },
    [update],
  );
  const matches = useCallback(
    (id: string) => matchesReceiptFilter(records, filter, id),
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
      abandon,
      notification,
      matches,
    }),
    [
      phase,
      records,
      filter,
      details,
      load,
      save,
      abandon,
      notification,
      matches,
    ],
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
