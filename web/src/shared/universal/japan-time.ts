// Japan has no daylight saving time: its calendar days start at 15:00 UTC.
export const JST = 9 * 60 * 60 * 1000;

// The Japanese calendar date of a moment, as YYYY-MM-DD.
export const japanDate = (time: number) =>
  new Date(time + JST).toISOString().slice(0, 10);

// Formats moments in Japanese time whatever the zone of the device.
export const japanFormat = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", ...options });
