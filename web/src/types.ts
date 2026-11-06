import type { MapFocus } from "./map-levels";
export type Status = "active" | "upcoming" | "suspended" | "ended" | "unknown";
export type Pin = {
  pref: string;
  id: string;
  cardIds: string[];
  kind: "lid" | "place";
  status: Status;
  lat: number;
  lng: number;
  reference: boolean;
};
export type Coord = {
  status: string;
  lat?: number;
  lng?: number;
  reason?: string;
  review: string;
};
export type Card = {
  id: string;
  city: string;
  pref: string;
  series: string;
  issued: string;
  status: Status;
  lid: Coord;
  placeText: string[];
  hours: string[];
  links: string[];
  acquired: string;
  override?: { checkedAt: string; evidence: string; reviewer: string };
};
export type Evidence = {
  sourceUrl: string;
  snapshotPath: string;
  snapshotSHA256: string;
  sourceLocator: string;
  checkedAt: string;
  actorType: string;
  verificationMethod: string;
};
export type LocationReview = {
  status: "confirmed" | "needs-review" | "withdrawn";
  addressStatus: "valid" | "needs-review";
  reason: string;
  decisionId?: string;
  reviewedAt?: string;
  reviewDue?: string;
  sourceVersion?: string;
};
export type Data = {
  schema: number;
  updated: string;
  evaluatedAt?: string;
  cards: Card[];
  places: {
    id: string;
    name: string;
    address: string;
    phone: string;
    coordinate: Coord;
    locationReview?: LocationReview;
    evidence?: Evidence;
  }[];
  relations: {
    cardId: string;
    placeId: string;
    condition: string;
    periodRaw: string;
    alternativeRaw: string;
    hours?: string[];
    status?: Status;
    validFrom?: string;
    validTo?: string;
    reviewUntil?: string;
    review?: "verified" | "needs-review";
    evidence?: Evidence;
  }[];
  pins: Pin[];
};
export type View = { lat: number; lng: number; zoom: number };
export type Adapter = {
  ready: Promise<void>;
  focus(focus: MapFocus): void;
  select(pins: Pin[]): void;
  locate(lat: number, lng: number): void;
  japan(): void;
  view(): View;
  onMove(fn: () => void): void;
  exercise(): Promise<void>;
  tapPoint(id?: string): { x: number; y: number } | null;
};
export type Create = (
  pins: Pin[],
  select: (ids: string[]) => void,
  view: View | null,
) => Adapter;
export const colors: Record<Status, string> = {
  active: "#087f8c",
  upcoming: "#4e58bb",
  suspended: "#b86410",
  ended: "#777777",
  unknown: "#b12f62",
};
export const labels: Record<Status, string> = {
  active: "配布中",
  upcoming: "配布開始前",
  suspended: "一時中止",
  ended: "配布終了",
  unknown: "要確認",
};
export const painted = () =>
  new Promise<void>((r) =>
    requestAnimationFrame(() => requestAnimationFrame(() => r())),
  );
