import { cleanup, render, screen, within } from "@testing-library/react";
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
    "地図の配信元への送信と現在地",
    "問い合わせ",
  ])
    expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
  const text = document.body.textContent;
  for (const fact of [
    "日本国外",
    "3日",
    "最長30日",
    "回復コードを再発行",
    "両方失うと",
    "CARTO",
  ])
    expect(text).toContain(fact);
  // PR-8: no statement on which laws apply.
  expect(text).not.toMatch(/個人情報保護法|電気通信事業法/);
});

it("explains location use and tile requests to visitors without an account", () => {
  render(<TermsPage />);
  const main = screen.getByRole("main");
  expect(main.querySelector("p")?.textContent).toMatch(/地図.*データの扱い/);
  const map = within(main).getByRole("region", {
    name: /地図の配信元への送信/,
  });
  const text = map.textContent;
  expect(text).toMatch(/「現在地」ボタン.*一度だけ取得/);
  expect(text).toMatch(/ブラウザー内.*地図/);
  expect(text).toContain("このサイトのサーバーには送らず、保存もしません");
  expect(text).toMatch(/周辺の地図タイル[^。]*CARTO/);
  expect(text).toMatch(/IPアドレスと、地図上のどの区画[^。]*CARTO/);
  expect(text).toMatch(/ブラウザーや端末の設定.*許可を取り消/);
});
