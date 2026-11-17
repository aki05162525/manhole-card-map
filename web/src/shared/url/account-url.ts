/** The account page, which sends the visitor back to `returnTo` once signed in. */
export function accountHref(returnTo: string): string {
  return `/account?${new URLSearchParams({ returnTo })}`;
}
