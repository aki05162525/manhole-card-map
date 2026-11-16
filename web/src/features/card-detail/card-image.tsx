import { useState } from "react";
import { municipalityName } from "../../domain/card-presentation";
import type { Card } from "../../domain/types";

/**
 * A card image the municipality permitted: the whole card at its own
 * proportions, no crop, filter or overlay, with the credit it asked for.
 * The detail is keyed by card, so a failure is forgotten on the next card.
 */
export function CardImage({ card }: { card: Card }) {
  const [failed, setFailed] = useState(false);
  const { image } = card;
  if (!image || failed) return null;
  return (
    <figure className="card-image">
      <img
        src={image.path}
        width={image.width}
        height={image.height}
        alt={`${municipalityName(card.city)}のマンホールカード（${card.id}）`}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
      <figcaption>画像：{image.credit}</figcaption>
    </figure>
  );
}
