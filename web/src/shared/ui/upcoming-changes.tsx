import { useId } from "react";
import { upcomingChanges } from "../../domain/upcoming-changes";
import type { Data } from "../../domain/types";
import { labels } from "./labels";
import "./upcoming-changes.css";

/**
 * A counter's planned changes as of the data's date. The same words serve the
 * map, the list and the static card pages; nothing here is a choice.
 */
export function UpcomingChanges({
  relation,
  asOf,
  placeName,
}: {
  relation: Data["relations"][number];
  asOf: string | undefined;
  placeName(id: string): string;
}) {
  const id = useId();
  const changes = upcomingChanges(relation, placeName);
  if (!changes.length) return null;
  return (
    <div className="upcoming-changes">
      <p id={id}>今後の変更（{asOf ? `${asOf}時点の予定` : "予定"}）</p>
      <ul aria-labelledby={id}>
        {changes.map((change) => (
          <li key={change.from}>
            <time dateTime={change.from}>{change.from}</time>から
            {labels[change.status]}
            {change.detail}
          </li>
        ))}
      </ul>
    </div>
  );
}
