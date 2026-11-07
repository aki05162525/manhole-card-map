const params = new URLSearchParams(location.search);
export const metrics = {
  engine: "mapcn",
  mode: params.get("data") === "split" ? "split" : "full",
  ready: 0,
  taps: [] as number[],
  errors: [] as string[],
};
