import { describe, expect, it, vi } from "vitest";
import { clusterCardIds, initialBackground, boundedZoom } from "./map-behavior";

describe("shared map behavior", () => {
  it("selects every unique card represented in a cluster", () => {
    const cards = new Map([
      ["a", ["1", "2"]],
      ["b", ["2", "3"]],
    ]);
    expect(clusterCardIds(["a", "b"], cards)).toEqual(["1", "2", "3"]);
  });
  it("clamps restored, selected and located zoom to the background limit", () => {
    expect(boundedZoom(18, 10)).toBe(10);
    expect(boundedZoom(5, 10)).toBe(5);
  });
  it("waits for background installation and paint", async () => {
    const order: string[] = [];
    await initialBackground(
      async () => {
        order.push("load");
      },
      async () => {
        order.push("paint");
      },
    );
    expect(order).toEqual(["load", "paint"]);
  });
  it("rejects background failures without claiming paint", async () => {
    const paint = vi.fn();
    await expect(
      initialBackground(async () => {
        throw new Error("fetch");
      }, paint),
    ).rejects.toThrow("fetch");
    expect(paint).not.toHaveBeenCalled();
  });
});
