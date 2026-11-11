// Passkey flow against `wrangler dev --env dev` with a virtual authenticator:
// register → log out → log in → recover → delete a passkey and the
// account, then each page's CSP. Needs `dist` built with
// VITE_ACCOUNTS_ENABLED=true. Not run in CI; real devices are checked by hand.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { chromium } from "playwright";

// RP ID and ALLOWED_ORIGIN of the dev environment in wrangler.jsonc.
const port = 8787;
const origin = `http://localhost:${port}`;
const assets = await readdir("dist/assets");
const enabled = await Promise.all(
  assets
    .filter((name) => name.endsWith(".js"))
    .map(async (name) =>
      (await readFile("dist/assets/" + name, "utf8")).includes("/api/auth/"),
    ),
);
if (!enabled.includes(true)) {
  console.log(
    "Account browser check skipped: build dist with VITE_ACCOUNTS_ENABLED=true",
  );
  process.exit(0);
}
const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(port, "127.0.0.1", resolve);
});
await new Promise((resolve) => probe.close(resolve));
for (const database of ["DB", "TOMBSTONES"]) {
  const result = spawnSync(
    "bunx",
    [
      "wrangler",
      "d1",
      "migrations",
      "apply",
      database,
      "--local",
      "--env",
      "dev",
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error("Migration failed: " + database);
}
console.log(`Test server: ${origin}`);
const server = spawn(
  "bunx",
  [
    "wrangler",
    "dev",
    "--env",
    "dev",
    "--port",
    String(port),
    "--ip",
    "127.0.0.1",
  ],
  { stdio: ["ignore", "pipe", "inherit"], detached: true },
);
let browser;
const violations = [];
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes("Ready on")) resolve();
    });
    server.on("exit", (code) => reject(new Error(`Server exited: ${code}`)));
  });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  context.setDefaultTimeout(20000);
  await context.addInitScript(() =>
    document.addEventListener("securitypolicyviolation", (event) =>
      console.error(
        `CSP violation: ${event.violatedDirective} ${event.blockedURI}`,
      ),
    ),
  );
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.text().startsWith("CSP violation"))
      violations.push(message.text());
  });
  page.on("pageerror", (error) => violations.push(String(error)));
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );

  const response = await page.goto(origin + "/account");
  assert.equal(response.headers()["referrer-policy"], "no-referrer");
  assert.equal(response.headers()["x-frame-options"], "DENY");
  assert.match(
    response.headers()["content-security-policy"] ?? "",
    /frame-ancestors 'none'/,
  );

  console.log("Register");
  await page.getByLabel("表示名").fill("試験の利用者");
  await page.getByRole("button", { name: "パスキーを作る" }).click();
  const list = page.getByRole("list", { name: "回復コード" });
  await list.or(page.getByRole("alert")).first().waitFor();
  if (await page.getByRole("alert").count())
    throw new Error(await page.getByRole("alert").first().textContent());
  const codes = await list.getByRole("listitem").allTextContents();
  assert.equal(codes.length, 10);
  assert.ok(
    await page.getByRole("button", { name: "次へ" }).isDisabled(),
    "next stays disabled until the codes are kept",
  );
  await page.getByRole("checkbox", { name: /控えました/ }).check();
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("heading", { name: "アカウント", level: 1 }).waitFor();
  await page.getByText("残り 10 個").waitFor();

  console.log("Log out and in");
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.getByRole("button", { name: "パスキーでログイン" }).click();
  await page.getByRole("heading", { name: "アカウント", level: 1 }).waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "表示名" }).inputValue(),
    "試験の利用者",
  );

  console.log("Give up a recovery that collides with this device's passkey");
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.getByRole("button", { name: "回復コードで入る" }).click();
  await page.getByLabel("回復コード").fill(codes[1]);
  await page.getByRole("button", { name: "回復する" }).click();
  await page.getByRole("button", { name: "パスキーを登録" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "この端末にはこのアカウントのパスキーがすでにあります" })
    .waitFor();
  await page
    .getByRole("button", { name: "回復をやめてログインに戻る" })
    .click();
  await page.getByRole("button", { name: "パスキーでログイン" }).click();
  await page.getByRole("heading", { name: "アカウント", level: 1 }).waitFor();
  await page.getByText("残り 9 個").waitFor();

  console.log("Recover");
  // The passkey is lost: excludeCredentials would otherwise match it.
  await cdp.send("WebAuthn.clearCredentials", { authenticatorId });
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.getByRole("button", { name: "回復コードで入る" }).click();
  await page.getByLabel("回復コード").fill(codes[0]);
  await page.getByRole("button", { name: "回復する" }).click();
  await page.getByRole("heading", { name: "新しいパスキーを登録" }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "新しいパスキーを登録" }).waitFor();
  await page.getByRole("button", { name: "パスキーを登録" }).click();
  await page
    .getByRole("heading", { name: "パスキーを登録しました" })
    .or(page.getByRole("alert"))
    .first()
    .waitFor();
  if (await page.getByRole("alert").count())
    throw new Error(await page.getByRole("alert").first().textContent());
  await page.getByRole("button", { name: "回復コードを再発行" }).click();
  await list.waitFor();
  assert.equal(await list.getByRole("listitem").count(), 10);
  await page.getByRole("checkbox", { name: /控えました/ }).check();
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByText("残り 10 個").waitFor();
  assert.equal(
    await page
      .getByRole("list", { name: "パスキー" })
      .getByRole("listitem")
      .count(),
    2,
  );

  console.log("Delete a passkey, then the account");
  await page.getByRole("button", { name: "削除", exact: true }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await page.getByText("パスキーを削除しました。").waitFor();
  assert.ok(
    await page.getByRole("button", { name: "削除", exact: true }).isDisabled(),
  );
  await page.getByRole("button", { name: "アカウントを削除" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "削除する" })
    .click();
  await page
    .getByRole("heading", { name: "アカウントを削除しました" })
    .waitFor();

  // The CSP must not block any page, the map with its basemap included.
  const basemap = [];
  context.on("requestfinished", async (request) => {
    if (!request.url().includes("cartocdn.com")) return;
    const response = await request.response();
    basemap.push(
      new URL(request.url()).pathname.split("/").at(-1) +
        " " +
        response?.status(),
    );
  });
  for (const path of [
    "/",
    "/cards",
    "/about",
    "/terms",
    "/__account_check_missing__",
  ]) {
    console.log("CSP " + path);
    await page.goto(origin + path, { waitUntil: "networkidle" });
  }
  assert.deepEqual(violations, []);
  // Style, sprite, glyphs and tiles all came through connect-src.
  console.log(`Basemap responses: ${basemap.length}`);
  assert.ok(basemap.some((entry) => entry.startsWith("style.json 200")));
  assert.ok(basemap.some((entry) => entry.endsWith(".mvt 200")));
  for (const [name, pattern] of [
    ["sprite", /^sprite\S*\.(?:json|png) 200$/],
    ["glyphs", /\.pbf 200$/],
  ])
    assert.ok(
      basemap.some((entry) => pattern.test(entry)),
      `${name}: ${basemap.join(", ")}`,
    );
  console.log("Account browser check passed");
} finally {
  await browser?.close();
  process.kill(-server.pid, "SIGTERM");
}
