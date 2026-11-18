import { WORDMARK_GLYPHS, WORDMARK_VIEW_BOX } from "./wordmark-paths";

export function Logo({
  size = 32,
  incomplete = false,
}: {
  size?: number;
  incomplete?: boolean;
}) {
  return (
    <svg
      className="logo"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {size <= 16 ? (
        <>
          <path
            d="M16 7Q9 4 2 5.5v21q7-1.5 14 1.5q7-3 14-1.5v-21Q23 4 16 7v21"
            strokeWidth="2.8"
          />
          <path d="M5.5 12.5h7M5.5 18.5h5" strokeWidth="2.2" />
          <g transform="rotate(-6 23 15.5)">
            <rect
              x="18"
              y="8"
              width="10"
              height="15.5"
              rx="1.5"
              strokeWidth="2"
            />
            <rect
              x="21"
              y="11"
              width="4"
              height="4"
              fill="currentColor"
              stroke="none"
            />
          </g>
        </>
      ) : (
        <>
          <path
            d="M16 7Q9 4 2 5.5v21q7-1.5 14 1.5q7-3 14-1.5v-21Q23 4 16 7v21"
            strokeWidth="1.8"
          />
          <path d="M5 11.5h7.5M5 15.5h7.5M5 19.5h5" strokeWidth="1.1" />
          <g transform="rotate(-6 23 15.5)">
            <rect
              x="18.5"
              y="8"
              width="9"
              height="15"
              rx="1.6"
              strokeWidth="1.3"
              strokeDasharray={incomplete ? "2 1.4" : undefined}
            />
            <circle cx="23" cy="13.2" r="3.2" strokeWidth="1.1" />
            <circle
              cx="23"
              cy="13.2"
              r="2.3"
              strokeWidth=".7"
              strokeDasharray=".32 .884"
            />
            <rect
              x="22.3"
              y="12.5"
              width="1.4"
              height="1.4"
              fill="currentColor"
              stroke="none"
            />
            <path d="M20.4 18.8h5.2M20.4 20.8h3.4" strokeWidth=".8" />
          </g>
          {!incomplete && (
            <path
              d="M19.8 5.5h6.4l-1.1.9 1.1.9-1.1.9 1.1.9h-6.4l1.1-.9-1.1-.9 1.1-.9z"
              transform="rotate(7 23 7.3)"
              fill="currentColor"
              fillOpacity=".35"
              strokeWidth=".6"
              strokeLinejoin="miter"
            />
          )}
        </>
      )}
    </svg>
  );
}
/**
 * The site's name as drawn lettering (wordmark-paths.ts), with the name as
 * its label for whoever does not see the drawing. Outlined, the letters are faces
 * with a line around them, as the hands and cards of the about page's
 * drawings; small, the header's are solid so that they stay legible.
 */
export function Wordmark({ outlined = false }: { outlined?: boolean }) {
  const strokes = WORDMARK_GLYPHS.map(([offset, paths]) => (
    <g key={offset} transform={`translate(${offset})`}>
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  ));
  return (
    <svg
      className="wordmark"
      width="784"
      height="104"
      viewBox={WORDMARK_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="マンホール手帳"
    >
      <g strokeWidth={outlined ? 17 : 12}>{strokes}</g>
      {outlined && (
        <g className="wordmark-face" strokeWidth="10.5">
          {strokes}
        </g>
      )}
    </svg>
  );
}
