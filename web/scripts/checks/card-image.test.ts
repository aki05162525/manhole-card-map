import { createHash } from "node:crypto";
import sharp from "sharp";
import { expect, test } from "vitest";
import { prepareCardImage } from "../deploy/card-image.mjs";

// A JPEG like the ones municipalities send: Exif and XMP that name people,
// machines and file paths.
const original = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: "#2a6" },
  })
    .withExif({ IFD0: { Copyright: "private-exif", Artist: "someone" } })
    .withXmp(
      '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description>/Users/someone/private.psd</rdf:Description></rdf:RDF></x:xmpmeta>',
    )
    .jpeg()
    .toBuffer();

test("scales the card down whole and drops its metadata", async () => {
  const source = await original(1596, 2132);
  expect((await sharp(source).metadata()).exif).toBeDefined();
  const image = await prepareCardImage("14-100-B001", source);
  const served = await sharp(image.bytes).metadata();
  expect(served.format).toBe("webp");
  // Its own proportions: 1596x2132 at 640 wide.
  expect([image.width, image.height]).toEqual([640, 855]);
  expect([served.width, served.height]).toEqual([640, 855]);
  expect(served.exif).toBeUndefined();
  expect(served.xmp).toBeUndefined();
  expect(served.icc).toBeUndefined();
  expect(Buffer.from(image.bytes).includes("private")).toBe(false);
  // The key names the card and the served bytes; the record keeps the original's hash.
  const digest = createHash("sha256").update(image.bytes).digest("hex");
  expect(image.key).toBe(`14-100-B001-${digest.slice(0, 16)}.webp`);
  expect(image.sourceSha256).toBe(
    createHash("sha256").update(source).digest("hex"),
  );
});

test("never enlarges a small original", async () => {
  const image = await prepareCardImage("14-100-B001", await original(300, 420));
  expect([image.width, image.height]).toEqual([300, 420]);
});
