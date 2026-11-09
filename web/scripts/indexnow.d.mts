export const INDEXNOW_KEY: string;
export function indexNowPayload(
  sitemapXml: string,
  origin: string,
): { host: string; key: string; keyLocation: string; urlList: string[] };
