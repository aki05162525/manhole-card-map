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

it.each([
  "/a/..//evil.example",
  "/%2e//evil.example",
  "//evil",
  "/\\evil",
  "\\/evil",
  "javascript:alert(1)",
  "https://evil.example",
  "/%2F%2Fevil.example",
  "/friends\t/invite",
  "/friends\n/invite",
  "/friends\r/invite",
])("rejects unsafe normalized return target %j", (path) => {
  expect(
    accountReturn(`?${new URLSearchParams({ returnTo: path })}`),
  ).toBeNull();
});
it("keeps safe normalized paths on the same origin", () => {
  const result = accountReturn(
    `?${new URLSearchParams({ returnTo: "/a/../friends/invite?from=account#next" })}`,
  );
  expect(result).toBe("/friends/invite?from=account#next");
  expect(new URL(result!, location.origin).origin).toBe(location.origin);
});
it("rejects malformed network-path URLs without throwing", () => {
  expect(
    accountReturn(`?${new URLSearchParams({ returnTo: "//[" })}`),
  ).toBeNull();
});
