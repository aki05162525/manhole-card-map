import { appliesLabel } from "./applies";
import type { Data, Status } from "./types";

type Relation = Data["relations"][number];

const paused = (status: string) => status === "ended" || status === "suspended";
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * A counter's later periods, as checked on the data's evaluation date: from
 * when, its status and, in `detail`, only what differs from now (following
 * the status label on its line, then one line each). Hours and days
 * of a closed counter are not stated. A plan is shown, never applied: it does
 * not choose a counter, a status or a destination, and it is not compared with
 * the browser's date.
 */
export function upcomingChanges(
  relation: Relation,
  placeName: (id: string) => string,
): { from: string; status: Status; detail: string }[] {
  return (relation.upcoming ?? []).map((change) => {
    const open = !paused(change.status);
    const when =
      open && change.applies && !same(change.applies, relation.applies)
        ? `（${appliesLabel(change.applies, placeName)}）`
        : "";
    let detail = when + (change.validTo ? `・${change.validTo}まで` : "");
    const lines: string[] = [];
    if (open && change.hours?.length && !same(change.hours, relation.hours))
      lines.push(...change.hours);
    if (change.condition && change.condition !== relation.condition)
      lines.push(change.condition);
    for (const line of lines) detail += `\n${line}`;
    return { from: change.validFrom, status: change.status, detail };
  });
}
