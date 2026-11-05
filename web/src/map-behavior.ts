export const boundedZoom = (zoom: number, maxZoom: number) =>
  Math.min(zoom, maxZoom);
export function clusterCardIds<T>(
  children: T[],
  cards: Map<T, string[]>,
): string[] {
  return [...new Set(children.flatMap((child) => cards.get(child) ?? []))];
}
export async function initialBackground(
  install: () => Promise<void>,
  paint: () => Promise<void>,
) {
  await install();
  await paint();
}
