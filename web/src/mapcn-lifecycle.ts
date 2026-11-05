export type MapPhase = "loading" | "ready" | "failed";
export function transitionMap(
  state: MapPhase,
  event: "ready" | "error" | "fatal",
): { state: MapPhase; notification: "ready" | "error" | "warning" | null } {
  if (state === "failed") return { state, notification: null };
  if (event === "fatal") return { state: "failed", notification: "error" };
  if (event === "ready") {
    return {
      state: "ready",
      notification: state === "loading" ? "ready" : null,
    };
  }
  return state === "ready"
    ? { state, notification: "warning" }
    : { state: "failed", notification: "error" };
}
