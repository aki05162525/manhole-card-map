// Parse first, then reject paths that would become network-path references.
export function accountReturn(search = location.search): string | null {
  const path = new URLSearchParams(search).get("returnTo");
  if (
    !path?.startsWith("/") ||
    path.includes("\\") ||
    [...path].some(
      (character) =>
        character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
    )
  )
    return null;
  let url: URL;
  try {
    url = new URL(path, location.origin);
  } catch {
    return null;
  }
  if (
    url.origin !== location.origin ||
    url.pathname.startsWith("//") ||
    /\\|%(?:2f|5c)/i.test(url.pathname)
  )
    return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
