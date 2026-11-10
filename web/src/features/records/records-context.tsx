import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Receipt, ReceiptFilter } from "../../domain/records";
import { painted } from "../../shared/browser/painted";
import "./records.css";

type Phase = "signed-out" | "loading" | "ready" | "failed";
const signedIn = () =>
  document.cookie.split(";").some((part) => part.trim() === "signed_in=1");
class RecordsError extends Error {
  constructor(public status: number) {
    super(String(status));
  }
}
export function recordErrorMessage(error: unknown) {
  return error instanceof RecordsError && error.status === 403
    ? "パスキーでログインし直してから操作してください。"
    : error instanceof RecordsError && error.status === 429
      ? "操作が多いため保存できませんでした。しばらく待ってからやり直してください。"
      : "保存できませんでした。通信を確認してやり直してください。";
}
type Records = {
  phase: Phase;
  records: ReadonlyMap<string, Receipt> | null;
  filter: ReceiptFilter;
  setFilter(filter: ReceiptFilter): void;
  matches(id: string): boolean;
  request(path: string, init?: RequestInit): Promise<Response>;
  update(id: string, record: Receipt | null): void;
};
const inactive: Records = {
  phase: "signed-out",
  records: null,
  filter: "all",
  setFilter() {},
  matches: () => true,
  request: () => Promise.reject(new Error("signed out")),
  update() {},
};
const RecordsContext = createContext<Records>(inactive);
export function useRecords() {
  return useContext(RecordsContext);
}
const EMPTY_ALIASES: Record<string, string> = {};
export function RecordsProvider({
  ready,
  aliases = EMPTY_ALIASES,
  children,
}: {
  ready: boolean;
  aliases?: Record<string, string>;
  children: ReactNode;
}) {
  const enabled = import.meta.env.VITE_ACCOUNTS_ENABLED === "true";
  const [phase, setPhase] = useState<Phase>(() =>
    enabled && signedIn() ? "loading" : "signed-out",
  );
  const [records, setRecords] = useState<Map<string, Receipt> | null>(null);
  const [filter, setFilter] = useState<ReceiptFilter>("all");
  const started = useRef(false);
  const active = useRef(true);
  const aliasesRef = useRef(aliases);
  aliasesRef.current = aliases;
  const expire = useCallback(() => {
    active.current = false;
    document.cookie = "signed_in=; Max-Age=0; Path=/; SameSite=Lax";
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
    const check = () => {
      if (enabled && !signedIn()) expire();
    };
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      active.current = false;
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      document.removeEventListener("visibilitychange", check);
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
        setRecords(
          new Map(
            rows.map((row) => {
              const cardId = aliasesRef.current[row.cardId] ?? row.cardId;
              return [cardId, { cardId, receivedOn: row.receivedOn }];
            }),
          ),
        );
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
    if (!active.current) return;
    setRecords((previous) => {
      if (!previous) return previous;
      const next = new Map(previous);
      if (record) next.set(id, record);
      else next.delete(id);
      return next;
    });
  }, []);
  const value = useMemo<Records>(
    () => ({
      phase,
      records,
      filter,
      setFilter,
      request,
      update,
      matches: (id) =>
        !records ||
        filter === "all" ||
        records.has(id) === (filter === "received"),
    }),
    [phase, records, filter, request, update],
  );
  return (
    <RecordsContext value={enabled ? value : inactive}>
      {children}
    </RecordsContext>
  );
}
