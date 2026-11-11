export type Status = "active" | "upcoming" | "suspended" | "ended" | "unknown";
export type Pin = {
  receipt?: "all" | "some" | "none";
  pref: string;
  id: string;
  cardIds: string[];
  kind: "lid" | "place";
  status: Status;
  lat: number;
  lng: number;
};
export type Coord = {
  status: string;
  lat?: number | undefined;
  lng?: number | undefined;
};
export type Card = {
  id: string;
  city: string;
  pref: string;
  series: string;
  issued: string;
  status: Status;
  lid: Coord & { reason?: string };
  placeText: string[] | null;
  hours: string[] | null;
  links: string[] | null;
  acquired: string;
};
type Evidence = {
  sourceUrl: string;
  checkedAt: string;
};
// cmd/builddata publishes only these values.
type LocationReview = {
  status: "confirmed" | "withdrawn";
  reason: string;
};
export type Data = {
  schema: number;
  cardAliases?: Record<string, string>;
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
    review?: "verified" | "needs-review";
    evidence?: Evidence;
  }[];
  pins: Pin[];
};
