import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SourceNotes } from "./source-notes";

afterEach(cleanup);

it("keeps visit guidance while toggling the map legend", () => {
  expect(document.defaultView).toBe(window);
  const { rerender } = render(<SourceNotes />);
  expect(screen.getByText("■ 配布場所")).toBeTruthy();
  rerender(<SourceNotes showLegend={false} />);
  expect(screen.queryByText("■ 配布場所")).toBeNull();
  expect(screen.getByText(/在庫は未確認/)).toBeTruthy();
});
