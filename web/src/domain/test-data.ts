import type { Card, Data, Pin } from "./types";

// Complete values of the static JSON's records, for tests that care about a
// few fields: each test names those, the rest are empty. The defaults match no
// search, no prefecture and no confirmed position, so they decide nothing.
type Place = Data["places"][number];
type Relation = Data["relations"][number];

export function testCard(fields: Partial<Card> & Pick<Card, "id">): Card {
  return {
    city: "",
    pref: "",
    series: "",
    issued: "",
    status: "active",
    lid: { status: "unconfirmed" },
    placeText: null,
    hours: null,
    links: null,
    acquired: "",
    ...fields,
  };
}

export function testPin(fields: Partial<Pin> & Pick<Pin, "id">): Pin {
  return {
    pref: "",
    cardIds: [],
    kind: "place",
    status: "active",
    lat: 0,
    lng: 0,
    ...fields,
  };
}

export function testPlace(fields: Partial<Place> & Pick<Place, "id">): Place {
  return {
    name: "",
    address: "",
    phone: "",
    coordinate: { status: "unconfirmed" },
    ...fields,
  };
}

export function testRelation(
  fields: Partial<Relation> & Pick<Relation, "cardId" | "placeId">,
): Relation {
  return { condition: "", periodRaw: "", alternativeRaw: "", ...fields };
}
