import { expect, it } from "vitest";
import { accountReturn } from "./account-return";
it("allows same-origin absolute paths only", () => {
  expect(accountReturn("?returnTo=%2Ffriends%2Finvite")).toBe(
    "/friends/invite",
  );
  for (const path of [
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example/",
    "javascript:alert(1)",
    "friends",
    "/\nevil",
  ])
    expect(
      accountReturn(`?${new URLSearchParams({ returnTo: path })}`),
    ).toBeNull();
});
