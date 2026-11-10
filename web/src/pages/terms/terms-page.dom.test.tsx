import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { TermsPage } from "./terms-page";

afterEach(cleanup);
it("covers every item PR-7 asks to show before registration", () => {
  render(<TermsPage />);
  for (const heading of [
    "保存するデータ",
    "使い道",
    "フレンドに見えるもの",
    "保存先",
    "ログ",
    "削除とバックアップ",
    "パスキーと回復コード",
    "地図の配信元への送信",
    "問い合わせ",
  ])
    expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
  const text = document.body.textContent!;
  for (const fact of [
    "日本国外",
    "3日",
    "最長30日",
    "回復コードを再発行",
    "両方失うと",
    "ブロックしても相手には知らせません",
    "CARTO",
  ])
    expect(text).toContain(fact);
  // PR-8: no statement on which laws apply.
  expect(text).not.toMatch(/個人情報保護法|電気通信事業法/);
});
