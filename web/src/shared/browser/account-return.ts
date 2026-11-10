// Accept paths only; URL parsing also catches slash/backslash normalization.
export function accountReturn(search = location.search): string | null {
  const path = new URLSearchParams(search).get("returnTo");
  if (!path?.startsWith("/") || path.startsWith("//") || /[\\\r\n]/.test(path))
    return null;
  const url = new URL(path, location.origin);
  return url.origin === location.origin
    ? `${url.pathname}${url.search}${url.hash}`
    : null;
}
