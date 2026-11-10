import { useEffect, useMemo, useState, type ReactNode } from "react";
import { onPageReturn, signedIn } from "../../shared/browser/signed-in";
import {
  RecordsContext,
  NO_ALIASES,
  inactive,
  type Phase,
} from "../records/records-context";
import {
  isReceipt,
  matchesReceiptFilter,
  receiptsByCard,
  type Receipt,
  type ReceiptFilter,
} from "../../domain/records";
import { friendsApi, type Friend } from "./friends-api";
import "../records/records.css";

export default function FriendMap({
  friendId,
  ready,
  aliases = NO_ALIASES,
  children,
}: {
  friendId: string;
  ready: boolean;
  aliases?: Record<string, string> | undefined;
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
    const stop = onPageReturn(() => {
      if (!signedIn()) clear();
    });
    if (enabled && ready && signedIn()) {
      void Promise.all([
        friendsApi<{ friends: Friend[] }>("/api/friends"),
        friendsApi<{ count: number; records: Receipt[] }>(
          `/api/friends/${encodeURIComponent(friendId)}/records`,
        ),
      ])
        .then(([{ friends }, { records }]) => {
          const friend = friends.find((person) => person.userId === friendId);
          if (!friend || !Array.isArray(records) || !records.every(isReceipt))
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
      stop();
    };
  }, [enabled, friendId, ready]);
  const value = useMemo(() => {
    const phase = snapshot.friendId === friendId ? snapshot.phase : "loading";
    const records =
      phase === "ready" ? receiptsByCard(snapshot.records, aliases) : null;
    return {
      ...inactive,
      phase,
      friendName: phase === "ready" ? snapshot.name : "",
      records,
      filter,
      setFilter,
      matches: (id: string) => matchesReceiptFilter(records, filter, id),
    };
  }, [snapshot, friendId, aliases, filter]);
  return (
    <RecordsContext value={enabled ? value : inactive}>
      {children}
    </RecordsContext>
  );
}
