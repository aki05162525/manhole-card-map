import { useEffect, useMemo, useState } from "react";
import { onPageReturn, signedIn } from "../../session/signed-in";
import { sessionGuard, type Owner } from "../../session/session-guard";
import {
  NO_ALIASES,
  inactive,
  type Phase,
  type Records,
} from "../records/records-context";
import {
  matchesReceiptFilter,
  receiptsByCard,
  type ReceiptFilter,
} from "../../domain/records";
import { isFriendReceipts, type Receipt } from "../../contract/private-api";
import { api } from "../../session/account-api";
import "../records/records.css";

/**
 * What the map shows of one friend's records, and for which friend. The
 * value holds the owner they were asked as and the guard's check
 * (`owner`, `owns`): each part of the map checks them as it draws
 * (`useRecords`), so a part drawn on its own once the cookies name another
 * is handed no name, date or filtered records of theirs.
 */
export type FriendRecords = { friendId: string; value: Records };

/**
 * Fetches a friend's records for the map and hands them to `onChange`; it
 * renders nothing, so the map below it never remounts. Mounted for one visit
 * to one friend's map: each visit asks again whether they are still friends,
 * and on unmount the map is told to drop what it showed. The records are
 * the user's they were asked as: once the cookies name another, they go,
 * and are asked again as the user signed in now (whose answer says whether
 * they may see them).
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
  // The friend's records, with the owner they were asked as once ready.
  const [snapshot, setSnapshot] = useState<{
    name: string;
    records: Receipt[];
    phase: Phase;
    owner?: Owner;
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
      const { owner } = guard;
      // Answers 404 unless they are friends, with the name in the same reply.
      // The guard has told every screen of a 401 that is this user's.
      void guard
        .send(
          () =>
            api(`/api/friends/${encodeURIComponent(friendId)}/records`, {
              read: isFriendReceipts,
            }),
          undefined,
          owner,
        )
        .then((sent) => {
          if (sent.kind === "stale") return;
          // Another user signed in since: asked again as them, as a return
          // does, unless the map has started again already.
          if (sent.kind === "changed") {
            if (active && guard.owner === owner) again();
            return;
          }
          if (sent.kind !== "answer") return fail();
          const { displayName, records } = sent.value;
          if (active && guard.owns(owner))
            setSnapshot({
              name: displayName,
              records: records.map(({ cardId, receivedOn }) => ({
                cardId,
                receivedOn,
              })),
              phase: "ready",
              owner,
            });
        })
        .catch(() => {
          if (active && guard.owner === owner) fail();
        });
    };
    const shown = enabled && ready;
    // Asked again as whoever is signed in now, or failed signed out.
    const again = () => {
      guard.restart();
      if (!shown || !signedIn()) return fail();
      setSnapshot({ name: "", records: [], phase: "loading" });
      load();
    };
    // Signed out, or another user signed in elsewhere: the records shown
    // were fetched for someone else, and an answer still on its way too.
    // Back an hour after their answer, the session may have ended on the
    // Worker's side alone (`DORMANT_MS`): they go and are asked again.
    const stop = onPageReturn(() => {
      if (!guard.current() || (shown && guard.dormant())) again();
    });
    if (shown && signedIn()) load();
    else if (!signedIn()) fail();
    return () => {
      active = false;
      stop();
      // Left or asked again: what comes back for this request, a 401
      // included, is dropped (PF-5).
      guard.close();
    };
  }, [enabled, friendId, ready, guard]);
  // Handed on with the owner they were asked as: drawn only while the
  // guard still holds it, with no side effect (`useRecords`); once not, the
  // map shows them loading until a return asks again.
  const value = useMemo((): Records => {
    const { phase } = snapshot;
    const records =
      phase === "ready" ? receiptsByCard(snapshot.records, aliases) : null;
    return {
      ...inactive,
      owner: snapshot.owner ?? null,
      owns: guard.owns,
      phase,
      friendName: phase === "ready" ? snapshot.name : "",
      records,
      filter,
      setFilter,
      matches: (id: string) => matchesReceiptFilter(records, filter, id),
    };
  }, [snapshot, guard, aliases, filter]);
  useEffect(() => {
    if (enabled) onChange({ friendId, value });
  }, [enabled, friendId, value, onChange]);
  useEffect(() => () => onChange(null), [onChange]);
  return null;
}
