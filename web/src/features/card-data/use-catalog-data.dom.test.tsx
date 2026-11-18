import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Data } from "../../domain/types";
import { sharedCardData } from "./card-data";
import { useCatalogData } from "./use-catalog-data";

vi.mock("./card-data", () => ({
  fixtureBuild: false,
  loadedCardData: () => undefined,
  sharedCardData: vi.fn(),
}));
afterEach(cleanup);

it("takes the failure away as the retry starts, and shows the retry's own answer", async () => {
  const data = { evaluatedAt: "2026-11-18" } as Data;
  let arrive = (_value: Data) => {};
  const retry = new Promise<Data>((resolve) => {
    arrive = resolve;
  });
  vi.mocked(sharedCardData)
    .mockRejectedValueOnce(new Error("offline"))
    .mockReturnValueOnce(retry);
  const { result } = renderHook(() => useCatalogData());
  await waitFor(() => expect(result.current.error).not.toBe(""));

  act(() => result.current.reload());
  // Still unanswered: the banner of the attempt before is gone meanwhile.
  expect(result.current.error).toBe("");
  expect(result.current.data).toBeNull();

  await act(async () => {
    arrive(data);
    await retry;
  });
  expect(result.current.data).toBe(data);
  expect(result.current.error).toBe("");
});
