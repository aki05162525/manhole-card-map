type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 月=1、日=7
type MonthDay = string; // MM-DD。ビルド時に閏年2000の月日として検査
type AnnualRange = { from: MonthDay; to: MonthDay }; // 両端含む。逆順は年越し
export type Applies =
  | { kind: "openDays" } // 自窓口の配布可能な開館日。年中無休の断言ではない
  | {
      kind: "calendar";
      weekdays: Weekday[];
      holiday: "include" | "exclude" | "asWeekday";
      season?: AnnualRange;
    }
  | ({ kind: "annual" } & AnnualRange)
  | {
      kind: "closedDayOf";
      placeId: string;
      closure: "all" | "regular" | "temporary";
    }
  | { kind: "text"; label: string }
  | { kind: "all" | "any"; items: [Applies, Applies, ...Applies[]] }
  | { kind: "except"; base: Applies; excluded: Applies };
// holidayは国民の祝日・休日（振替休日等を含む）。
// includeは曜日集合 OR 祝休日、excludeは曜日集合 AND NOT 祝休日。
// asWeekdayは祝休日か否かを判定に使わない。年末年始は別。
// annualの02-29という終端は非閏年もMM-DD順で比較する（02-28を含む）。
// 全種類を自窓口の配布時間・休館日、status、有効期間と併せて使う。
// 開館カレンダーがないとopenDays/closedDayOfの日付評価はunknown。
// textを含む式も自動選択の根拠にはしない。
// draft.unsureは整備用メタデータであり、公開Appliesに混ぜない。

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
  status: "confirmed" | "candidate" | "unconfirmed";
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
  /** Only where the municipality permitted it (data/card-images.json). */
  image?: CardImage;
};
// Shown whole, unaltered, with the credit the municipality asked for.
type CardImage = {
  path: string;
  credit: string;
  width: number;
  height: number;
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
type UpcomingChange = {
  validFrom: string;
  validTo?: string;
  status: Status;
  hours?: string[];
  applies?: Applies;
  condition: string;
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
    applies?: Applies;
    periodRaw: string;
    alternativeRaw: string;
    hours?: string[];
    status?: Status;
    validFrom?: string;
    validTo?: string;
    review?: "verified" | "needs-review";
    evidence?: Evidence;
    /** Verified later periods as of evaluatedAt, in order. Never a counter or a status. */
    upcoming?: UpcomingChange[];
  }[];
  pins: Pin[];
};
