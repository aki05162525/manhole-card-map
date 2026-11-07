import { describe, expect, it } from "vitest";
import { transitionMap } from "./mapcn-lifecycle";
describe("map readiness and resource failures", () => {
  it("keeps the usable map after late tile failures and permits repeated warnings", () => {
    const ready = transitionMap("loading", "ready");
    expect(ready).toEqual({ state: "ready", notification: "ready" });
    const warning = transitionMap(ready.state, "error");
    expect(warning).toEqual({ state: "ready", notification: "warning" });
    expect(transitionMap(warning.state, "error").state).toBe("ready");
  });
  it("fails initial load and rejects a late idle event so missing backgrounds aren't reported ready", () => {
    const failed = transitionMap("loading", "error");
    expect(failed).toEqual({ state: "failed", notification: "error" });
    expect(transitionMap(failed.state, "ready")).toEqual({
      state: "failed",
      notification: null,
    });
  });
  it("treats a renderer crash as fatal even after initial readiness", () => {
    expect(transitionMap("ready", "fatal")).toEqual({
      state: "failed",
      notification: "error",
    });
  });
  it("notifies readiness once and emits no duplicate failure", () => {
    expect(transitionMap("ready", "ready").notification).toBeNull();
    expect(transitionMap("failed", "error").notification).toBeNull();
  });
});
