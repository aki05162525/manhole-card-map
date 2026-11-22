import { onPageReturn, signedIn } from "../../session/signed-in";
import { sessionGuard, type Owner } from "../../session/session-guard";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isReceipts } from "../../contract/private-api";
import {
  matchesReceiptFilter,
  receiptsByCard,
  type Receipt,
  type ReceiptFilter,
} from "../../domain/records";
import { ApiError, apiFailure, apiFetch } from "../../session/api";
import { failureMessage } from "../../session/failure-messages";
import { painted } from "../../shared/browser/painted";
import {
  RecordsContext,
  NO_ALIASES,
  type Records,
  type Phase,
  type RecordDetail,
  type ReceiptDetail,
} from "./records-context";
import {
  NOT_SAVED,
  detailsOf,
  initialRecords,
  readRecord,
  readSaved,
  restart,
  step,
  type RecordEvent,
} from "./record-state";
const NO_DETAILS: ReadonlyMap<string, RecordDetail> = new Map();
function recordErrorMessage(error: unknown) {
  return failureMessage(
    error,
    "保存できませんでした。通信を確認してやり直してください。",
  );
}
// Sent for the user before, and answered once another had signed in.
const SAVE_UNKNOWN =
  "保存の途中で別のタブのアカウントが切り替わったため、保存できたか確認できませんでした。記録を読み込み直しています。";
// Mounted only in a build with accounts (`RecordsProvider`).
function EnabledRecordsProvider({
  ready,
  aliases = NO_ALIASES,
  children,
}: {
  ready: boolean;
  aliases?: Record<string, string> | undefined;
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>(() =>
    signedIn() ? "loading" : "signed-out",
  );
  // Read by the session checks, which run outside a render; set with each
  // change to or from "signed-out" (`expire`, `changeUser`).
  const signedOut = useRef(phase === "signed-out");
  const [records, setRecords] = useState<Map<string, Receipt> | null>(null);
  // Each card's record, as its steps leave it (`record-state.ts`). Read and
  // stepped outside a render; what is drawn of it is `details`.
  const store = useRef(initialRecords);
  const [details, setDetails] =
    useState<ReadonlyMap<string, RecordDetail>>(NO_DETAILS);
  const summaries = useRef<Map<string, Receipt> | null>(null);
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
  // The summary's cards under their current numbers, as the aliases are
  // when it answers.
  const byCard = useEffectEvent((rows: Receipt[]) =>
    receiptsByCard(rows, aliases),
  );
  // Tells of a receipt held for its read, a save not made (`restart`).
  const clear = useCallback(() => {
    guard.restart();
    setOwner(guard.owner);
    summaries.current = null;
    const restarted = restart(store.current);
    store.current = restarted.state;
    setDetails(NO_DETAILS);
    setNotification("");
    setRecords(null);
    setFilter("all");
    return restarted.notice;
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
      const dropped = clear();
      setNotification(notice || dropped);
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
        // Only a write gives a method: a read lost tells of nothing.
        changeUser(init?.method ? (sent.sent ? SAVE_UNKNOWN : NOT_SAVED) : "");
      if (sent.kind !== "answer") throw new ApiError(401);
      return sent.value;
    },
    [guard, changeUser],
  );
  useEffect(() => {
    active.current = true;
    // Left (unmounted): what comes back after, a 401 included, is dropped.
    guard.open();
    // Signed in or out on another screen or tab: the records follow. A
    // session that has none yet starts loading as a change of user, and so
    // do records an hour past their last answer: the Worker may have ended
    // the session on its own (`DORMANT_MS`), so they are hidden and read
    // again.
    const stop = onPageReturn(() => {
      if (!signedIn()) {
        if (!signedOut.current) expire();
      } else if (signedOut.current || !guard.current() || guard.dormant())
        changeUser();
    });
    return () => {
      active.current = false;
      store.current = restart(store.current).state;
      summaries.current = null;
      stop();
      guard.close();
    };
  }, [expire, changeUser, guard]);
  useEffect(() => {
    if (!ready || phase !== "loading") return;
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
            if (!isReceipts(rows)) throw new Error("invalid records");
            return rows;
          },
        );
        if (!active.current || !guard.owns(owner)) return;
        const next = byCard(rows);
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
  }, [ready, phase, request, round, guard]);
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
  // Steps a card's record (`record-state.ts`) and does what the step says:
  // draws it, reads or writes the card through the guard, and steps again
  // with the answer, for as long as the guard still has the owner it was
  // begun as.
  const run = useCallback(
    function run(event: RecordEvent): Promise<void> {
      if (!active.current) return Promise.resolve();
      const { id } = event;
      const before = store.current;
      const outcome = step(before, event);
      store.current = outcome.state;
      if (outcome.state.cards.get(id)?.detail !== before.cards.get(id)?.detail)
        setDetails(detailsOf(outcome.state));
      if (outcome.receipt !== undefined) update(id, outcome.receipt);
      if (outcome.notice !== undefined) setNotification(outcome.notice);
      if (outcome.check) {
        // Checked as a write would be, though nothing is sent yet: the
        // guard tells of a session found over (the check above signs the
        // records out).
        const unsent = guard.check();
        if (!unsent) void run(outcome.check);
        else if (unsent.kind === "changed") changeUser(NOT_SAVED);
        else if (unsent.kind === "signed-out" && !signedOut.current) expire();
      }
      const { later, read, write } = outcome;
      if (later) queueMicrotask(() => void run(later));
      // A step reads or writes the card, never both, or neither.
      const { owner } = guard;
      const path = `/api/me/records/${encodeURIComponent(id)}`;
      const answered = () => active.current && guard.owns(owner);
      // Settles once the answer has been stepped with, not what it began.
      if (read !== undefined)
        return request(owner, path, readRecord).then(
          (record) => {
            if (answered()) void run({ type: "read", id, step: read, record });
          },
          () => {
            if (answered()) void run({ type: "read-failed", id, step: read });
          },
        );
      if (write) {
        const { record, step: written } = write;
        return request(
          owner,
          path,
          (response) => readSaved(response, record),
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
        ).then(
          (saved) => {
            if (answered())
              void run({ type: "saved", id, step: written, record: saved });
          },
          (cause: unknown) => {
            if (answered())
              void run({
                type: "save-failed",
                id,
                step: written,
                message: recordErrorMessage(cause),
              });
          },
        );
      }
      return Promise.resolve();
    },
    [guard, request, update, changeUser, expire],
  );
  const load = useCallback((id: string) => run({ type: "load", id }), [run]);
  const save = useCallback(
    (id: string, record: ReceiptDetail | null) =>
      run({
        type: "press",
        id,
        record,
        receipt: summaries.current?.get(id) ?? null,
      }),
    [run],
  );
  const view = useCallback(
    (id: string) => {
      void run({ type: "view", id });
      return () => void run({ type: "unview", id });
    },
    [run],
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
      view,
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
      view,
      notification,
      matches,
    ],
  );
  return <RecordsContext value={value}>{children}</RecordsContext>;
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
