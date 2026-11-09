export const INDEXNOW_KEY: string;
export function indexNowPayload(
  sitemapXml: string,
  origin: string,
): { host: string; key: string; keyLocation: string; urlList: string[] };
export function submitIndexNow(
  origin: string,
  options?: { fetch?: typeof fetch; wait?: (ms: number) => Promise<void> },
): Promise<void>;
