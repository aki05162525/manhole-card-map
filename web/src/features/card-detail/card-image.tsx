import { useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { municipalityName } from "../../domain/card-presentation";
import type { Card } from "../../domain/types";
import { useScreenActive } from "../../shared/browser/screen-activity";

/**
 * A card image the municipality permitted: the whole card at its own
 * proportions, no crop, filter or overlay, with the credit it asked for.
 * It leads the detail, and a press shows it as large as the screen allows.
 * The detail is keyed by card, so a failure is forgotten on the next card.
 */
export function CardImage({ card }: { card: Card }) {
  const [failed, setFailed] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  // A modal left open under a hidden screen would make the shown one inert.
  const active = useScreenActive();
  const { image } = card;
  if (!image || failed) return null;
  const alt = `${municipalityName(card.city)}のマンホールカード（${card.id}）`;
  const credit = `画像：${image.credit}`;
  // The CSS sizes the image from its proportions, so its place is held
  // before it arrives whichever side the layout limits.
  const size: CSSProperties & Record<`--${string}`, number | string> = {
    "--card-image-ratio": image.width / image.height,
    "--card-image-width": `${image.width}px`,
  };
  const fail = () => setFailed(true);
  return (
    <figure className="card-image" style={size}>
      <button
        type="button"
        className="card-image-open"
        aria-label={`${alt}を大きく表示`}
        aria-haspopup="dialog"
        onClick={() => setEnlarged(true)}
      >
        <img
          src={image.path}
          width={image.width}
          height={image.height}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={fail}
        />
      </button>
      <figcaption>{credit}</figcaption>
      {enlarged && active
        ? // In the body: the sheet listens for touches on its own subtree.
          createPortal(
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- 画像の外のタップで閉じる補助操作。Esc と「閉じる」を併設する。
            <dialog
              ref={(element) => {
                if (element && !element.open) element.showModal();
              }}
              className="card-image-zoom"
              style={size}
              aria-label={alt}
              onClose={() => setEnlarged(false)}
              onClick={(event) => {
                // React hands a portal's events to the detail's ancestors:
                // the sheet around it would widen, or fold on Escape.
                event.stopPropagation();
                if (
                  event.target instanceof Element &&
                  event.target.closest("img, figcaption")
                )
                  return;
                // close() hands the focus back to the image's button.
                event.currentTarget.close();
                setEnlarged(false);
              }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <button type="button" className="card-image-close">
                <X aria-hidden="true" size={20} />
                閉じる
              </button>
              <figure>
                <img
                  src={image.path}
                  width={image.width}
                  height={image.height}
                  alt={alt}
                  onError={fail}
                />
                <figcaption>{credit}</figcaption>
              </figure>
            </dialog>,
            document.body,
          )
        : null}
    </figure>
  );
}
