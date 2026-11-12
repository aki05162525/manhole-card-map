import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  forgetSignedIn,
  onPageReturn,
  signedIn,
} from "../../shared/browser/signed-in";
import { sessionGuard } from "../../shared/browser/session-guard";
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
import { api, isApiError } from "../account/account-api";
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
  // Opened to see what the friend has collected; the other segments remain.
  const [filter, setFilter] = useState<ReceiptFilter>("received");
  const enabled = import.meta.env.VITE_ACCOUNTS_ENABLED === "true";
  // Fetched as one user; every request goes through it.
  const [guard] = useState(sessionGuard);
  useEffect(() => {
    let active = true;
    const fail = () => {
      if (active)
        setSnapshot({ friendId, name: "", records: [], phase: "failed" });
    };
    // Signed out, or another user signed in elsewhere: the records shown
    // were fetched for someone else, and an answer still on its way too.
    const stop = onPageReturn(() => {
      if (guard.current()) return;
      guard.restart();
      fail();
    });
    if (enabled && ready && signedIn()) {
      // Answers 404 unless they are friends, with the name in the same reply.
      void guard
        .send(() =>
          api<{
            displayName: string;
            count: number;
            records: Receipt[];
          }>(`/api/friends/${encodeURIComponent(friendId)}/records`),
        )
        .then((sent) => {
          if (sent.kind === "stale") return;
          if (sent.kind !== "answer") return fail();
          const { displayName, records } = sent.value;
          if (
            typeof displayName !== "string" ||
            !Array.isArray(records) ||
            !records.every(isReceipt)
          )
            throw new Error("invalid friend records");
          if (active && signedIn())
            setSnapshot({
              friendId,
              name: displayName,
              records: records.map(({ cardId, receivedOn }) => ({
                cardId,
                receivedOn,
              })),
              phase: "ready",
            });
        })
        .catch((error: unknown) => {
          // The guard passes on only this user's failures.
          if (isApiError(error, 401)) forgetSignedIn();
          fail();
        });
    } else if (!signedIn()) fail();
    return () => {
      active = false;
      stop();
    };
  }, [enabled, friendId, ready, guard]);
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
