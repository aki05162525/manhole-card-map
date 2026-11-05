import { expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";

it("deploys and compresses background separately from the SW guarantee", async () => {
  const temp = await mkdtemp(join(tmpdir(), "background-deploy-"));
  try {
    await mkdir(join(temp, "dist-fixture/assets"), { recursive: true });
    await mkdir(join(temp, "public/background"), { recursive: true });
    await writeFile(join(temp, "dist-fixture/index.html"), "fixture");
    await writeFile(
      join(temp, "public/background/japan.geojson"),
      '{"type":"FeatureCollection","features":[]}',
    );
    await writeFile(join(temp, "public/background/manifest.json"), "{}");
    execFileSync(
      process.execPath,
      [resolve("scripts/prepare.mjs"), "--fixture"],
      { cwd: temp },
    );
    expect(
      await readFile(
        join(temp, "dist-fixture/background/japan.geojson"),
        "utf8",
      ),
    ).toContain("FeatureCollection");
    expect(
      (await readFile(join(temp, "dist-fixture/background/japan.geojson.gz")))
        .length,
    ).toBeGreaterThan(0);
    expect(
      await readFile(join(temp, "dist-fixture/sw.js"), "utf8"),
    ).not.toContain("/background/");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
