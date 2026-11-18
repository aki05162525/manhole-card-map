import type { Applies } from "./types";

const weekdays = ["月", "火", "水", "木", "金", "土", "日"];
// Leap-year month lengths match the ledger's MM-DD validation (including 02-29).
const lastDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function coversFullYear(from: string, to: string): boolean {
  const ordinal = (value: string): number => {
    const [month, day] = value.split("-").map(Number);
    return lastDays.slice(0, month - 1).reduce((sum, days) => sum + days, day);
  };
  return (ordinal(to) - ordinal(from) + 366) % 366 === 365;
}
const monthDay = (value: string) => value.split("-").map(Number).join("/");

function rangeLabel(from: string, to: string): string {
  const [startMonth, startDay] = from.split("-").map(Number);
  const [endMonth, endDay] = to.split("-").map(Number);
  if (startDay === 1 && endDay === lastDays[endMonth - 1]) {
    return startMonth === endMonth
      ? `${startMonth}月`
      : `${startMonth}〜${endMonth}月`;
  }
  return from === to ? monthDay(from) : `${monthDay(from)}〜${monthDay(to)}`;
}

// Labels describe counter selection, never availability or today's opening status.
export function appliesLabel(
  applies: Applies,
  placeName: (id: string) => string,
): string {
  const label = (value: Applies): string => appliesLabel(value, placeName);
  switch (applies.kind) {
    case "openDays":
      return "開館日";
    case "text":
      return applies.label;
    case "annual":
      return rangeLabel(applies.from, applies.to);
    case "closedDayOf":
      return `${placeName(applies.placeId)}の${applies.closure === "temporary" ? "臨時休館日" : applies.closure === "regular" ? "定休日" : "休館日"}`;
    case "all":
      return applies.items.map((item) => `（${label(item)}）`).join("かつ");
    case "any":
      return applies.items.map((item) => `（${label(item)}）`).join("または");
    case "except":
      return `${label(applies.base)}（${label(applies.excluded)}を除く）`;
    case "calendar": {
      const days = [...applies.weekdays].sort((a, b) => a - b);
      const key = days.join(",");
      let result: string;
      if (key === "1,2,3,4,5" && applies.holiday === "exclude") result = "平日";
      else if (key === "6,7" && applies.holiday === "include")
        result = "土日祝";
      else {
        if (days.length === 0) result = "祝日";
        else if (days.length === 7) result = "毎日";
        else if (days.length === 6)
          result = `${weekdays.find((_, i) => !days.includes((i + 1) as (typeof days)[number]))}曜以外`;
        else result = days.map((day) => weekdays[day - 1]).join("・") + "曜";
        if (applies.holiday === "include" && days.length > 0 && days.length < 7)
          result += days.length === 6 ? "と祝日" : "・祝日";
        if (applies.holiday === "exclude") result += "（祝日を除く）";
      }
      return applies.season &&
        !coversFullYear(applies.season.from, applies.season.to)
        ? `${rangeLabel(applies.season.from, applies.season.to)}の${result}`
        : result;
    }
  }
}
