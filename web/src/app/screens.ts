import type { ComponentType } from "react";
import type { HistoryRoute } from "../shared/browser/app-history";

export type Screen = ComponentType;
export type Screens = Partial<Record<HistoryRoute, Screen>>;

/**
 * Kept mounted while another screen is shown. The friends, the account and
 * about unmount instead: what they held halfway (recovery codes, a sign-in)
 * is gone, and a return draws them again.
 */
export const kept = (route: HistoryRoute) =>
  route === "map" || route === "catalog";

// One per screen: a route without its own does not compile. Each import stays
// inside its function, so a screen's code is asked for only when it is shown
// (`scripts/deploy/check-deploy.mjs` holds the account's to that).
const loaders: Record<HistoryRoute, () => Promise<{ default: Screen }>> = {
  map: () => import("./map-screen"),
  catalog: () => import("./catalog-screen"),
  friends: () => import("./friends-screen"),
  account: () => import("./account-screen"),
  about: () => import("./about-screen"),
};

export const loadScreen = async (route: HistoryRoute): Promise<Screen> =>
  (await loaders[route]()).default;
