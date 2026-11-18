import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { accountRead } from "../contract/private-api";
import { readAhead, remembered } from "./private-reads";

const page = {
  profile: {
    displayName: "たろう",
    passkeys: 1,
    recoveryCodesRemaining: 10,
    rpId: "manhole-techo.com",
    userId: "u1",
  },
  passkeys: [{ id: "p1", label: "パスキー 1", createdAt: 0, lastUsedAt: null }],
};
const answered = () => new Promise((resolve) => setTimeout(resolve));
beforeEach(() => {
  document.cookie = "signed_in=1; Path=/";
  document.cookie = "session_mark=aaaa; Path=/";
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  document.cookie = "signed_in=; Max-Age=0; Path=/";
  document.cookie = "session_mark=; Max-Age=0; Path=/";
  vi.unstubAllGlobals();
});

it("keeps only a read whose body passed its check", async () => {
  for (const body of [
    { profile: { displayName: "たろう" }, passkeys: [] },
    { ...page, passkeys: null },
    null,
  ]) {
    vi.mocked(fetch).mockResolvedValue(Response.json(body));
    readAhead(accountRead);
    await answered();
    expect(remembered(accountRead)).toBeNull();
  }
  vi.mocked(fetch).mockResolvedValue(Response.json(page));
  readAhead(accountRead);
  await answered();
  expect(remembered(accountRead)).toEqual(page);
});
