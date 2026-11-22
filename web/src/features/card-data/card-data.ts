import { diagnosticsEnabled } from "../../shared/browser/explorer-metrics";
import { assertPublicData } from "../../domain/public-data";
import {
  detailData,
  withoutPins,
  pinsView,
  searchView,
  type DetailFile,
  type PinsFile,
  type SearchFile,
} from "../../domain/public-views";
import type { Data } from "../../domain/types";

// The files of one data generation (`domain/public-views.ts`). The catalog
// reads `full`. The map reads `pins` to start with, `search` when the search
// opens and a prefecture's `detail-NN` when one of its cards is chosen, so
// that looking at the map reads no card's details. Where the catalog of the
// same document has read everything, the map takes its part from that.
type Files = {
  full: Data;
  pins: PinsFile;
  search: SearchFile;
  detail: DetailFile;
};

// A real build names its data generation (`vite.config.ts`) and reads the
// copy under that name, which is kept without revalidation and never holds
// another generation. Fixture and dev data keep the plain, revalidated URL.
function dataUrl(name: string) {
  const version: unknown = import.meta.env.VITE_DATA_VERSION;
  return typeof version === "string" && version
    ? `/data-v/${version}/${name}.json`
    : `/data/${name}.json`;
}
// Synthetic builds (`vite build --mode fixture`) warn on every data page.
export const fixtureBuild = import.meta.env.MODE === "fixture";

/**
 * How a file could not be read. `"gone"`: the server has no such file, as
 * when a deployment has replaced this document's generation; the same URL
 * will not answer, and the page has to be opened again. `"failed"`:
 * anything else, which asking again may mend.
 */
export type Failure = "failed" | "gone";
class Gone extends Error {}

// A real build's files cannot be of two generations: the URL names the
// generation. Under the plain URLs of fixture and dev, where the data can be
// made again while a document is open, the dates say which data a file was
// cut from: the first file received gives them, and a file with other dates
// is refused. Data made again with the same dates is not told apart.
let generation: string | undefined;
async function json<K extends keyof Files>(
  kind: K,
  name: string,
  retry: boolean,
  ahead: boolean,
): Promise<Files[K]> {
  const url = dataUrl(name);
  // Read ahead of a choice, a file yields the line to what is shown now
  // (the map's tiles); browsers without fetch priority ignore the option.
  const init: RequestInit = {
    ...(retry ? { cache: "reload" } : {}),
    ...(ahead ? { priority: "low" } : {}),
  };
  let response = await fetch(url, retry || ahead ? init : undefined);
  // Any failure is asked once more past the HTTP cache: a kept failure, such
  // as a 404 from another deployment, would otherwise stay.
  if (!response.ok && !retry) response = await fetch(url, { cache: "reload" });
  if (response.status === 404 || response.status === 410)
    throw new Gone(`${url}: ${response.status}`);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const value: unknown = await response.json();
  assertPublicData(kind, value);
  const dates = `${value.updated} ${value.evaluatedAt ?? ""}`;
  generation ??= dates;
  if (dates !== generation) throw new Error("データの版が一致しない");
  return value;
}

// The map retries by reloading the document. A fresh module has forgotten
// the failed generation, but the immutable HTTP response can still be cached.
const navigation = performance.getEntriesByType?.("navigation")[0];
const reloaded =
  !!navigation && "type" in navigation && navigation.type === "reload";

const listeners = new Set<() => void>();
let revision = 0;
/** For `useSyncExternalStore`: each arrival and each failure is a revision. */
export function subscribeData(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
export const dataRevision = () => revision;
function changed() {
  revision++;
  for (const listener of listeners) listener();
}

let requested = false;
/**
 * The files of one kind, by name: one load of each, shared by the screens of
 * a document. A failed load is kept as failed until the next call, which
 * asks again, past the HTTP cache from then on.
 */
function files<K extends keyof Files>(kind: K) {
  type Entry = {
    promise: Promise<Files[K]>;
    value?: Files[K];
    failed?: Failure;
  };
  const entries = new Map<string, Entry>();
  const failures = new Set<string>();
  function load(name: string = kind, ahead = false): Promise<Files[K]> {
    const kept = entries.get(name);
    if (kept && !kept.failed) return kept.promise;
    if (!requested && diagnosticsEnabled()) performance.mark("data-requested");
    requested = true;
    const entry: Entry = {
      promise: json(kind, name, reloaded || failures.has(name), ahead),
    };
    entries.set(name, entry);
    entry.promise.then(
      (value) => {
        entry.value = value;
        changed();
      },
      (error: unknown) => {
        entry.failed = error instanceof Gone ? "gone" : "failed";
        failures.add(name);
        changed();
      },
    );
    // Asked again after a failure: the failure is no longer what is shown.
    if (kept) changed();
    return entry.promise;
  }
  return {
    load,
    ask: (name: string = kind, ahead = false) =>
      void load(name, ahead).catch(() => {}),
    received: (name: string = kind) => entries.get(name)?.value,
    failed: (name: string = kind) => entries.get(name)?.failed,
    /** A value that was not fetched: taken from the whole data. */
    keep(value: Files[K]) {
      entries.set(kind, { promise: Promise.resolve(value), value });
      return value;
    },
  };
}
const full = files("full");
const pins = files("pins");
const search = files("search");
const details = files("detail");

/** The catalog's: everything. */
export const sharedCardData = () => full.load();
export const loadedCardData = () => full.received();

/** The map's pins. */
export function loadedPins(): PinsFile | undefined {
  const whole = full.received();
  return pins.received() ?? (whole && pins.keep(pinsView(whole)));
}
export function sharedPins(): Promise<PinsFile> {
  const kept = loadedPins();
  return kept ? Promise.resolve(kept) : pins.load();
}

/** The national search index: read when the search is opened. */
export function loadedSearch(): SearchFile | undefined {
  const whole = full.received();
  return search.received() ?? (whole && search.keep(searchView(whole)));
}
export function requestSearch() {
  if (!loadedSearch()) search.ask();
}
export const searchFailed = () => search.failed();
const pinsFailed = () => !!pins.failed() && !loadedPins();

/**
 * Starts reading one prefecture's details (`detailShard`); `ahead` of a
 * choice when the map has only gone there.
 */
export function requestDetail(shard: string, ahead = false) {
  if (!full.received()) details.ask(`detail-${shard}`, ahead);
}

const merged = new Map<
  string,
  { pins: PinsFile | null; parts: DetailFile[]; data: Data }
>();
/**
 * The details of these shards as one `Data`, the same object while they are
 * the same; `null` until every one has arrived, and how it failed when one
 * could not be read. A shard the pins do not list has no cards. The whole
 * data stands for any of them. When the pins themselves could not be read,
 * the details are shown without them: the search still leads to a card.
 */
export function loadedDetails(
  source: PinsFile | undefined | null,
  shards: readonly string[],
): Data | Failure | null {
  const base = source ?? null;
  if ((!base && !pinsFailed()) || !shards.length) return null;
  const whole = full.received();
  if (whole) return whole;
  const listed = base
    ? shards.filter((shard) => base.shards.includes(shard))
    : [...shards];
  const failures = listed.map((shard) => details.failed(`detail-${shard}`));
  if (failures.includes("gone")) return "gone";
  if (failures.includes("failed")) return "failed";
  const parts: DetailFile[] = [];
  for (const shard of listed) {
    const part = details.received(`detail-${shard}`);
    if (!part) return null;
    parts.push(part);
  }
  const key = listed.join();
  const kept = merged.get(key);
  if (
    kept?.pins === base &&
    kept.parts.every((part, index) => part === parts[index])
  )
    return kept.data;
  const first = parts[0];
  const pinned = base ?? (first && withoutPins(first));
  if (!pinned) return null;
  const data = detailData(pinned, parts);
  merged.set(key, { pins: base, parts, data });
  return data;
}
