import { useEffect, useMemo, useState } from "react";
import { signedIn } from "../../session/signed-in";
import type { Owner } from "../../session/session-guard";
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
import { Dropped } from "../../session/session-guard";
import { useOnUser, usePrivateApi } from "../../session/account-api";
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
 * they may see them). The map mounts it only in a build with accounts.
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
  const session = usePrivateApi();
  useOnUser(session, () => {
    const phase = signedIn() ? "loading" : "failed";
    setSnapshot({ name: "", records: [], phase });
    if (!ready || phase === "failed") return;
    const operation = session.operation();
    void operation
      .owned(`/api/friends/${encodeURIComponent(friendId)}/records`, {
        read: isFriendReceipts,
      })
      .then(({ owner, value }) => {
        if (session.holds(owner))
          setSnapshot({
            name: value.displayName,
            records: value.records.map(({ cardId, receivedOn }) => ({
              cardId,
              receivedOn,
            })),
            phase: "ready",
            owner,
          });
      })
      .catch((error: unknown) => {
        if (!(error instanceof Dropped) && session.owner === operation.owner)
          setSnapshot({ name: "", records: [], phase: "failed" });
      });
  });
  useEffect(() => {
    session.restart();
  }, [friendId, ready, session]);
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
      owns: session.shows,
      phase,
      // Empty until they are ready: a friend's map, with no name yet.
      friendName: snapshot.name,
      records,
      filter,
      setFilter,
      matches: (id: string) => matchesReceiptFilter(records, filter, id),
    };
  }, [snapshot, session, aliases, filter]);
  useEffect(() => {
    onChange({ friendId, value });
  }, [friendId, value, onChange]);
  useEffect(() => () => onChange(null), [onChange]);
  return null;
}
