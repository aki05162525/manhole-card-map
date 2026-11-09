import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { StatusChip } from "./status-chip";
import { labels } from "./labels";
import { SearchPin } from "./search-feedback";
import type { Status } from "../../domain/types";
it.each(Object.keys(labels) as Status[])(
  "shares the %s status vocabulary",
  (status) => {
    expect(renderToStaticMarkup(<StatusChip status={status} />)).toContain(
      labels[status],
    );
  },
);
it.each([true, false])(
  "uses the same pin wording in search and catalog (%s)",
  (hasPin) => {
    const entry = { hasPin, pinReasons: [] };
    expect(renderToStaticMarkup(<SearchPin entry={entry} />)).toBe(
      renderToStaticMarkup(<SearchPin entry={entry} label="catalog" />),
    );
  },
);
