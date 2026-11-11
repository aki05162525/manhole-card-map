// SPIKE(keep-map-alive): pixel diff of two PNGs; writes a red-marked diff image.
import sharp from "sharp";
const [a, b, out] = process.argv.slice(2);
const load = (f) =>
  sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const [A, B] = await Promise.all([load(a), load(b)]);
const w = Math.min(A.info.width, B.info.width),
  h = Math.min(A.info.height, B.info.height);
const o = Buffer.alloc(w * h * 4);
let diff = 0,
  minY = h,
  maxY = -1;
for (let y = 0; y < h; y++)
  for (let x = 0; x < w; x++) {
    const ia = (y * A.info.width + x) * 4,
      ib = (y * B.info.width + x) * 4,
      io = (y * w + x) * 4;
    const d =
      Math.abs(A.data[ia] - B.data[ib]) +
      Math.abs(A.data[ia + 1] - B.data[ib + 1]) +
      Math.abs(A.data[ia + 2] - B.data[ib + 2]);
    if (d > 30) {
      diff++;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      o.set([255, 0, 0, 255], io);
    } else o.set([A.data[ia], A.data[ia + 1], A.data[ia + 2], 80], io);
  }
if (out)
  await sharp(o, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(out);
console.log(
  JSON.stringify({
    a: [A.info.width, A.info.height],
    b: [B.info.width, B.info.height],
    diffPixels: diff,
    rows: diff ? [minY, maxY] : null,
  }),
);
