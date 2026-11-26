/**
 * The slug of a path that names a prefecture's list: the build writes one at
 * `/pref/<slug>/` (`pages/cards/static-catalog.tsx`). Local servers also
 * answer it without the slash and by its file name. Apart from the slugs
 * themselves (`prefecture-pages.ts`): every screen's history reads a path.
 */
export const prefectureSlug = (pathname: string) =>
  /^\/pref\/([^/]+)(?:\/(?:index\.html)?)?$/.exec(pathname)?.[1];
