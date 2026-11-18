import { useEffect, useMemo, useState } from "react";
import {
  forgetSignedIn,
  onPageReturn,
  signedIn,
} from "../../session/signed-in";
import { sessionGuard } from "../../session/session-guard";
import {
  NO_ALIASES,
  inactive,
  type Phase,
  type Records,
} from "../records/records-context";
import {
  isReceipt,
  matchesReceiptFilter,
  receiptsByCard,
  type Receipt,
  type ReceiptFilter,
} from "../../domain/records";
import { api, isApiError } from "../../session/account-api";
import "../records/records.css";

/** What the map shows of one friend's records, and for which friend. */
export type FriendRecords = { friendId: string; value: Records };

/**
 * Fetches a friend's records for the map and hands them to `onChange`; it
 * renders nothing, so the map below it never remounts. Mounted for one visit
 * to one friend's map: each visit asks again whether they are still friends,
 * and on unmount the map is told to drop what it showed.
 */
export default function FriendMap({
  friendId,
  ready,
  aliases = NO_ALIASES,
  onChange,
}: {
  friendId: string;
  ready: boolean;
  aliases?: Record<string, string> | undefined;
  onChange(records: FriendRecords | null): void;
}) {
  const [snapshot, setSnapshot] = useState<{
    name: string;
    records: Receipt[];
    phase: Phase;
  }>({
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
    guard.open();
    let active = true;
    const fail = () => {
      if (active) setSnapshot({ name: "", records: [], phase: "failed" });
    };
    const load = () => {
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
    };
    const shown = enabled && ready && signedIn();
    // Signed out, or another user signed in elsewhere: the records shown
    // were fetched for someone else, and an answer still on its way too.
    // Back an hour after their answer, the session may have ended on the
    // Worker's side alone (`DORMANT_MS`): they go and are asked again.
    const stop = onPageReturn(() => {
      if (!guard.current()) {
        guard.restart();
        fail();
      } else if (shown && guard.dormant()) {
        guard.restart();
        setSnapshot({ name: "", records: [], phase: "loading" });
        load();
      }
    });
    if (shown) load();
    else if (!signedIn()) fail();
    return () => {
      active = false;
      stop();
      // Left or asked again: what comes back for this request, a 401
      // included, is dropped (PF-5).
      guard.close();
    };
  }, [enabled, friendId, ready, guard]);
  const value = useMemo((): Records => {
    const { phase } = snapshot;
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
  }, [snapshot, aliases, filter]);
  useEffect(() => {
    if (enabled) onChange({ friendId, value });
  }, [enabled, friendId, value, onChange]);
  useEffect(() => () => onChange(null), [onChange]);
  return null;
}
