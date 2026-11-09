import { useEffect, useRef, useState, type RefObject } from "react";

function Cover({
  playing,
  svgRef,
}: {
  playing: boolean;
  svgRef: RefObject<SVGSVGElement | null>;
}) {
  return (
    <svg
      ref={svgRef}
      className={playing ? "about-lid is-playing" : "about-lid"}
      width="240"
      height="240"
      aria-hidden="true"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <rect
        className="about-notebook-cover"
        x="16"
        y="5.3"
        width="14"
        height="22.7"
        rx="1.2"
        strokeWidth="1.2"
      />
      <path
        className="about-notebook-right"
        data-step="2"
        d="M16 7Q23 4 30 5.5v21q-7-1.5-14 1.5Z"
        strokeWidth="1.2"
      />
      <g className="about-notebook-left">
        <path
          data-step="1"
          d="M16 7Q9 4 2 5.5v21q7-1.5 14 1.5"
          strokeWidth="1.2"
        />
        <path data-step="3" pathLength="100" d="M5 11.5h7.5" strokeWidth=".8" />
        <path data-step="3" pathLength="100" d="M5 15.5h7.5" strokeWidth=".8" />
        <path data-step="3" pathLength="100" d="M5 19.5h5" strokeWidth=".8" />
      </g>
      <g transform="rotate(-6 23 15.5)">
        <g data-step="4">
          <rect
            data-step="4"
            pathLength="100"
            x="18.5"
            y="8"
            width="9"
            height="15"
            rx="1.6"
            strokeWidth=".9"
          />
          <circle
            data-step="5"
            pathLength="100"
            cx="23"
            cy="13.2"
            r="3.2"
            strokeWidth=".8"
          />
          <circle
            data-step="6"
            cx="23"
            cy="13.2"
            r="2.3"
            strokeWidth=".5"
            strokeDasharray=".32 .884"
          />
          <rect
            data-step="7"
            x="22.3"
            y="12.5"
            width="1.4"
            height="1.4"
            fill="currentColor"
            stroke="none"
          />
          <path
            data-step="8"
            pathLength="100"
            d="M20.4 18.8h5.2"
            strokeWidth=".55"
          />
          <path
            data-step="8"
            pathLength="100"
            d="M20.4 20.8h3.4"
            strokeWidth=".55"
          />
        </g>
      </g>
      <g data-step="9">
        <path
          d="M19.8 5.5h6.4l-1.1.9 1.1.9-1.1.9 1.1.9h-6.4l1.1-.9-1.1-.9 1.1-.9z"
          transform="rotate(7 23 7.3)"
          fill="currentColor"
          fillOpacity=".35"
          strokeWidth=".45"
          strokeLinejoin="miter"
        />
      </g>
    </svg>
  );
}

// Start only once the cover can be seen; a slow first paint otherwise plays it unseen.
const START_FALLBACK_MS = 2500;
export function AboutLid() {
  const [playing, setPlaying] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    let cancelled = false;
    let fontsReady = false;
    let visible = typeof IntersectionObserver === "undefined";
    const start = () => {
      if (!cancelled) setPlaying(true);
    };
    const maybeStart = () => {
      if (!fontsReady || !visible) return;
      // Two frames: the closed cover is painted before it starts to open.
      requestAnimationFrame(() => requestAnimationFrame(start));
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            visible = true;
            observer?.disconnect();
            maybeStart();
          });
    if (observer && svg.current) observer.observe(svg.current);
    void (document.fonts?.ready ?? Promise.resolve()).then(() => {
      fontsReady = true;
      maybeStart();
    });
    const fallback = window.setTimeout(start, START_FALLBACK_MS);
    return () => {
      cancelled = true;
      observer?.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);
  return <Cover playing={playing} svgRef={svg} />;
}
