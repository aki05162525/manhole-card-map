import { readFile, readdir, lstat, access } from "node:fs/promises";
import { resolve, isAbsolute, win32 } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
export async function checkDeploy(directory = "dist") {
  const root = resolve(directory);
  const exists = async (name) =>
    access(resolve(root, name)).then(
      () => true,
      () => false,
    );
  for (const name of ["FIXTURE_ONLY.txt", "sw.js"])
    if (await exists(name)) throw new Error("Forbidden: " + name);
  for (const name of [
    "index.html",
    ...["full", "pins", "details", "manifest"].map(
      (n) => "data/" + n + ".json",
    ),
  ])
    await access(resolve(root, name));
  const manifest = JSON.parse(
    await readFile(resolve(root, "data/manifest.json"), "utf8"),
  );
  if (manifest.fixture) throw new Error("Fixture manifest");
  for (const name of Object.keys(manifest.inputs))
    if (isAbsolute(name) || win32.isAbsolute(name))
      throw new Error("Absolute input");
  for (const [name, hash] of Object.entries(manifest.files)) {
    const file = resolve(root, "data", name);
    if (!file.startsWith(root + "/data/"))
      throw new Error("Invalid manifest path");
    if (
      createHash("sha256")
        .update(await readFile(file))
        .digest("hex") !== hash
    )
      throw new Error("Hash mismatch: " + name);
  }
  let count = 0;
  async function walk(dir, prefix = "") {
    for (const name of await readdir(dir)) {
      const relative = prefix + name;
      const file = resolve(dir, name);
      const stat = await lstat(file);
      if (stat.isSymbolicLink()) throw new Error("Symlink: " + relative);
      if (stat.isDirectory()) {
        await walk(file, relative + "/");
        continue;
      }
      if (
        /\.(br|gz)$/.test(name) ||
        ["data/quality.json", "_headers", ".assetsignore"].includes(relative)
      )
        continue;
      if (stat.size > 25 * 1024 * 1024)
        throw new Error("Oversized: " + relative);
      count++;
    }
  }
  await walk(root);
  if (count > 20000) throw new Error("Too many assets");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await checkDeploy(process.argv[2]);
