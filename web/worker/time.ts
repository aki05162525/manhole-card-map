export const MINUTE = 60 * 1000;
export const DAY = 24 * 60 * MINUTE;
// Japan has no daylight saving time: its calendar days start at 15:00 UTC.
export const JST = 9 * 60 * MINUTE;

// The Japanese calendar date of a moment, as YYYY-MM-DD.
export const japanDate = (time: number) =>
  new Date(time + JST).toISOString().slice(0, 10);
