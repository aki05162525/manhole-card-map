// A region pressed on the national drawing the map's HTML holds, before the
// page's script has loaded (`first-stage.ts`): the drawing marks it, and the
// page opens it as it starts (`use-map-navigation.ts`), once.

/** The page's script could not start (`main.ts`): a press goes to the list. */
export const START_FAILED = "map-start-failed";

const root = () => document.getElementById("root");

export function writeEarlyChoice(area: string) {
  const element = root();
  if (element) element.dataset.earlyChoice = area;
}

/** The region pressed before the page started, until it is opened. */
export function earlyChoice() {
  return root()?.dataset.earlyChoice ?? null;
}
/** The region pressed early is opened: no later map opens it again. */
export function clearEarlyChoice() {
  const element = root();
  const had = element?.dataset.earlyChoice !== undefined;
  if (element) delete element.dataset.earlyChoice;
  return had;
}
