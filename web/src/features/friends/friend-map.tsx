import { useEffect, useMemo, useState, type ReactNode } from "react";
import { signedIn } from "../../shared/browser/signed-in";
import {
  RecordsContext,
  inactive,
  type Phase,
} from "../records/records-context";
import type { Receipt, ReceiptFilter } from "../../domain/records";
import { friendsApi, type Friend } from "./friends-api";
import "../records/records.css";
const EMPTY_ALIASES: Record<string, string> = {};
export default function FriendMap({
  friendId,
  ready,
  aliases = EMPTY_ALIASES,
  children,
}: {
  friendId: string;
  ready: boolean;
  aliases?: Record<string, string>;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState<{
    friendId: string;
    name: string;
    records: Receipt[];
    phase: Phase;
  }>({
    friendId,
    name: "",
    records: [],
    phase: signedIn() ? "loading" : "failed",
  });
  const [filter, setFilter] = useState<ReceiptFilter>("all");
  const enabled = import.meta.env.VITE_ACCOUNTS_ENABLED === "true";
  useEffect(() => {
    let active = true;
    const clear = () => {
      if (active)
        setSnapshot({ friendId, name: "", records: [], phase: "failed" });
    };
    const check = () => {
      if (!signedIn()) clear();
    };
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    document.addEventListener("visibilitychange", check);
    if (enabled && ready && signedIn()) {
      void Promise.all([
        friendsApi<{ friends: Friend[] }>("/api/friends"),
        friendsApi<{ count: number; records: Receipt[] }>(
          `/api/friends/${encodeURIComponent(friendId)}/records`,
        ),
      ])
        .then(([{ friends }, { records }]) => {
          const friend = friends.find((person) => person.userId === friendId);
          if (
            !friend ||
            !Array.isArray(records) ||
            records.some(
              (row) =>
                typeof row?.cardId !== "string" ||
                !(
                  row.receivedOn === null || typeof row.receivedOn === "string"
                ),
            )
          )
            throw new Error("invalid friend records");
          if (active && signedIn())
            setSnapshot({
              friendId,
              name: friend.displayName,
              records: records.map(({ cardId, receivedOn }) => ({
                cardId,
                receivedOn,
              })),
              phase: "ready",
            });
        })
        .catch(clear);
    } else if (!signedIn()) clear();
    return () => {
      active = false;
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [enabled, friendId, ready]);
  const value = useMemo(() => {
    const phase = snapshot.friendId === friendId ? snapshot.phase : "loading";
    const records =
      phase === "ready"
        ? new Map(
            snapshot.records.map((row) => {
              const cardId = aliases[row.cardId] ?? row.cardId;
              return [cardId, { cardId, receivedOn: row.receivedOn }];
            }),
          )
        : null;
    return {
      ...inactive,
      phase,
      friendName: phase === "ready" ? snapshot.name : "",
      records,
      filter,
      setFilter,
      matches: (id: string) =>
        !records ||
        filter === "all" ||
        records.has(id) === (filter === "received"),
    };
  }, [snapshot, friendId, aliases, filter]);
  return (
    <RecordsContext value={enabled ? value : inactive}>
      {children}
    </RecordsContext>
  );
}
