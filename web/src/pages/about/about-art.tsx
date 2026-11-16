import type { ReactNode } from "react";

/*
 * Line drawings for the two steps. Lines take currentColor and faces take the
 * paper colour (about.css), so both follow the colour scheme. Each drawing
 * carries its own lid pattern under ids prefixed with its name: two drawings
 * share the page.
 */
function Art({
  name,
  label,
  children,
}: {
  name: string;
  label?: string;
  children: (
    lid: (transform: string, strokeWidth: number) => ReactNode,
  ) => ReactNode;
}) {
  const clip = `about-${name}-lid`;
  const cover = `about-${name}-cover`;
  return (
    <svg
      className="about-art"
      width="480"
      height="320"
      viewBox="0 0 480 320"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true })}
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="100" cy="100" r="85" />
        </clipPath>
        {/* An invented abstract lid, 200 by 200. The stroke width comes from each use. */}
        <g id={cover}>
          <circle className="about-art-face" cx="100" cy="100" r="98" />
          <circle cx="100" cy="100" r="85" />
          <g clipPath={`url(#${clip})`} transform="rotate(-35 100 100)">
            <circle cx="100" cy="56" r="20" fill="currentColor" />
            <path d="M0 100H200M0 117H200M0 134H200M0 151H200M0 168H200" />
          </g>
        </g>
      </defs>
      {children((transform, strokeWidth) => (
        <use
          href={`#${cover}`}
          transform={transform}
          strokeWidth={strokeWidth}
        />
      ))}
    </svg>
  );
}

const FINGERS = "M-80 -22H26a22 22 0 0 1 0 44H-80Z";
const SLEEVE = "M-320 -30H-74V30H-320Z";

function Thumb() {
  return (
    <path
      className="about-art-face"
      transform="translate(-48 -10) rotate(-26)"
      d="M0 -11H54a11 11 0 0 1 0 22H0"
    />
  );
}

/* The arm behind the card: fingers, then a sleeve that is filled or outlined. */
function Arm({ filled = false }: { filled?: boolean }) {
  return (
    <>
      <path className="about-art-face" d={FINGERS} />
      {filled ? (
        <path fill="currentColor" d={SLEEVE} />
      ) : (
        <>
          <path className="about-art-face" d={SLEEVE} />
          <path d="M-86 -30V30" />
        </>
      )}
    </>
  );
}

function Card({ transform, lid }: { transform: string; lid: ReactNode }) {
  return (
    <g transform={transform}>
      <rect
        className="about-art-face"
        x="-62"
        y="-88"
        width="124"
        height="176"
        rx="8"
      />
      <path d="M-28 -70H28" />
      <rect x="-48" y="-58" width="96" height="100" />
      {lid}
      <path d="M-46 58H30M-46 72H14" />
    </g>
  );
}

const GIVER = "translate(205 109) rotate(10)";
const RECEIVER = "translate(279 203) rotate(205) scale(1 -1)";

/* The text beside it already says the card is received, so it is decorative. */
export function ReceiveArt() {
  return (
    <Art name="receive">
      {(lid) => (
        <>
          <g transform={GIVER}>
            <Arm filled />
          </g>
          <g transform={RECEIVER}>
            <Arm />
          </g>
          <Card
            transform="translate(240 158) rotate(5)"
            lid={lid("translate(-42 -50) scale(0.42)", 4.2)}
          />
          <g transform={GIVER}>
            <Thumb />
          </g>
          <g transform={RECEIVER}>
            <Thumb />
          </g>
        </>
      )}
    </Art>
  );
}

const HOLDER = "translate(93 234) rotate(-30)";
const SCREEN = "about-visit-screen";

/* Named: holding the card up for a photo is told by the drawing alone.
   The scene is what the phone's camera shows, between its controls. */
export function VisitArt() {
  return (
    <Art
      name="visit"
      label="マンホールカードを実物のマンホールにかざしてスマホで写真を撮る"
    >
      {(lid) => (
        <>
          {/* The phone on its side: buttons, body, screen. */}
          <path d="M330 20V16h44v4M96 300v4h34v-4M142 300v4h34v-4" />
          <rect
            className="about-art-face"
            x="8"
            y="20"
            width="464"
            height="280"
            rx="34"
          />
          {/* The screen, dimmed where the controls are; the picture is the
              plain rectangle between them. */}
          <rect
            x="18"
            y="30"
            width="444"
            height="260"
            rx="25"
            fill="currentColor"
            fillOpacity=".14"
          />
          <clipPath id={SCREEN}>
            <rect x="64" y="30" width="328" height="260" />
          </clipPath>
          <rect
            className="about-art-face"
            x="64"
            y="30"
            width="328"
            height="260"
          />
          <g clipPath={`url(#${SCREEN})`}>
            <g transform="translate(48 32) scale(.8)">
              {lid("translate(196 52) scale(1.08)", 2.4)}
              <g transform={HOLDER}>
                <Arm />
              </g>
              <Card
                transform="translate(132 196) rotate(-6)"
                lid={lid("translate(-42 -50) scale(0.42)", 4.2)}
              />
              <g transform={HOLDER}>
                <Thumb />
              </g>
            </g>
          </g>
          <path d="M64 30V290M392 30V290" />
          {/* The front camera's island, flash and the shutter. */}
          <rect
            x="34.5"
            y="140"
            width="13"
            height="40"
            rx="6.5"
            fill="currentColor"
          />
          <path
            className="about-art-face"
            d="M43 48l-7 11h6l-2 9 8-12h-6z"
            strokeWidth="1.5"
          />
          <circle className="about-art-face" cx="427" cy="160" r="21" />
          <circle cx="427" cy="160" r="15" fill="currentColor" />
        </>
      )}
    </Art>
  );
}
