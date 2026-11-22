import type { ReactNode } from "react";
import {
  DEFAULT_SEAL,
  sealCharacter,
  type Seal,
  type SealFrame,
} from "../../contract/seal";
import "./seal.css";

// Each frame in a 48px box, drawn in the ink (`currentColor`). The cover's
// inner ring is the knurling of a manhole cover: 21 marks around it.
const frames: Record<SealFrame, ReactNode> = {
  double: (
    <>
      <circle cx="24" cy="24" r="21" strokeWidth="1.6" />
      <circle cx="24" cy="24" r="17.6" strokeWidth="1.6" />
    </>
  ),
  round: <circle cx="24" cy="24" r="20.5" strokeWidth="3" />,
  oval: <ellipse cx="24" cy="24" rx="16" ry="21" strokeWidth="2.6" />,
  square: (
    <rect x="4.5" y="4.5" width="39" height="39" rx="4" strokeWidth="3" />
  ),
  octagon: (
    <polygon
      points="15,3.5 33,3.5 44.5,15 44.5,33 33,44.5 15,44.5 3.5,33 3.5,15"
      strokeWidth="2.6"
      strokeLinejoin="round"
    />
  ),
  cover: (
    <>
      <circle cx="24" cy="24" r="21" strokeWidth="2.2" />
      <circle
        cx="24"
        cy="24"
        r="16.6"
        strokeWidth="3"
        strokeDasharray="1.6 3.367"
      />
    </>
  ),
};

/**
 * A person's seal beside their name, which says who it is: the seal itself
 * is not read out. `seal` undefined is the seal of a user who has chosen
 * none; null is the empty slot of a person not known yet, as a stamp's is.
 */
export function SealMark({
  seal = DEFAULT_SEAL,
  name,
}: {
  seal?: Seal | null | undefined;
  name: string;
}) {
  if (seal === null || !name)
    return <span className="seal" data-empty="" aria-hidden="true" />;
  return (
    <span
      className="seal"
      data-frame={seal.frame}
      data-ink={seal.ink}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor">
        {frames[seal.frame]}
      </svg>
      <span>{sealCharacter(seal, name)}</span>
    </span>
  );
}
