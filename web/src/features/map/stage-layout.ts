/** A badge as the stage draws it: its centre and radius on the screen. */
export type Spot = { x: number; y: number; radius: number; name: string };

/** A fingertip's half width. */
const REACH = 22;
/** From a badge's circle to its name below (level-stage.css). */
const NAME_GAP = 6;

const apart = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * How far around its centre a press belongs to each badge: a fingertip's
 * width where there is room, never less than the circle, and beside a
 * neighbour half the gap between the two circles. No point is within two
 * reaches, so a press on a circle is never taken by the badge next to it.
 */
export function badgeReach(spots: Spot[]): number[] {
  return spots.map((spot, i) =>
    Math.max(
      spot.radius,
      Math.min(
        REACH,
        ...spots
          .filter((_, j) => j !== i)
          .map(
            (other) =>
              spot.radius +
              (apart(spot, other) - spot.radius - other.radius) / 2,
          ),
      ),
    ),
  );
}

/** Whether any two circles lie over each other. */
export function badgesOverlap(spots: Spot[]) {
  return spots.some((spot, i) =>
    spots.some(
      (other, j) => i < j && apart(spot, other) < spot.radius + other.radius,
    ),
  );
}

/** A name's box: centred under its badge, a character an `em` square. */
function nameBox(spot: Spot, em: number) {
  const half = (spot.name.length * em) / 2;
  const top = spot.y + spot.radius + NAME_GAP;
  return {
    left: spot.x - half,
    right: spot.x + half,
    top,
    bottom: top + em,
  };
}

/**
 * Whether prefecture badges are too close to be told apart and pressed:
 * a fingertip's reach is cut short, or a name lies over another badge or
 * another name. Such a level is offered as a list instead.
 */
export function badgesCrowded(spots: Spot[], em: number) {
  if (badgeReach(spots).some((reach) => reach < REACH)) return true;
  return spots.some((spot, i) => {
    const box = nameBox(spot, em);
    return spots.some((other, j) => {
      if (i === j) return false;
      // The nearest point of the name to the other circle.
      const x = Math.max(box.left, Math.min(other.x, box.right));
      const y = Math.max(box.top, Math.min(other.y, box.bottom));
      if (Math.hypot(x - other.x, y - other.y) < other.radius) return true;
      const next = nameBox(other, em);
      return (
        box.left < next.right &&
        next.left < box.right &&
        box.top < next.bottom &&
        next.top < box.bottom
      );
    });
  });
}
