export const servedWidth: number;
export function prepareCardImage(
  cardId: string,
  original: Buffer,
): Promise<{
  bytes: Buffer;
  key: string;
  width: number;
  height: number;
  sourceSha256: string;
}>;
