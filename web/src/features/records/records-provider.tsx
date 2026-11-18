import { onPageReturn, signedIn } from "../../session/signed-in";
import { sessionGuard, type Owner } from "../../session/session-guard";
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
import {
  ApiError,
  apiFailure,
  apiFetch,
  refusalMessage,
} from "../../session/api";
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
// Sent for the user before, and answered once another had signed in.
const SAVE_UNKNOWN =
  "保存の途中で別のタブの利用者が替わったため、保存できたか確かめられませんでした。記録を読み込み直しています。";
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
  // The owner the records and details held now were got as: each start
  // again (`clear`) gives the guard a new one, and empties them with it.
  // Handed on with them, for each part to check as it draws (`useRecords`).
  const [owner, setOwner] = useState(() => guard.owner);
  const aliasesRef = useRef(aliases);
  aliasesRef.current = aliases;
  const clear = useCallback(() => {
    guard.restart();
    setOwner(guard.owner);
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
  // Signed out, as the checks below see it (the guard, or another page,
  // has forgotten the cookies and told every screen): the records go.
  const expire = useCallback(() => {
    signedOut.current = true;
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
  // Any other failure carries the Worker's `{ error }` code, as every
  // private request's does, so the guard tells a refusal as a recovery's
  // session's (403 `recovery_session`) from any other 403.
  // `read` takes what the answer holds inside the guard, so the body is
  // the user's only if the cookies still name them once it has been read
  // (PF-5). Each request is its operation's `owner`'s, and every caller
  // drops the outcome once the guard has another owner. The guard passes on
  // only this user's failures, and tells every screen of a 401 among them
  // (or of an answer that finds the cookies gone) as it checks them: the
  // check below (`onPageReturn`) then signs the records out.
  const request = useCallback(
    async <T,>(
      owner: Owner,
      path: string,
      read: (response: Response) => Promise<T>,
      init?: RequestInit,
    ): Promise<T> => {
      const sent = await guard.send(
        async () => {
          const response = await apiFetch(path, { ...init, cache: "no-store" });
          if (!response.ok && response.status !== 404)
            throw await apiFailure(response);
          return read(response);
        },
        undefined,
        owner,
      );
      // Begun as the owner of the records still: they start again as the
      // user signed in now, once, however many answers tell of it.
      if (sent.kind === "changed" && guard.owner === owner)
        changeUser(
          init?.method && init.method !== "GET"
            ? sent.sent
              ? SAVE_UNKNOWN
              : NOT_SAVED
            : "",
        );
      if (sent.kind !== "answer") throw new ApiError(401);
      return sent.value;
    },
    [guard, changeUser],
  );
  useEffect(() => {
    active.current = true;
    // Left (unmounted): what comes back after, a 401 included, is dropped.
    guard.open();
    const currentDetails = detailRef.current;
    const currentGenerations = generations.current;
    const currentRollbacks = rollbacks.current;
    const currentReading = reading.current;
    const currentHolds = holds.current;
    // Signed in or out on another screen or tab: the records follow. A
    // session that has none yet starts loading as a change of user, and so
    // do records an hour past their last answer: the Worker may have ended
    // the session on its own (`DORMANT_MS`), so they are hidden and read
    // again.
    const stop = onPageReturn(() => {
      if (!enabled) return;
      if (!signedIn()) {
        if (!signedOut.current) expire();
      } else if (signedOut.current || !guard.current() || guard.dormant())
        changeUser();
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
      guard.close();
    };
  }, [enabled, expire, changeUser, guard]);
  useEffect(() => {
    if (!enabled || !ready || phase !== "loading") return;
    let cancelled = false;
    void painted().then(async () => {
      if (cancelled || started.current) return;
      started.current = true;
      const { owner } = guard;
      try {
        const rows = await request(
          owner,
          "/api/me/records",
          async (response) => {
            if (!response.ok) throw new ApiError(response.status);
            const rows: unknown = await response.json();
            if (!Array.isArray(rows) || !rows.every(isReceipt))
              throw new Error("invalid records");
            return rows;
          },
        );
        if (!active.current || !guard.owns(owner)) return;
        const next = receiptsByCard(rows, aliasesRef.current);
        summaries.current = next;
        setRecords(next);
        setPhase("ready");
      } catch {
        if (active.current && guard.owns(owner)) {
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
      const { owner } = guard;
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
        const confirmed = await request(
          owner,
          `/api/me/records/${encodeURIComponent(id)}`,
          async (response) => {
            if (!response.ok) throw new Error(String(response.status));
            if (!record) return record;
            const saved: Receipt = await response.json();
            if (
              !(
                saved.receivedOn === null ||
                typeof saved.receivedOn === "string"
              )
            )
              throw new Error("invalid record");
            return { ...record, receivedOn: saved.receivedOn };
          },
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
        if (
          !active.current ||
          !guard.owns(owner) ||
          generations.current.get(id) !== generation
        )
          return;
        rollbacks.current.delete(id);
        update(id, confirmed);
        publishDetail(id, {
          ...emptyDetail,
          record: confirmed,
          loaded: true,
          status: record ? "保存しました" : "未入手に戻しました",
        });
      } catch (cause) {
        if (
          !active.current ||
          !guard.owns(owner) ||
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
      const { owner } = guard;
      publishDetail(id, { ...previous, loadError: "" });
      try {
        const record = await request(
          owner,
          `/api/me/records/${encodeURIComponent(id)}`,
          async (response) => {
            if (response.status === 404) return null;
            const record: ReceiptDetail = await response.json();
            if (
              !(
                isReceipt(record) &&
                (record.memo === null || typeof record.memo === "string")
              )
            )
              throw new Error("invalid record");
            return record;
          },
        );
        if (
          !active.current ||
          !guard.owns(owner) ||
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
          !guard.owns(owner) ||
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
        // Checked as a write would be, though nothing is sent yet: the
        // guard tells of a session found over (the check above signs the
        // records out).
        const unsent = guard.check();
        if (unsent) {
          if (unsent.kind === "changed") changeUser(NOT_SAVED);
          else if (unsent.kind === "signed-out" && !signedOut.current) expire();
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
      // Signed out, nothing of a user's is held.
      owner: phase === "signed-out" ? null : owner,
      owns: guard.owns,
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
      owner,
      guard,
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
