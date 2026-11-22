export type DetailSection = "places" | "record";
type DetailTarget = DetailSection | "current-stop";

const attribute = "data-detail-target";

export function detailTarget(target: DetailTarget | undefined) {
  return { [attribute]: target };
}

export function detailSelector(target: DetailTarget) {
  return `[${attribute}="${target}"]`;
}
