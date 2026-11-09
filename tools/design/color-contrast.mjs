// WCAG 2 relative luminance for sRGB. Keep fractional channels when compositing.
function channels(color) {
  if (Array.isArray(color)) {
    if (color.length !== 3 || color.some((v) => !Number.isFinite(v) || v < 0 || v > 255))
      throw new Error("Expected three sRGB channels in [0, 255]");
    return color;
  }
  if (typeof color !== "string" || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color))
    throw new Error(`Expected an opaque hex color: ${color}`);
  const hex =
    color.length === 4
      ? color
          .slice(1)
          .split("")
          .map((v) => v + v)
          .join("")
      : color.slice(1);
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
function luminance(color) {
  return channels(color)
    .map((channel) => channel / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrastRatio(foreground, background) {
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
export function composite(foreground, background, opacity) {
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1)
    throw new Error("Expected opacity in [0, 1]");
  const back = channels(background);
  return channels(foreground).map((v, i) => v * opacity + back[i] * (1 - opacity));
}
